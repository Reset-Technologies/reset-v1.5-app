import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

/**
 * Crash reporting.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-11-16 the app had NO error reporting of any
 * kind — no Sentry, no Crashlytics, nothing. That is why the single largest
 * leak in the funnel has gone unexplained: **74% of iOS first sessions end
 * inside three seconds** (Android 37%), and nothing could tell us whether the
 * app was dying or people were leaving. Those have completely different fixes.
 * App Store Connect was no help — it only ever returned pre-Reset BetterWell
 * versions.
 *
 * ⚠️ This is NOT session replay and must not quietly become it. We record
 * errors, not screens. Reset shows scan results and body data, and the
 * privacy posture ("Data Used to Track You: No") was reaffirmed deliberately
 * on 2026-11-16 when ATT was declined. Screen recording is a separate decision
 * that belongs to Bryan, not to this file.
 */

const DSN: string = (Constants.expoConfig?.extra?.sentryDsn as string) ?? "";

let started = false;

/** True once Sentry is running against a real DSN. */
export function isCrashReportingConfigured(): boolean {
  return started;
}

/**
 * Start crash reporting. Call once, as early as possible — a crash during
 * startup is exactly the case we cannot currently see, so initialising late
 * would miss the reports that matter most.
 *
 * 🔑 No DSN means this is a no-op rather than a half-configured SDK. The app
 * behaves exactly as it did before this file existed, which keeps a missing
 * environment variable from becoming a startup failure.
 */
export function initCrashReporting(): void {
  if (started || !DSN) return;

  try {
    Sentry.init({
      dsn: DSN,

      // 🔴 NEVER turn this on. It would attach IP addresses and user
      // identifiers to every event. We send a stack trace and the app's own
      // state, never who it happened to. For a health app that is the whole
      // difference between diagnostics and surveillance.
      //
      // 🔴🔴 BUT `false` IS NOT SUFFICIENT ON ITS OWN, which we believed until
      // 2026-11-18 and were wrong about. Sentry Android still attaches a stable
      // per-install UUID as `user.id`, and Sentry's ingest still geolocates the
      // connection. Both were present on a verified production crash. See
      // `beforeSend` below and the project's server-side scrubbing rules.
      sendDefaultPii: false,

      // Debug builds would otherwise flood the same project that production
      // reports land in, and every local run would look like a user crash.
      // Mirrors how Braze is handled — see app.config.ts.
      enabled: !__DEV__,
      environment: __DEV__ ? "development" : "production",

      // Ties a report to the build it came from. Without these, a stack trace
      // cannot be matched to the source maps Metro uploaded for that release,
      // and the frames stay minified.
      release: Constants.expoConfig?.version ?? undefined,

      // Errors only, for now. Tracing samples ordinary sessions and costs
      // quota we would rather spend on crashes; revisit once we know the
      // volume. 0 is the deliberate value, not an oversight.
      tracesSampleRate: 0,

      // 🔴 `sendDefaultPii: false` DOES NOT COVER THE INSTALL ID OR THE GEO.
      // Verified on a real crash on 2026-11-18: the event carried
      // `user.id === contexts.device.id` — a stable per-install UUID — plus a
      // Geography derived from the connection IP. Our store privacy labels
      // declare crash data as NOT linked to the member (Apple: Diagnostics →
      // Crash Data, Linked to You: No), so neither may ride along.
      //
      // ⚠️⚠️ THIS ONLY SCRUBS JS-ORIGINATED EVENTS, WHICH IS NOT WHERE REAL
      // CRASHES COME FROM. An unhandled native crash is captured by Android's
      // UncaughtExceptionHandler and never enters the JS pipeline, so this hook
      // never sees it. The proof is in the SDK: the JS `EventOrigin`
      // integration stamps everything it processes with
      // `event.origin: javascript`, and the verified crash arrived tagged
      // `event.origin: android`. Native events are scrubbed by the Sentry
      // project's server-side rules instead — see project_crash_reporting.
      // Do not delete those rules on the assumption this covers them.
      beforeSend: (event) => {
        delete event.user;
        delete event.server_name;
        const device = event.contexts?.device as
          | Record<string, unknown>
          | undefined;
        if (device) {
          delete device.id;
          delete device.device_unique_identifier;
        }
        return event;
      },
    });
    started = true;
  } catch {
    // A crash reporter that crashes the app it reports on would be worse than
    // having none. Stay off and let the app run.
  }
}

/**
 * Record a handled error — something we caught and recovered from, but want to
 * see. An unhandled crash needs no call; Sentry captures those itself.
 *
 * ⚠️ `context` is read by a human looking at a report. Put app state in it
 * (which screen, which plan, which step), never member data: no email, no
 * name, no scan values, no meal history.
 */
export function reportError(
  error: unknown,
  context?: Record<string, string | number | boolean>,
): void {
  if (!started) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting must never be the thing that breaks a screen.
  }
}

/**
 * Leave a breadcrumb — a step that will appear in the timeline of whatever
 * error comes next. Useful for the onboarding path, where we need to know how
 * far somebody got before the app went quiet.
 *
 * ⚠️ Same rule as above: describe the step, never the person.
 */
export function leaveBreadcrumb(message: string, category = "app"): void {
  if (!started) return;
  try {
    Sentry.addBreadcrumb({ message, category, level: "info" });
  } catch {
    // Ignore.
  }
}

/* ------------------------------------------------------------------------ *
 * PROBES — internal builds only. Both of these deliberately break the app.
 *
 * 🔴 WHY THEY EXIST. As of 2026-11-19 Sentry has captured exactly ONE real
 * event in its life: an Android native crash forced with `adb shell am crash`.
 * That proved delivery and Java symbolication. It left two gaps that cannot be
 * closed without deliberately breaking something:
 *
 *   1. **JS source maps are unproven.** No JavaScript error has ever reached
 *      Sentry (`release:3.7.15 event.origin:javascript` returns nothing). If
 *      the 74%-in-3s iOS sessions are dying on a JS error — the likeliest
 *      shape in a React Native app — we would be reading minified frames at
 *      exactly the moment we need names.
 *   2. **iOS has produced NO real event at all.** `am crash` has no iOS
 *      equivalent, so the only way to prove iOS reporting works end to end is
 *      to crash it on purpose.
 *
 * 🔑 THE GATE IS NOT `__DEV__`, AND THAT IS THE WHOLE POINT. `Sentry.init` runs
 * with `enabled: !__DEV__`, so Sentry is OFF in a dev build — a `__DEV__`-gated
 * probe could never reach it. These are called from the EXPERIMENTAL section of
 * Settings, behind `shouldShowExperiments()`, which is true on internal and
 * TestFlight builds (`SHOW_EXPERIMENTS=true` in the `production` EAS profile)
 * and false on the store build (`production-store`). So Sentry is live AND the
 * affordance is unreachable for members.
 *
 * ⚠️ BUT NOTE WHAT THAT GATE ACTUALLY IS, PER PLATFORM:
 *   • Android — a BUILD-TIME flag. The store AAB genuinely does not have it on.
 *   • iOS — a RUNTIME receipt check, because TestFlight and the App Store ship
 *     the SAME binary. So this code IS in the shipped app and only a runtime
 *     check hides it. It fails closed (`native?.isTestFlight === true`, false
 *     when the native module is missing), and every other row in that section
 *     already works this way — but a crash button has a worse consequence than
 *     a preview screen, so it gets the confirm dialog as a second gate.
 *
 * ⚠️ AND IN A LOCAL DEV BUILD THESE REPORT NOTHING. `shouldShowExperiments()`
 * returns true when `__DEV__`, so the rows are visible — but `Sentry.init` ran
 * with `enabled: !__DEV__`, so the app will crash and no event will be sent.
 * **Use these on an internal/TestFlight build, never in Metro.**
 * ------------------------------------------------------------------------ */

/**
 * Throw an UNHANDLED JavaScript error, to prove source maps resolve.
 *
 * 🔑 Thrown from inside a `setTimeout` on purpose: a throw in an event handler
 * can be swallowed by a React error boundary, while this escapes to React
 * Native's global handler — the same path a real crash takes, and the one
 * Sentry's `ReactNativeErrorHandlers` integration wraps.
 *
 * 🔑 Two nested named frames, also on purpose. One frame proves almost
 * nothing; two adjacent ones make a failure obvious — if source maps work you
 * see `jsProbeInner` and `jsProbeOuter` with file and line, and if they do not
 * you get minified names against a bundle offset.
 */
function jsProbeInner(): never {
  throw new Error("Sentry probe: unhandled JS error (internal build)");
}

function jsProbeOuter(): never {
  return jsProbeInner();
}

export function triggerJsErrorProbe(): void {
  setTimeout(() => {
    jsProbeOuter();
  }, 0);
}

/**
 * Crash the native layer, to prove native symbolication — and on iOS, to prove
 * crash reporting works at all for the first time.
 *
 * ⚠️ The process dies immediately, so the event is written to Sentry's outbox
 * and only SENT on the next launch via `SendCachedEnvelopeIntegration`.
 * **Reopen the app before concluding nothing arrived.**
 */
export function triggerNativeCrashProbe(): void {
  Sentry.nativeCrash();
}

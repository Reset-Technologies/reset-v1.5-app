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

import Constants from "expo-constants";

import { getDeviceId, getSessionId, isAmplitudeEnabled } from "./amplitude";

/**
 * Session replay, scoped to the first-run window ONLY.
 *
 * 🔴 READ THIS BEFORE WIDENING `RECORDABLE_ROUTES`.
 *
 * Bryan approved replay on 2026-11-16 to answer one question: **74% of iOS
 * first sessions end inside three seconds** and we cannot tell whether the app
 * died or people left. He asked for conservative masking plus the scan and
 * body/health screens fully blocked.
 *
 * Masking alone cannot deliver that. Amplitude's masking covers standard
 * native text; it does **not** cover anything drawn with `react-native-svg` —
 * and every sensitive screen we have is SVG-drawn (ScanInsights, ScanHistory,
 * StatDetailSheet, Profile, TypeReveal, TypeSummaryCard, ScoreRing,
 * WindowRing). Under conservative masking those would record in the clear.
 * There is also no per-screen block on React Native: it is `AmpMaskView` +
 * `amp-block` wrapped around each screen, and any screen added later records
 * unless somebody remembers to wrap it.
 *
 * 🔑 So the design is inverted. Instead of recording everything and masking
 * backwards, **recording is OFF by default and switched on for an allowlist of
 * exactly one screen** — the first-run window, which happens before anyone has
 * a scan, a type or a profile. The health data never enters the system at all,
 * and a new screen is private by default rather than by remembering.
 *
 * ⚠️ Adding a route here is a privacy decision, not a technical one. If it can
 * ever display scan results, body measurements, a metabolic type or meal
 * history, it does not belong in this set.
 */
const RECORDABLE_ROUTES: ReadonlySet<string> = new Set([
  // The pre-scan intro. This is where `onboarding_pre_scan` fires and where
  // the drop-off is measured. It shows no member data: nobody has scanned yet.
  "PreScan",
]);

const API_KEY: string =
  ((Constants.expoConfig?.extra as Record<string, unknown>)
    ?.amplitudeApiKey as string) ?? "";

let SessionReplay: typeof import("@amplitude/session-replay-react-native") | null;
try {
  SessionReplay = require("@amplitude/session-replay-react-native");
} catch {
  // Native module missing — any build made before this package was linked.
  // Same contract as amplitude.ts and braze.ts.
  SessionReplay = null;
}

let initPromise: Promise<void> | null = null;
let recording = false;

/** True while a replay is actually being captured. Exposed for tests/debug. */
export function isRecordingSession(): boolean {
  return recording;
}

/**
 * 🔑 `init()` deliberately does NOT begin capture — that is the property this
 * whole design rests on. Recording starts only from `start()`, so the default
 * state of the app is "not recording" rather than "recording until we stop it".
 */
/**
 * Permanently unavailable — no native module (any build made before this
 * package was linked), no key, or Amplitude disabled for this build.
 *
 * 🔑 Kept separate from "ids not ready yet" so the retry below only fires for
 * the case a retry can actually fix. Verified on the Oct 9 debug APK, which
 * has no native module: without this split it burned all three retries on
 * every launch of every dev build, for nothing.
 */
function isAvailable(): boolean {
  return !!SessionReplay && !!API_KEY && isAmplitudeEnabled();
}

function ensureInit(): Promise<void> | null {
  if (!isAvailable()) return null;
  if (initPromise) return initPromise;

  // `isAvailable()` already guarantees this, but it is a function call so it
  // does not narrow the type. A local reference does.
  const sdk = SessionReplay;
  if (!sdk) return null;

  const deviceId = getDeviceId();
  const sessionId = getSessionId();
  // Without these the replay cannot be tied to the events it belongs to, which
  // is the only reason to record it. Try again on the next route change.
  if (!deviceId || !sessionId) return null;

  initPromise = sdk.init({
    apiKey: API_KEY,
    deviceId,
    sessionId,

    // The floor, even though the allowlist already keeps us off every screen
    // that shows member data. Masks all TextInput fields and standard RN Text.
    maskLevel: "conservative",

    // 🔴 OFF ON PURPOSE. Remote config lets the Amplitude project override the
    // masking level set here, and Amplitude's own docs note React Native remote
    // masking may be unstable. The privacy level of a health app must not be
    // changeable from a dashboard — it is pinned in code, in this file.
    enableRemoteConfig: false,

    // Record every qualifying session. The window is one screen and the volume
    // is small (~1,600 new users/month), so sampling would only add noise to
    // an answer we need quickly.
    sampleRate: 1.0,
  }).catch(() => {
    // Let a later route change retry rather than wedging permanently.
    initPromise = null;
  });

  return initPromise;
}

/**
 * Drive recording from the current route. Call on every navigation change.
 *
 * Anything not in `RECORDABLE_ROUTES` stops recording, including routes this
 * file has never heard of — a screen added tomorrow is private without anyone
 * touching this file.
 */
export function syncSessionReplay(routeName: string | undefined): void {
  if (!isAvailable()) return;
  const shouldRecord = !!routeName && RECORDABLE_ROUTES.has(routeName);

  if (shouldRecord === recording) return;

  if (shouldRecord) {
    const pending = ensureInit();
    if (!pending) {
      // 🔴 Amplitude has not produced a device/session id yet. Without a bounded
      // retry this silently records NOTHING: `onStateChange` only fires when the
      // route changes, and the member we most need to see is the one who opens
      // the app and leaves without navigating anywhere. That is the entire
      // population this feature exists to observe.
      scheduleRetry(routeName);
      return;
    }
    recording = true;
    void pending
      .then(() => SessionReplay?.start())
      .catch(() => {
        recording = false;
      });
    return;
  }

  recording = false;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  try {
    void SessionReplay?.stop();
  } catch {
    // Never let replay break navigation.
  }
}

/** Bounded, so a permanently-unavailable SDK cannot spin forever. */
const RETRY_DELAYS_MS = [400, 1200, 3000];
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retriesUsed = 0;

function scheduleRetry(routeName: string): void {
  const delay = RETRY_DELAYS_MS[retriesUsed];
  if (delay === undefined || retryTimer) return;
  retriesUsed += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    // Re-check the route: by now the member may have moved to a screen that is
    // not on the allowlist, and starting then would be exactly wrong.
    syncSessionReplay(routeName);
  }, delay);
}

/**
 * Stop recording and tear down, e.g. on sign-out. Safe to call when not
 * recording.
 */
export function stopSessionReplay(): void {
  recording = false;
  try {
    void SessionReplay?.stop();
  } catch {
    // Ignore.
  }
}

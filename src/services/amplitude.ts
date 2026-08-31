import Constants from "expo-constants";

let Amplitude: any;
try {
  Amplitude = require("@amplitude/analytics-react-native");
} catch {
  // Native module not available (e.g. Expo Go, or any build made before this
  // package was linked by prebuild). Same contract as braze.ts.
  Amplitude = null;
}

/**
 * AmplitudeService — wrapper for all Amplitude SDK interactions.
 * Never call the Amplitude SDK directly from screens/components — go through
 * this service, and in practice go through braze.ts's logEvent(), which fans
 * out to both. Gracefully no-ops when the native module or the API key is
 * missing, so dev builds and Expo Go are unaffected.
 *
 * 🔑 IDENTITY: setUserId() is always called with our DATABASE user id (the
 * same UUID Braze uses as its external_id). Any server-side events we add
 * later must use that same value as `user_id`, or the two halves become two
 * disjoint sets of users and no funnel spans them.
 *
 * Init is lazy — the first call does it — so nothing has to change in App.tsx
 * and there is no ordering hazard against the auth flow.
 */

const API_KEY: string =
  (Constants.expoConfig?.extra as any)?.amplitudeApiKey ?? "";

let initialized = false;
/** Set before init happens; replayed into init() so the first events are attributed. */
let pendingUserId: string | null = null;

function ready(): boolean {
  if (!Amplitude || !API_KEY) return false;
  if (initialized) return true;

  try {
    Amplitude.init(API_KEY, pendingUserId ?? undefined, {
      trackingOptions: {
        // The Android advertising ID — the one identifier the SDK can collect
        // that would need an ATT-style disclosure. We have no ATT prompt and no
        // ad attribution, so it stays off.
        adid: false,
        // 📌 There is deliberately NO `idfa` key here. ReactNativeTrackingOptions
        // exposes only adid / appSetId / idfv / carrier / country / device* /
        // ipAddress / language / os* / platform — this SDK never reaches for the
        // iOS advertising identifier at all, so there is nothing to disable. An
        // `idfa: false` would be silently ignored and create false confidence in
        // exactly the place we'd cite it (a privacy-label or App Review answer).
        // `idfv` and `appSetId` are left ON: both are vendor-scoped, need no ATT
        // prompt, and Amplitude uses them to derive a stable device id.
      },
    });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function setUserId(userId: string): void {
  pendingUserId = userId;
  if (!ready()) return;
  Amplitude.setUserId(userId);
}

export function logEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!ready()) return;
  Amplitude.track(eventName, properties);
}

export function setUserProperties(
  attrs: Record<string, string | number | boolean>,
): void {
  const entries = Object.entries(attrs).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  // Bail before touching the SDK when there is nothing to set. setUserAttributes()
  // forwards only name/email, so a call carrying just a date of birth would
  // otherwise send an empty $identify — a billable event that sets nothing.
  if (entries.length === 0) return;

  if (!ready()) return;
  const identify = new Amplitude.Identify();
  for (const [key, value] of entries) identify.set(key, value);
  Amplitude.identify(identify);
}

/**
 * Clear the current user. Called on logout and account deletion so the next
 * person on the device does not inherit the previous one's identity.
 */
export function reset(): void {
  pendingUserId = null;
  if (!ready()) return;
  Amplitude.reset();
}

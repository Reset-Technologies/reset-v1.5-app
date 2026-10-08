import * as AmplitudeService from "./amplitude";
import * as AdAttribution from "./adAttribution";

let Braze: any;
try {
  Braze = require("@braze/react-native-sdk").default;
} catch {
  // Native module not available (e.g. Expo Go / simulator dev build)
  Braze = null;
}

/**
 * 🔴 DEBUG BUILDS MUST NOT REACH BRAZE.
 *
 * The SDK keys in `app.config.ts` are hardcoded to production and are not
 * gated by build type, so a debug build signed into a test account creates a
 * REAL profile in the production workspace — indistinguishable from a member,
 * and eligible for real lifecycle sends once Braze owns them.
 *
 * The tell is a LOCAL database UUID sitting in production Braze. On
 * 2026-10-08 a single device-test session created one, and a sweep had to
 * submit 196 external_ids to clean up after device testing generally.
 *
 * 🔑 Nulling the module here is deliberate rather than guarding each call: all
 * five Braze call sites in this file already short-circuit on `if (!Braze)`,
 * because that is the path Expo Go has always taken. So this reuses an
 * exercised code path instead of adding an untested one, and no future call
 * site can forget the check.
 *
 * ⚠️ Release builds are UNAFFECTED, TestFlight and internal-track included —
 * those are close enough to production that push and campaign testing still
 * needs to work. This closes the debug/Metro hole, which is where the strays
 * actually came from. Set EXPO_PUBLIC_BRAZE_IN_DEV=1 to opt a dev build back
 * in deliberately.
 *
 * 📌 Amplitude and ad-attribution are intentionally left alone — they do not
 * send anyone an email. Worth revisiting separately for analytics hygiene.
 */
const BRAZE_ENABLED =
  !__DEV__ || process.env.EXPO_PUBLIC_BRAZE_IN_DEV === "1";
if (!BRAZE_ENABLED) {
  Braze = null;
}

/**
 * BrazeService — wrapper for all Braze SDK interactions.
 * Never call Braze SDK directly from screens/components — go through this service.
 * Gracefully no-ops when native module is unavailable.
 *
 * 🔑 This file is now the single analytics CHOKEPOINT: every event, identity
 * change and wipe fans out to Amplitude as well as Braze. That is why adding
 * Amplitude cost ~20 lines rather than 109 — all 109 call sites already came
 * through here. Keep it that way; a screen that calls a vendor SDK directly
 * silently reports to only one of them.
 *
 * 📌 Braze is NOT being replaced. Its events trigger the push/email campaigns,
 * so both destinations receive everything.
 *
 * 🔴 The ad-attribution destination is the ONE exception to "everything". It is
 * default-deny: it receives only the commercial-funnel events named in
 * services/adAttribution.ts, because ad vendors must never see health data.
 * Add an advertising SDK THERE, never here — see that file for why.
 * 📌 Follow-up: rename this module to `analytics.ts` (109 import sites). Left
 * for a separate PR so this one stays reviewable.
 */

export function changeUser(userId: string): void {
  // Both vendors key on our database user id, so a user is the same person in
  // Braze, in Amplitude, and in anything we add server-side later.
  AmplitudeService.setUserId(userId);
  AdAttribution.identify(userId);
  if (!Braze) return;
  Braze.changeUser(userId);
  Braze.requestImmediateDataFlush();
}

export function logEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  AmplitudeService.logEvent(eventName, properties);
  // Filtered: drops everything that isn't a commercial-funnel event.
  AdAttribution.send(eventName, properties);
  if (!Braze) return;
  Braze.logCustomEvent(eventName, properties);
  Braze.requestImmediateDataFlush?.();
}

export function setUserAttributes(attrs: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: { year: number; month: number; day: number };
}): void {
  // Amplitude has no dedicated name/email setters — they are ordinary user
  // properties there. Date of birth is deliberately not forwarded: it is the
  // one field here that is health-adjacent personal data, Braze needs it for
  // campaign targeting, and Amplitude does not.
  AmplitudeService.setUserProperties({
    ...(attrs.firstName && { firstName: attrs.firstName }),
    ...(attrs.lastName && { lastName: attrs.lastName }),
    ...(attrs.email && { email: attrs.email }),
  });

  if (!Braze) return;
  if (attrs.firstName) Braze.setFirstName(attrs.firstName);
  if (attrs.lastName) Braze.setLastName(attrs.lastName);
  if (attrs.email) Braze.setEmail(attrs.email);
  if (attrs.phone) Braze.setPhoneNumber(attrs.phone);
  if (attrs.dateOfBirth) {
    Braze.setDateOfBirth(
      attrs.dateOfBirth.year,
      attrs.dateOfBirth.month as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12,
      attrs.dateOfBirth.day,
    );
  }
}

export function setCustomAttribute(
  key: string,
  value: string | number | boolean,
): void {
  AmplitudeService.setUserProperties({ [key]: value });
  if (!Braze) return;
  Braze.setCustomUserAttribute(key, value);
}

export function wipeData(): void {
  // Called on logout and on account deletion. Clearing Amplitude's user matters
  // as much as Braze's — without it the next person to sign in on this device
  // inherits the previous user's identity.
  AmplitudeService.reset();
  AdAttribution.reset();
  if (!Braze) return;
  Braze.wipeData();
}

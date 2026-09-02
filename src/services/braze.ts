import * as AmplitudeService from "./amplitude";

let Braze: any;
try {
  Braze = require("@braze/react-native-sdk").default;
} catch {
  // Native module not available (e.g. Expo Go / simulator dev build)
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
 * 📌 Follow-up: rename this module to `analytics.ts` (109 import sites). Left
 * for a separate PR so this one stays reviewable.
 */

export function changeUser(userId: string): void {
  // Both vendors key on our database user id, so a user is the same person in
  // Braze, in Amplitude, and in anything we add server-side later.
  AmplitudeService.setUserId(userId);
  if (!Braze) return;
  Braze.changeUser(userId);
  Braze.requestImmediateDataFlush();
}

export function logEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  AmplitudeService.logEvent(eventName, properties);
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
  if (!Braze) return;
  Braze.wipeData();
}

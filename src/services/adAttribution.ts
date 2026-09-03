/**
 * adAttribution — the ONLY path from this app to an advertising vendor
 * (AppsFlyer, Meta, or anything else that measures ad spend).
 *
 * 🔴 Why this file exists, and why it exists BEFORE the vendor SDK does.
 *
 * Bryan, 2026-09-03: "anything going to Meta/AppsFlyer should stay limited to
 * the commercial funnel. No weight, scan, Type, biometric, medication, or other
 * health data."
 *
 * The obvious way to add an ad SDK to this codebase is to drop one line into
 * `logEvent()` in services/braze.ts, next to Amplitude and Braze. That is
 * exactly what the 2025 app (reset-app-v2) did, and it shipped weight logging,
 * face scans, food logs and coach messages to a third party — because that
 * chokepoint carries all 112 of our events and every destination there receives
 * everything.
 *
 * So the filter is written first and the vendor plugs in *underneath* it. There
 * is no test framework in this repo to assert the policy, which is precisely
 * why it is enforced by structure instead: nothing reaches a vendor except
 * through send(), and send() is default-deny.
 *
 * 📌 To add a vendor: implement `deliver()` below. Do not add a vendor call to
 * services/braze.ts, and do not call a vendor SDK from a screen.
 */

// ---------------------------------------------------------------------------
// POLICY — audit this section, not the code below it.
// ---------------------------------------------------------------------------

/**
 * The commercial funnel, and nothing else. These are the steps an ad platform
 * needs in order to attribute and optimise spend — they describe a purchase
 * decision, never a health state.
 *
 * 🔴 Before adding a name here, ask: does this event, or any property it
 * carries, describe the user's BODY or BEHAVIOUR rather than their commercial
 * relationship with us? If yes, it does not belong in this list at any price.
 *
 * Deliberately excluded, for the avoidance of doubt: every `onboarding_scan_*`
 * and `onboarding_pre_scan*` (biometric capture), `onboarding_type_reveal` and
 * `onboarding_type_summary_*` (metabolic Type), every `home_checkin_*` (energy,
 * stress, sleep), `check_in_completed`, all meal/food events, all Ester/chat
 * events, and `onboarding_camera_permission*`.
 */
const ALLOWED_EVENTS: ReadonlySet<string> = new Set([
  // Top of funnel — Tas's "quiz started".
  "onboarding_quiz",
  // Sign-up started / completed.
  "onboarding_account_gate",
  "onboarding_create_account_submitCTA",
  // Paywall and the purchase decision.
  "onboarding_paywall_view",
  "onboarding_paywall_subscribe", // intent (tap), not revenue
  "onboarding_paywall_purchased", // revenue — the acquisition event
  "onboarding_paywall_cancelled",
  "onboarding_paywall_failed",
]);

/**
 * Property keys allowed to accompany an allowed event. Default-deny applies to
 * properties too: an event name can be safe while a property on it is not, and
 * event properties are the easier thing to add without thinking.
 *
 * 🔴 `metabolic_type` must never appear here.
 */
const ALLOWED_PROPERTIES: ReadonlySet<string> = new Set([
  "plan", // "monthly" | "annual"
  "product_id", // store product identifier
  "price", // number, localized store price
  "currency", // ISO currency code
]);

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

export type EventProperties = Record<string, string | number | boolean>;

/**
 * Returns the properties safe to forward, or null when the event itself is not
 * permitted. Exported so the policy can be exercised directly.
 */
export function sanitize(
  eventName: string,
  properties?: EventProperties,
): EventProperties | null {
  if (!ALLOWED_EVENTS.has(eventName)) return null;
  if (!properties) return {};
  const safe: EventProperties = {};
  for (const key of Object.keys(properties)) {
    if (ALLOWED_PROPERTIES.has(key)) safe[key] = properties[key];
  }
  return safe;
}

/**
 * Hand an allowed event to the ad vendor. No vendor SDK is installed yet, so
 * this is where AppsFlyer's `logEvent` goes — inside the filter, never beside
 * it. Keep it defensive (the SDK may be absent in Expo Go / simulator builds),
 * matching services/amplitude.ts.
 */
function deliver(_eventName: string, _properties: EventProperties): void {
  // No advertising vendor is installed. Intentionally a no-op.
}

/** Forward an event to the ad vendor if — and only if — policy allows it. */
export function send(eventName: string, properties?: EventProperties): void {
  const safe = sanitize(eventName, properties);
  if (safe === null) return; // not a commercial-funnel event; dropped
  deliver(eventName, safe);
}

/**
 * Identify the user to the ad vendor.
 *
 * We pass our own database user id — the same value Braze and Amplitude key on
 * — so a person is one person across every tool, and so purchases recorded
 * server-side reconcile with ad-side attribution. It is an opaque UUID and
 * carries no personal or health information.
 */
export function identify(_userId: string): void {
  // No advertising vendor is installed. Intentionally a no-op.
}

/** Clear the ad vendor's identity on logout / account deletion. */
export function reset(): void {
  // No advertising vendor is installed. Intentionally a no-op.
}

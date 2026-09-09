import Constants from "expo-constants";
import { Platform } from "react-native";

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
 *
 * The vendor is AppsFlyer, reusing the account and the two app entries
 * (`id1478144712` / `com.betterwell.reset`) that the 2025 app already had.
 */

// 🔑 Imported as a TYPE and required at runtime, deliberately — not `any`.
// Every 7.x method takes a single params object, and a misspelt field is
// accepted silently by the native bridge and simply never happens. That is
// exactly how `trackingOptions: { idfa: false }` sat in services/amplitude.ts
// claiming a protection it was not performing: the SDK was typed `any`, so the
// whole call surface went unchecked and `tsc` stayed green. With no OTA, a
// silent no-op here costs a store release to discover. Typing it means a wrong
// param name fails the build instead.
// 📌 The type comes from @appsflyer-sdk/js-core-plugin rather than from
// react-native-appsflyer, which re-exports it. That is where AppsFlyer now
// owns it ("owned by @appsflyer-sdk/js-core-plugin now, not this repo", their
// index.ts), and it is the only importable spelling: react-native-appsflyer
// points `types` at its own index.ts (source, not a .d.ts), so importing from
// there pulls the
// package's SOURCE into our program — where a pre-existing `typeof jest` check
// fails to compile under our `strict` and cannot be silenced by skipLibCheck.
import type { AppsFlyerSDK } from "@appsflyer-sdk/js-core-plugin";

// Native module is unavailable in Expo Go and in any build made before this
// package was linked by prebuild. Load it defensively — same contract as
// services/amplitude.ts and services/revenuecat.ts — so importing this file
// never throws and every export below degrades to the no-op it was.
// ⚠️ Not merely absent: react-native-appsflyer 7.x THROWS at import time on the
// Old Architecture. This catch is what keeps that from taking the app down.
let AppsFlyer: AppsFlyerSDK | null;
try {
  AppsFlyer = require("react-native-appsflyer").default as AppsFlyerSDK;
} catch {
  AppsFlyer = null;
}

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
 * Deliberately excluded, for the avoidance of doubt: every `scan*` /
 * `onboarding_scan*` and `onboarding_pre_scan*` (biometric capture — note the
 * scan events carry the `onboarding_` prefix only during onboarding, so BOTH
 * spellings exist and neither belongs here), `onboarding_type_reveal` and
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
  // 🔑 AppsFlyer only reads revenue from these two RESERVED names. `price` and
  // `currency` above are stored as ordinary custom parameters and are invisible
  // as revenue — which is why they are not enough on their own. They stay
  // because they are what the rest of our analytics reads.
  // 🔴 This matters most for iOS SKAdNetwork: conversion values are computed
  // ON-DEVICE by the SDK, so RevenueCat's server-side purchase event cannot
  // drive them. Only what the app itself reports can, and until now the app
  // reported nothing AppsFlyer recognised as money — so every revenue-based
  // SKAN conversion value was unreachable no matter how it was configured.
  "af_revenue", // number, same value as `price`
  "af_currency", // ISO currency code, same value as `currency`
]);

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

export type EventProperties = Record<string, string | number | boolean>;

/**
 * Whether the signed-in account came from the legacy migration.
 *
 * 🔑 A migrated member is NOT an acquisition — they were already paying us,
 * often for years. Crediting an ad campaign with them would understate cost per
 * customer and push us to scale on a number that isn't real.
 *
 * In practice the allowlist already excludes most of that risk by construction:
 * a legacy member signs IN rather than up, so they never reach the quiz or the
 * account gate, and they never purchase because they skip the paywall on
 * existing entitlement. The one that does leak is
 * `onboarding_paywall_view` — it fires on mount, just before the legacy-skip
 * effect redirects them. Blocking here rather than at that one call site keeps
 * the guarantee true for anything added to the allowlist later.
 *
 * Null until the first profile sync. Unknown is treated as NOT legacy, because
 * the top-of-funnel events we most need happen before an account exists at all
 * — and a legacy member fires none of those.
 */
let isLegacyMember: boolean | null = null;

/** Called on every profile sync, from AppContext. */
export function setIsLegacyMember(value: boolean): void {
  isLegacyMember = value;
}

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

// ---------------------------------------------------------------------------
// Vendor: AppsFlyer
// ---------------------------------------------------------------------------

const DEV_KEY: string =
  (Constants.expoConfig?.extra as any)?.appsFlyerDevKey ?? "";
/** Apple ID of the App Store record, `id`-prefixed. iOS only; Android infers it. */
const IOS_APP_ID: string =
  (Constants.expoConfig?.extra as any)?.appsFlyerIosAppId ?? "";

let initCalled = false;
let started = false;

/** Set before the SDK is running; replayed on start so no identity is lost. */
let pendingUserId: string | null = null;

/** Resolvers waiting on getVendorId() while the SDK is still starting. */
let vendorIdWaiters: ((id: string | null) => void)[] = [];

/** Subscriber for a resolved OneLink destination, and the buffer for one that
 * arrives before anything is listening. */
type DeepLinkHandler = (path: string) => void;
let deepLinkHandler: DeepLinkHandler | null = null;
let pendingDeepLink: string | null = null;

/**
 * Subscribe to OneLink destinations resolved by the ad vendor.
 *
 * 🔑 A deferred deep link (install from an ad, then first launch) arrives
 * within a second or two of start-up, which is routinely BEFORE the navigator
 * has mounted. So one is buffered and replayed to the first subscriber —
 * otherwise the very case OneLink exists for is the case that silently drops.
 *
 * Returns an unsubscribe function.
 */
export function onDeepLink(handler: DeepLinkHandler): () => void {
  deepLinkHandler = handler;
  if (pendingDeepLink !== null) {
    const path = pendingDeepLink;
    pendingDeepLink = null;
    handler(path);
  }
  return () => {
    if (deepLinkHandler === handler) deepLinkHandler = null;
  };
}

function emitDeepLink(path: string): void {
  if (deepLinkHandler) deepLinkHandler(path);
  else pendingDeepLink = path;
}

/**
 * Pull the destination out of a OneLink payload.
 *
 * `deep_link_value` is AppsFlyer's modern, platform-neutral field and is what a
 * OneLink template should be configured to send. `deep_link_sub1` and the
 * legacy `af_dp` path are read as fallbacks so a link built the older way still
 * works — a link that resolves to nothing is indistinguishable, to the person
 * who tapped it, from the app being broken.
 *
 * The value is treated as a PATH into the existing `resetapp://` routing table,
 * so new destinations are configured in the AppsFlyer dashboard rather than
 * hardcoded here. Anything unrecognised is ignored by the router.
 */
function destinationFrom(deepLink: Record<string, unknown>): string | null {
  const candidate =
    deepLink.deep_link_value ?? deepLink.deep_link_sub1 ?? deepLink.af_dp;
  if (typeof candidate !== "string" || !candidate) return null;
  // Accept a bare path ("weekly-review") or a full resetapp:// URL.
  return candidate.replace(/^\w+:\/\//, "").replace(/^\/+/, "");
}

/**
 * Swallow a rejected SDK promise. Every 7.x method returns a Promise, and an
 * unhandled rejection from analytics must never surface as a redbox or a crash
 * in a screen that has nothing to do with advertising.
 */
function ignore(result: unknown): void {
  Promise.resolve(result).catch(() => {});
}

/**
 * Start the ad vendor. Call once, as early as possible — install attribution
 * depends on the SDK reporting the launch itself, not on any event we send.
 *
 * 🔑 react-native-appsflyer 7.x replaced `initSdk()` with `init()` + an explicit
 * `start()`, and native NEVER auto-starts. `start()` must be called from inside
 * `registerSessionReadyListener`; a bare call after `init()` is the documented
 * way to get a silently dead SDK. Listeners register synchronously right after
 * `init()` — never inside `init().then(...)`.
 */
export function init(): void {
  if (initCalled) return;
  // No key (or no native module) means no vendor, exactly as before this
  // existed. The key is a default in app.config.ts rather than an env-only
  // value precisely so this branch is never reached by accident.
  if (!AppsFlyer || !DEV_KEY) return;
  initCalled = true;

  try {
    // 🔴 BEFORE init(), and that ordering is not stylistic. Android delivers a
    // deep-link result exactly once and DISCARDS it permanently if no listener
    // is attached yet — there is no retry and no way to ask for it later. A
    // listener registered after init() would work in testing (where the link is
    // usually already resolved) and silently lose real deferred deep links.
    AppsFlyer.registerDeepLinkListener({
      onDeepLinking: (data) => {
        if (data.status !== "FOUND" || !data.deepLink) return;
        const path = destinationFrom(data.deepLink);
        if (path) emitDeepLink(path);
      },
    });

    ignore(AppsFlyer.init({ devKey: DEV_KEY, appId: IOS_APP_ID }));

    // ⚠️ A dev build reports to the REAL AppsFlyer account — there is no
    // separate dev app entry — so local runs show up as installs and sessions.
    // Same hazard as the Amplitude probe events. Debug logging is on here
    // precisely so those runs are identifiable while testing.
    if (__DEV__) {
      ignore(AppsFlyer.enableDebug({ enabled: true }));
    }

    // 🔴 iOS only, and deliberate. Without an ATT prompt the IDFA is unavailable
    // anyway, so turning it off costs nothing on iOS and makes the App Store
    // privacy answer ("Data Used to Track You: No") true by construction rather
    // than by assumption — this is the line we would cite in App Review.
    //
    // Android is left alone ON PURPOSE: the Play advertising id needs no prompt
    // and is how AppsFlyer matches an ad click to an install, so disabling it
    // would throw away the cleaner of our two attribution stories. That choice
    // is what obliges us to declare the advertising id on Play's Data safety
    // form — see the PR description.
    if (Platform.OS === "ios") {
      ignore(AppsFlyer.setDisableAdvertisingIdentifiers({ disable: true }));
    }

    const af = AppsFlyer;
    ignore(
      af.registerSessionReadyListener(() => {
        af.start().then(
          () => onStarted(af),
          () => {
            // started stays false: a failed start means the SDK is not
            // reporting, and pushing events into it would only look like it
            // works. Waiters are released rather than left hanging forever.
            flushVendorIdWaiters(null);
          },
        );
      }),
    );
  } catch {
    // Leave started=false so every path below stays a no-op.
  }
}

function onStarted(af: AppsFlyerSDK): void {
  started = true;
  if (pendingUserId) {
    ignore(af.setCustomerUserId({ customerId: pendingUserId }));
  }
  if (vendorIdWaiters.length === 0) return;
  af.getAppsFlyerUID().then(
    (id) => flushVendorIdWaiters(id ?? null),
    () => flushVendorIdWaiters(null),
  );
}

function flushVendorIdWaiters(id: string | null): void {
  const waiters = vendorIdWaiters;
  vendorIdWaiters = [];
  for (const resolve of waiters) resolve(id);
}

/**
 * The SDK, but only once it is genuinely reporting — null in every other state
 * (no native module, no key, init never called, start failed).
 *
 * 🔑 One accessor for the whole file so "is the vendor usable?" is asked in
 * exactly one place. It also gives the compiler the non-null narrowing, which
 * is what makes the typed SDK surface above worth having.
 */
function running(): AppsFlyerSDK | null {
  return started ? AppsFlyer : null;
}

/**
 * The vendor's own device identifier, once the SDK is running.
 *
 * Needed so RevenueCat can attach purchases to the same AppsFlyer device — the
 * store-verified purchase is the one revenue number we trust, and without this
 * id it reaches AppsFlyer unattached to the install that produced it. Resolves
 * null when there is no vendor, which is the same as "no ad attribution".
 */
export function getVendorId(): Promise<string | null> {
  const af = running();
  if (af) return af.getAppsFlyerUID().then((id) => id ?? null, () => null);
  // Not started, and never will be — resolve rather than wait forever.
  if (!AppsFlyer || !initCalled) return Promise.resolve(null);
  return new Promise((resolve) => vendorIdWaiters.push(resolve));
}

/**
 * Hand an allowed event to the ad vendor — inside the filter, never beside it.
 *
 * 📌 Only reached for an event that already passed send()'s policy checks, so
 * there is nothing to re-validate here. Resolving means "queued", not
 * "delivered": there is no client-side confirmation that AppsFlyer received it.
 */
function deliver(eventName: string, properties: EventProperties): void {
  const af = running();
  if (!af) return;
  try {
    ignore(af.logEvent({ eventName, eventValues: properties }));
  } catch {
    // An analytics failure must never break the screen that triggered it.
  }
}

/** Forward an event to the ad vendor if — and only if — policy allows it. */
export function send(eventName: string, properties?: EventProperties): void {
  if (isLegacyMember === true) return; // a migration, not an acquisition
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
export function identify(userId: string): void {
  // Recorded even when the SDK is not up yet: identify() runs on session
  // restore, which can beat init(), and onStarted() replays it.
  pendingUserId = userId;
  const af = running();
  if (!af) return;
  ignore(af.setCustomerUserId({ customerId: userId }));
}

/** Clear the ad vendor's identity on logout / account deletion. */
export function reset(): void {
  // Clear the legacy flag too: the next person to sign in on this device must
  // not inherit the previous account's status, in either direction.
  isLegacyMember = null;
  pendingUserId = null;
  const af = running();
  if (!af) return;
  // Empty string is AppsFlyer's documented way to delete the attribute. Leaving
  // the previous id in place would credit the next person to sign in on this
  // device to the account that just signed out.
  ignore(af.setCustomerUserId({ customerId: "" }));
}

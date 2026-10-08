import { Platform } from "react-native";
import Constants from "expo-constants";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

// Native module is unavailable in Expo Go / some simulator dev builds. Load it
// defensively (same pattern as services/braze.ts) so importing this file never
// throws — every export below no-ops when the SDK isn't present.
let Purchases: any;
let LOG_LEVEL: any;
try {
  const mod = require("react-native-purchases");
  Purchases = mod.default;
  LOG_LEVEL = mod.LOG_LEVEL;
} catch {
  Purchases = null;
  LOG_LEVEL = null;
}

/**
 * RevenueCatService — wrapper for all RevenueCat (react-native-purchases)
 * interactions. Never call the SDK directly from screens — go through here.
 *
 * The RevenueCat dashboard is not configured yet, so this is built to degrade
 * gracefully: with no public key (or no native module) `configured` stays
 * false, offering lookups return null, and the paywall falls back to its
 * static UI + plain completeOnboarding(). Once the dashboard exists and the
 * key lands in app.config extra, the same code path activates with no edits.
 */

// Entitlement identifier to create in the RevenueCat dashboard. A customer with
// this entitlement active === "pro". (Convention; rename here if the dashboard
// uses a different id.)
export const PRO_ENTITLEMENT_ID = "pro";

// Public SDK key for the current platform. These are the *public* keys (safe to
// ship in the bundle) — not the secret REST key.
const IOS_KEY: string =
  Constants.expoConfig?.extra?.revenueCatIosApiKey ?? "";
const ANDROID_KEY: string =
  Constants.expoConfig?.extra?.revenueCatAndroidApiKey ?? "";

function platformKey(): string {
  return Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
}

let configured = false;

/** True once configure() has run against a real key + native module. */
export function isRevenueCatConfigured(): boolean {
  return configured;
}

/**
 * Configure the SDK. Call once, as early as possible. Pass the backend user id
 * if it's already known so purchases attach to the right account; otherwise
 * RevenueCat starts anonymous and loginRevenueCat() aliases later.
 */
export function configureRevenueCat(appUserID?: string): void {
  if (configured) return;
  if (!Purchases) return; // native module missing
  const apiKey = platformKey();
  if (!apiKey) return; // dashboard not set up yet — stay unconfigured

  try {
    if (__DEV__ && LOG_LEVEL) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }
    Purchases.configure({ apiKey, appUserID: appUserID ?? null });
    configured = true;
  } catch {
    // Leave configured=false so the paywall falls back gracefully.
  }
}

/**
 * Tell RevenueCat which AppsFlyer device this customer is, so RevenueCat's
 * AppsFlyer integration can forward purchases against the right install.
 *
 * 🔑 This is the piece that makes revenue attributable. Purchases are the one
 * number we can trust — they are store-verified server-side — but a purchase
 * that reaches AppsFlyer with no device id cannot be tied back to the ad that
 * produced the install, so it lands as organic and understates every campaign.
 *
 * ⚠️ The integration also has to be switched on in the RevenueCat dashboard;
 * this call alone does nothing. Deliberately chosen over AppsFlyer's own
 * Purchase Connector — running both would count each purchase twice.
 */
export async function linkAdAttribution(appsflyerId: string): Promise<void> {
  if (!configured || !appsflyerId) return;
  try {
    await Purchases.setAppsflyerID(appsflyerId);
  } catch {
    // Attribution is best-effort; a failure here must not affect purchasing.
  }
}

/**
 * Associate the current RevenueCat identity with the backend user id.
 *
 * Returns whether the identity actually took. It used to return void and
 * swallow the failure with "purchases still work under the anonymous id" —
 * true, and precisely the problem: a purchase made under
 * `$RCAnonymousID:…` is never attributable to a member, our webhook skips
 * reconciliation for it, and nothing anywhere reports that it happened.
 */
export async function loginRevenueCat(appUserID: string): Promise<boolean> {
  if (!configured || !appUserID) return false;
  try {
    await Purchases.logIn(appUserID);
    return true;
  } catch {
    return false;
  }
}

/** The id RevenueCat currently transacts under, or null if unavailable. */
export async function currentAppUserId(): Promise<string | null> {
  if (!configured) return null;
  try {
    return (await Purchases.getAppUserID()) ?? null;
  } catch {
    return null;
  }
}

/** True when RevenueCat has no real identity and would transact anonymously. */
export function isAnonymousId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("$RCAnonymousID:");
}

/**
 * Make sure RevenueCat is transacting as the backend user BEFORE a purchase.
 *
 * 🔴 Why this exists, from a real production event (2026-10-05): a RENEWAL
 * arrived with `app_user_id`, `original_app_user_id` and the whole `aliases`
 * array all set to the SAME `$RCAnonymousID:…`. There was nothing to resolve
 * it against, so a paying App Store member on the 3-month plan is attached to
 * no account at all. 1 of 11 production events.
 *
 * 🔑 The cause is not one bug but three that compound: `loginRevenueCat()` was
 * fire-and-forget at both call sites, its failures were swallowed, and
 * `purchasePackage()` never checked who it was transacting as. Any one of them
 * is enough. This closes the last one, which is the only place it matters.
 */
export async function ensureIdentified(appUserID: string): Promise<boolean> {
  if (!configured || !appUserID) return false;
  const current = await currentAppUserId();
  if (current === appUserID) return true;
  if (!(await loginRevenueCat(appUserID))) return false;
  return (await currentAppUserId()) === appUserID;
}

/** Reset to a fresh anonymous identity (e.g. on sign-out). */
export async function logoutRevenueCat(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut throws if already anonymous — safe to ignore.
  }
}

/**
 * The current offering (its `availablePackages` carry the live, localized
 * store prices). Null when unconfigured or no offering is set as current.
 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  return (await getCurrentOfferingDetailed()).offering;
}

/**
 * Why there is no offering to sell. Three very different failures used to
 * collapse into one silent `null`, so the paywall could not tell "the SDK was
 * never configured" from "RevenueCat errored" from "nobody published a current
 * offering" — and logged none of them.
 *
 * 🔴 That blindness is what let the no-offering path run unnoticed for a week
 * of paid acquisition: at least 13 Android members reached the app without
 * paying and nothing recorded it. Every branch now names itself.
 */
export type OfferingUnavailableReason =
  | "not_configured"
  | "fetch_failed"
  | "no_current_offering"
  | "no_packages";

export async function getCurrentOfferingDetailed(): Promise<{
  offering: PurchasesOffering | null;
  reason: OfferingUnavailableReason | null;
}> {
  if (!configured) return { offering: null, reason: "not_configured" };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current ?? null;
    if (!current) return { offering: null, reason: "no_current_offering" };
    return { offering: current, reason: null };
  } catch {
    return { offering: null, reason: "fetch_failed" };
  }
}

/** Whether the pro entitlement is active on this customer. */
export function hasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements.active[PRO_ENTITLEMENT_ID];
}

export interface PurchaseOutcome {
  /** Pro entitlement is active after the purchase. */
  isPro: boolean;
  /** User dismissed the native purchase sheet — not a real error. */
  userCancelled: boolean;
  customerInfo: CustomerInfo | null;
  /** Set when the purchase failed for a reason other than cancellation. */
  error?: unknown;
  /**
   * False when the purchase had to go through under an anonymous RevenueCat
   * id. The sale still completes — blocking it would cost real revenue to
   * protect our own bookkeeping — but the caller MUST report it, because the
   * member is otherwise invisible to reconciliation and to lifecycle.
   */
  identified?: boolean;
}

/**
 * Buy a package from the current offering.
 *
 * Pass `appUserID` whenever the member is authenticated — the paywall always
 * is, since the account is created two screens earlier. It is optional only so
 * that callers without a user (there are none today) still compile.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
  appUserID?: string,
): Promise<PurchaseOutcome> {
  if (!configured) {
    return { isPro: false, userCancelled: false, customerInfo: null };
  }
  // 🔑 Identify BEFORE transacting. See ensureIdentified() for the production
  // event that motivated this.
  let identified = true;
  if (appUserID) {
    identified = await ensureIdentified(appUserID);
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    // 🔑 If it had to go through anonymously, try once more AFTER the fact.
    // RevenueCat aliases the anonymous id to the real one on logIn, which
    // makes every SUBSEQUENT event for this subscription resolvable — the
    // renewal we lost on 2026-10-05 would have been caught by this.
    if (!identified && appUserID) {
      await loginRevenueCat(appUserID);
    }
    return {
      isPro: hasProEntitlement(customerInfo),
      userCancelled: false,
      customerInfo,
      identified,
    };
  } catch (e: any) {
    if (e?.userCancelled) {
      return { isPro: false, userCancelled: true, customerInfo: null, identified };
    }
    return { isPro: false, userCancelled: false, customerInfo: null, error: e, identified };
  }
}

export interface RestoreOutcome {
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  error?: unknown;
}

/** Restore prior purchases (App Store requires a restore affordance). */
export async function restorePurchases(): Promise<RestoreOutcome> {
  if (!configured) return { isPro: false, customerInfo: null };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { isPro: hasProEntitlement(customerInfo), customerInfo };
  } catch (e) {
    return { isPro: false, customerInfo: null, error: e };
  }
}

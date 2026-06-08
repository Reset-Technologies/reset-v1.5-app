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

/** Associate the current RevenueCat identity with the backend user id. */
export async function loginRevenueCat(appUserID: string): Promise<void> {
  if (!configured || !appUserID) return;
  try {
    await Purchases.logIn(appUserID);
  } catch {
    // Best-effort; purchases still work under the anonymous id.
  }
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
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
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
}

/** Buy a package from the current offering. */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  if (!configured) {
    return { isPro: false, userCancelled: false, customerInfo: null };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return {
      isPro: hasProEntitlement(customerInfo),
      userCancelled: false,
      customerInfo,
    };
  } catch (e: any) {
    if (e?.userCancelled) {
      return { isPro: false, userCancelled: true, customerInfo: null };
    }
    return { isPro: false, userCancelled: false, customerInfo: null, error: e };
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

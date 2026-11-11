import { Platform } from "react-native";
import Constants from "expo-constants";
import type {
  CustomerInfo,
  PricingPhase,
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

/**
 * What we are allowed to TELL the member about an introductory offer.
 *
 * 🔴 FAIL CLOSED, AND THAT IS THE WHOLE POINT OF THIS TYPE. `product.introPrice`
 * is a property of the PRODUCT; eligibility is a property of the USER. An
 * introductory offer is once per Apple ID per subscription group, so a
 * returning member can see a product that advertises "$1 for 3 months" and
 * still be charged full price by Apple at the sheet.
 *
 * The two mistakes are not symmetric:
 *   - promise $1, charge $19.99  -> we lied, at the worst possible moment, and
 *     it is exactly the ad/paywall/sheet mismatch this work exists to prevent
 *   - show $19.99, charge $1     -> a pleasant surprise
 * So `eligible` is returned ONLY on an explicit ELIGIBLE from the SDK. UNKNOWN
 * is treated as not eligible.
 *
 * 🔑 This also makes Android correct for free: `checkTrialOrIntroductoryPriceEligibility`
 * is iOS-only and **Android ALWAYS returns INTRO_ELIGIBILITY_STATUS_UNKNOWN**
 * (verified in the installed SDK's own docstring, react-native-purchases
 * 10.11.0), so Android never renders an offer it cannot honour.
 */
export type IntroOfferState =
  | {
      kind: "eligible";
      /** First-period price actually charged, e.g. 1 for "$1/mo for 3 months". */
      price: number;
      priceString: string;
      /** How many billing periods the discount lasts, e.g. 3. */
      cycles: number;
      /** DAY | WEEK | MONTH | YEAR */
      periodUnit: string;
      periodNumberOfUnits: number;
    }
  | { kind: "ineligible" }
  | { kind: "none" }
  | { kind: "unknown" };

/** Only this state may be shown or charged against as an offer. */
export function isIntroEligible(
  s: IntroOfferState,
): s is Extract<IntroOfferState, { kind: "eligible" }> {
  return s.kind === "eligible";
}

/**
 * Resolve whether THIS member may actually have the intro offer on `pkg`.
 *
 * ⚠ Resolved at paywall load, while the purchase happens later. The authoritative
 * record of what Apple charged is the server-side RevenueCat event payload
 * (`revenuecat_event.payload`), not this. Anything the client reports is
 * "what we displayed", which is the honest claim and the one worth measuring
 * the ad against.
 */
/**
 * Resolve a Google Play introductory offer from the product's
 * `subscriptionOptions`, which is the raw list `introPrice` is derived from.
 *
 * 🔑 ELIGIBILITY IS GOOGLE'S ANSWER, NOT OURS. Android has no equivalent of
 * iOS's `checkTrialOrIntroductoryPriceEligibility` — it always returns
 * UNKNOWN. We do not need one: for the store-determined criteria ("New
 * customer acquisition", "Upgrade") Play removes offers the customer cannot
 * have from `subscriptionOptions` before the SDK ever sees them, so an offer
 * being present IS the eligibility signal.
 * ⚠️ That holds ONLY for store-determined criteria. An offer set to
 * "Developer determined" is returned to EVERY customer, and this function
 * would then promise a price Google will not honour. The Play offer must stay
 * on "New customer acquisition".
 *
 * 🔑 Mirrors RevenueCat's own `defaultOffer` selection so the price we DISPLAY
 * is the price its automatic offer application will CHARGE: skip the base
 * plan, skip the two reserved tags, and take the cheapest non-free intro
 * phase. Divergence between those two is the whole bug class this screen
 * exists to avoid.
 *
 * 📌 The LAST pricing phase is the recurring full price; offer phases precede
 * it, which is why the tail is dropped. A zero-price phase is a free trial,
 * not an introductory price, and is deliberately ignored — we have no trial
 * and no approved copy for one.
 */
function androidIntroOffer(pkg: PurchasesPackage): IntroOfferState | null {
  const options = pkg.product.subscriptionOptions;

  // ⚠️⚠️ TEMPORARY DIAGNOSTIC — REMOVE BEFORE PROMOTING TO PRODUCTION.
  // Present so that ONE internal build can distinguish "the offer is in
  // subscriptionOptions and we were reading the wrong field" from "Play is
  // not returning the offer to the SDK at all", instead of costing another
  // build cycle. Reads in `adb logcat | grep ReactNativeJS`. No PII — product
  // ids, tags and prices only.
  try {
    console.log(
      "[introOffer]",
      pkg.product.identifier,
      JSON.stringify({
        introPrice: pkg.product.introPrice,
        defaultOption: pkg.product.defaultOption?.id ?? null,
        options: options?.map((o) => ({
          id: o.id,
          isBasePlan: o.isBasePlan,
          tags: o.tags,
          phases: o.pricingPhases.map((p) => p.price.formatted),
        })),
      }),
    );
  } catch {
    // Diagnostics must never break the paywall.
  }

  if (!options?.length) return null;

  let best: PricingPhase | null = null;
  for (const option of options) {
    if (option.isBasePlan) continue;
    if (
      option.tags?.some(
        (t) => t === "rc-ignore-offer" || t === "rc-customer-center",
      )
    ) {
      continue;
    }
    for (const phase of option.pricingPhases.slice(0, -1)) {
      if (phase.price.amountMicros <= 0) continue;
      if (!best || phase.price.amountMicros < best.price.amountMicros) {
        best = phase;
      }
      break;
    }
  }
  if (!best) return null;

  return {
    kind: "eligible",
    // Micros, unlike iOS's `introPrice.price`, which is already in currency
    // units. `af_revenue` and the purchase events read this, so the conversion
    // is not cosmetic.
    price: best.price.amountMicros / 1_000_000,
    priceString: best.price.formatted,
    // `billingCycleCount` is null for infinite/finite-recurring phases; an
    // offer phase without a count runs for one period.
    cycles: best.billingCycleCount ?? 1,
    periodUnit: best.billingPeriod.unit,
    periodNumberOfUnits: best.billingPeriod.value,
  };
}

export async function getIntroOffer(
  pkg: PurchasesPackage | null,
): Promise<IntroOfferState> {
  if (!configured || !Purchases || !pkg) return { kind: "unknown" };

  // 🔴🔴 ANDROID IS RESOLVED FIRST, AND NOT FROM `introPrice`.
  // Measured on an S24 (2026-11-11) against a live Play offer that Google was
  // demonstrably serving — its own purchase sheet showed $0.99 then $19.99 —
  // `product.introPrice` came back NULL and the card rendered the base plan
  // price. `introPrice` is mapped from `defaultOption` alone, so it reports
  // nothing whenever `defaultOption` resolves to the base plan, while the
  // offer still sits in `subscriptionOptions` and is still what Google
  // charges. Reading the options directly removes that dependency.
  if (Platform.OS === "android") {
    return androidIntroOffer(pkg) ?? { kind: "none" };
  }

  const intro = pkg.product.introPrice;
  if (!intro) return { kind: "none" };

  // 🔴 A zero-price phase is a FREE TRIAL, not an introductory price. Both
  // platforms report the free phase in PREFERENCE to a discounted one, so a
  // trial configured later would arrive here looking like an intro offer and
  // the card ("First 3 months" above a price) would render it as "$0.00".
  // We have no trial and no approved copy for one, so make no claim rather
  // than a wrong one: the card falls back to list price, exactly as it
  // behaved before offers existed.
  if (intro.price <= 0) return { kind: "unknown" };

  const eligible: IntroOfferState = {
    kind: "eligible",
    price: intro.price,
    priceString: intro.priceString,
    cycles: intro.cycles,
    periodUnit: intro.periodUnit,
    periodNumberOfUnits: intro.periodNumberOfUnits,
  };

  try {
    const map = await Purchases.checkTrialOrIntroductoryPriceEligibility([
      pkg.product.identifier,
    ]);
    const status = map?.[pkg.product.identifier]?.status;
    // 2 === INTRO_ELIGIBILITY_STATUS_ELIGIBLE. Compared numerically so this
    // does not depend on importing the enum through the defensive require above.
    if (status === 2) return eligible;
    if (status === 1) return { kind: "ineligible" };
    if (status === 3) return { kind: "none" };
    return { kind: "unknown" };
  } catch {
    // An eligibility call that throws must not become an offer claim.
    return { kind: "unknown" };
  }
}

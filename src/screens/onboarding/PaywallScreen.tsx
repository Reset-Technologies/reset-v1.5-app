import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PurchasesPackage } from "react-native-purchases";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { logEvent } from "../../services/braze";
import { logout } from "../../services/auth";
import {
  getCurrentOffering,
  purchasePackage,
  restorePurchases,
} from "../../services/revenuecat";
import { setSubscriptionTierDev, getProfile } from "../../services/profile";
import {
  rootNavigationRef,
  navigateWhenMounted,
} from "../../navigation/rootNavigationRef";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "../../constants/legal";
import {
  ArrowBackIcon,
  ResetMarkIcon,
  TypeMeaningIcon,
  MealsIcon,
  GuidanceIcon,
} from "../../components/PaywallIcons";

type Props = NativeStackScreenProps<any, "Paywall">;

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;


// Top inset above the logo + "reset pro". The 60px design value is sized for
// the iPhone notch; the S24's status bar is smaller, so the title block sits
// needlessly low and eats vertical room. Scale it down on short screens (down
// to 36) while keeping the full 60 at iPhone-16-Pro height (~852dp) and above.
const TOP_PAD = Math.round(
  Math.max(36, Math.min(60, 36 + (SCREEN_H - 780) * (24 / 72))),
);

const MAROON_ALT = "#513436"; // page-surface-(alt)
const MAROON = "#361416";
const WHITE = "#FAFDFE";
const BONE = "#F3EFE3";
const TEXT_ALT = "#B0A3A4";
const DIVIDER = "#7E6869";


// Screen Copy row 14 is SUPERSEDED here. Bryan replaced the four benefit rows
// with these three on 2026-09-30, after the Sheet was written — later artefact
// wins. The Pro/Free comparison table went with them: there is no free tier to
// compare against.
//
// 🔴 Copy is Bryan's, not the frame's. Figma renders line 3 as "...works BEST
// for you"; his message says "works for you". Using his.
const VALUE_LINES: { Icon: (p: { size?: number; color?: string }) => React.JSX.Element; label: string }[] = [
  { Icon: TypeMeaningIcon, label: "Understand what your Type means" },
  { Icon: MealsIcon, label: "Get meals built to help you lose weight" },
  {
    Icon: GuidanceIcon,
    label: "Get guidance that adapts as Reset learns what works for you",
  },
];


// Shown before the RevenueCat offering loads, or when the dashboard isn't set
// up yet (no offering available). Once live packages load, the real localized
// store prices replace these. Keep in sync with the Figma defaults.
const FALLBACK_MONTHLY = { price: "$19.99", billed: "Billed monthly" };
const FALLBACK_YEARLY = {
  price: "$149.99",
  unit: "$12.49/mo",
  billed: "Billed annually",
  saleTag: "Save 37%",
};

// Format `amount` using the symbol/placement of a reference localized price
// string (e.g. "$19.99" → "$12.49"; "19,99 €" → "12,49 €"). Lets us render a
// per-month figure for the yearly plan without a full Intl currency formatter
// (Hermes' Intl currency support is unreliable on-device).
function formatLikePrice(amount: number, refPriceString: string): string {
  const prefix = refPriceString.match(/^[^\d]*/)?.[0] ?? "";
  const suffix = refPriceString.match(/[^\d]*$/)?.[0] ?? "";
  return `${prefix}${amount.toFixed(2)}${suffix}`;
}

// Display fields derived from a live monthly + annual package pair.
interface PlanDisplay {
  monthly: { price: string; billed: string };
  yearly: { price: string; unit?: string; billed: string; saleTag?: string };
}

function buildPlanDisplay(
  monthly: PurchasesPackage | null,
  annual: PurchasesPackage | null,
): PlanDisplay {
  const display: PlanDisplay = {
    monthly: FALLBACK_MONTHLY,
    yearly: FALLBACK_YEARLY,
  };
  if (monthly) {
    display.monthly = {
      price: monthly.product.priceString,
      billed: "Billed monthly",
    };
  }
  if (annual) {
    const perMonth = formatLikePrice(
      annual.product.price / 12,
      annual.product.priceString,
    );
    let saleTag: string | undefined;
    if (monthly) {
      const pct = Math.round(
        (1 - annual.product.price / (monthly.product.price * 12)) * 100,
      );
      if (pct > 0) saleTag = `Save ${pct}%`;
    }
    display.yearly = {
      price: annual.product.priceString,
      unit: `${perMonth}/mo`,
      billed: "Billed annually",
      saleTag,
    };
  }
  return display;
}

function CloseIcon({ color = WHITE, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6L18 18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * The face-down Type cards above the headline — Bryan asked for "something that
 * feels like the unrevealed Type instead of the small Reset mark" (2026-09-30).
 *
 * 🔴 Face-DOWN is the whole point: the Type is still hidden until purchase, so
 * these show the brand mark and blank skeleton rows, never a Type name, colour
 * or mascot. Anything that leaks the Type gives away what the paywall sells.
 */
function TypeCardStack() {
  return (
    <View style={styles.cardStack}>
      <View style={[styles.faceCard, styles.faceCardBack]}>
        <FaceCardContent />
      </View>
      <View style={[styles.faceCard, styles.faceCardMid]}>
        <FaceCardContent />
      </View>
      <View style={[styles.faceCard, styles.faceCardFront]}>
        <FaceCardContent />
      </View>
    </View>
  );
}

function FaceCardContent() {
  return (
    <>
      <View style={styles.faceCardLogo}>
        <ResetMarkIcon size={36} color={MAROON} />
      </View>
      <View style={styles.skeletonGroup}>
        <View style={[styles.skeletonBar, styles.skeletonTitle]} />
        <View style={styles.skeletonBar} />
        <View style={styles.skeletonBar} />
      </View>
    </>
  );
}

function PlanCard({
  label,
  unit,
  price,
  billed,
  variant,
  selected,
  saleTag,
  onPress,
}: {
  label: string;
  unit?: string;
  price: string;
  billed: string;
  variant: "monthly" | "yearly";
  selected: boolean;
  saleTag?: string;
  onPress: () => void;
}) {
  const radiiStyle =
    variant === "monthly" ? styles.planRadiiMonthly : styles.planRadiiYearly;
  const stateStyle = selected ? styles.planSelected : styles.planUnselected;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.planCard, radiiStyle, stateStyle]}
    >
      {/* Selected fill is a fade from 24% white at the top to nothing, not a
          flat tint — clipped by the card's own radii via overflow:hidden. */}
      {selected ? (
        <View style={[StyleSheet.absoluteFill, radiiStyle, styles.planSheen]} pointerEvents="none">
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="planSheen" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={WHITE} stopOpacity="0.24" />
                <Stop offset="1" stopColor={WHITE} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#planSheen)" />
          </Svg>
        </View>
      ) : null}
      {saleTag ? (
        <View style={styles.saleTag}>
          <Text style={styles.saleTagText}>{saleTag}</Text>
        </View>
      ) : null}
      <Text style={styles.planTitle}>{label}</Text>
      <View style={styles.planPrice}>
        {unit ? <Text style={styles.planUnit}>{unit}</Text> : null}
        <Text style={styles.planPriceText}>{price}</Text>
        <Text style={styles.planBilled}>{billed}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function PaywallScreen({ navigation }: Props) {
  const {
    state,
    setHomeV2Enabled,
    setSubscriptionTier,
    clearAuth,
  } = useApp();
  const toast = useToast();
  // Gate mode: the Paywall doubles as a hard wall for free users who have
  // already finished onboarding (RootNavigator routes them here instead of
  // Main). In that mode there is no "skip into the app" — subscribing flips the
  // tier to 'pro', which re-renders RootNavigator straight into Main.
  const isGate = state.user.hasCompletedOnboarding;

  // Sign out — the only way off this screen for someone signed in to the WRONG
  // account. A returning member who used "Continue with Apple" (Hide My Email)
  // lands here in a brand-new free account while their real subscription sits
  // on a different email, and "Restore Purchase" can't see a Stripe
  // subscription. Before this link their only exit was deleting the app — and
  // on Android even that fails, because Auto Backup restores the session.
  // (Support case, 2026-09-13.)
  //
  // Same teardown as Settings: logout() then clearAuth(). NOT resetState(),
  // which also clears hasCompletedOnboarding and would march a gate-mode member
  // back through the whole education carousel instead of straight to sign-in.
  //  - Gate mode: RootNavigator falls through to the Auth stack (Login) by
  //    itself once isAuthenticated flips.
  //  - Onboarding mode: RootNavigator checks the Onboarding branch before auth,
  //    so the member would stay on this paywall with no session — replace to
  //    the onboarding stack's Login route explicitly. Never in gate mode:
  //    GateNavigator has no Login route and the call would throw.
  // The event is logged BEFORE logout(), which wipes the Braze identity.
  const handleSignOut = () => {
    Alert.alert("Sign out?", "You can sign in with a different account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          logEvent("onboarding_paywall_signOutCTA", { gate: isGate });
          await logout();
          clearAuth();
          if (!isGate) navigation.replace("Login");
        },
      },
    ]);
  };
  // Yearly is the default per Figma (the highlighted card on first render).
  const [selectedPlan, setSelectedPlan] = React.useState<"monthly" | "yearly">(
    "yearly"
  );
  const [monthlyPkg, setMonthlyPkg] = React.useState<PurchasesPackage | null>(
    null,
  );
  const [annualPkg, setAnnualPkg] = React.useState<PurchasesPackage | null>(
    null,
  );
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  React.useEffect(() => {
    logEvent("onboarding_paywall_view");
  }, []);

  // Load the current RevenueCat offering for live, localized prices. Returns
  // null until the dashboard is configured — the cards then keep their static
  // fallback prices and Subscribe just completes onboarding.
  React.useEffect(() => {
    let cancelled = false;
    getCurrentOffering().then((offering) => {
      if (cancelled || !offering) return;
      const pkgs = offering.availablePackages;
      const monthly =
        offering.monthly ??
        pkgs.find((p) => p.packageType === "MONTHLY") ??
        null;
      const annual =
        offering.annual ??
        pkgs.find((p) => p.packageType === "ANNUAL") ??
        null;
      setMonthlyPkg(monthly);
      setAnnualPkg(annual);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ester's line. Bryan signed off on the design WITH this card (2026-09-30),
  // so it renders.
  //
  // 🔴 THE STRING IS LANG'S PLACEHOLDER FROM THE FRAME, NOT APPROVED COPY, and
  // it is the same for everyone — the opposite of what Bryan actually asked
  // for ("generated in the moment… specific to that person"). It ships as a
  // holding line because it is the one thing here that is true for every
  // member regardless of path: every member answers the energy question, and
  // it claims nothing about a scan, so it is safe for scanners and skippers
  // alike. That is the ONLY reason it is safe to render today.
  //
  // ▶ Replace with the generator once `scan-insights` reads onboarding answers
  // (see the notes on that service). Until then, do not let this line grow
  // into anything that asserts a reading we have not actually taken.
  const esterLine: string | null = "Your energy levels are telling me something.";

  const plans = buildPlanDisplay(monthlyPkg, annualPkg);

  // Shared exit path: flip to the new home, finish onboarding, then deep-link
  // into the post-onboarding meal flow once the Main stack has mounted.
  const proceedToApp = () => {
    setHomeV2Enabled(true);
    // Onboarding IS the Reset Window introduction for a new member (education
    // card → the two survey questions → the recommendation on the score card),
    // so consume the one-time intro here. Without this they finish onboarding
    // and are immediately "introduced" to a feature they were just taught.
    // The handoff STATE_MACHINE is explicit that the full-screen intro is for
    // EXISTING members: "New users reach [UNASSIGNED] after paid unlock.
    // Existing users see the full-screen Window intro once."
    // Keyed on having actually ANSWERED the onboarding Window question, not
    // merely on !isGate: a returning legacy member reaches here with
    // hasCompletedOnboarding false but arrives via WelcomeBack, skipping the
    // education carousel and the survey entirely. They never met the feature,
    // so they must still get the intro.
    // 📌 The window-intro mark moved to TypeRevealScreen with the rest of the
    // onboarding handoff — it belongs wherever onboarding actually ends, and
    // that is no longer here.

    // 🔴 The purchase is not the end of onboarding any more — it is the middle.
    // Bryan's V1 flow (2026-09-29) is Type ready → Paywall → reveal → Deep Read
    // → first meal → Home, so the member has paid precisely to see the reveal
    // that now follows.
    //
    // completeOnboarding() must NOT run here in that case. RootNavigator
    // branches on hasCompletedOnboarding FIRST, so flipping it would swap the
    // root stack out from under us and drop the member on Home — skipping the
    // thing they just bought. TypeRevealScreen owns the handoff instead, at the
    // end of its card stack.
    //
    navigation.replace("TypeReveal");

  };

  /**
   * The reveal a gate member just paid for. Bryan chose "#2" (2026-09-29): the
   * reveal only, then Home — they have been through onboarding once, so
   * replaying the Deep Read and meal cards would read as sitting through it
   * again immediately after paying.
   *
   * 🔑 Separate from proceedToApp deliberately. That is the ONBOARDING
   * completion handoff: it flips homeV2 on and hands off to NextMeal, neither
   * of which should happen to an existing member who simply bought a
   * subscription.
   *
   * 🔑 And it has to render from the MAIN stack. Purchasing flips the tier to
   * "pro", which re-renders RootNavigator out of Gate and into Main — this
   * screen is already unmounting — hence the same deferred rootNavigationRef
   * dispatch the onboarding handoff uses.
   */
  const revealAfterGatePurchase = () => {
    // Waits for Main to exist rather than guessing a delay — the tier flip
    // re-renders the root and `isReady()` only reports the container, not the
    // stack. A fixed timeout here would drop the reveal on a slow device, which
    // is precisely the bug this whole branch exists to fix.
    navigateWhenMounted("Main", () => {
      (rootNavigationRef as any).navigate("Main", {
        screen: "TypeReveal",
        params: { revealOnly: true },
      });
    });
  };

  /**
   * RES-207 — a returning BetterWell member already pays. Their subscription
   * lives in Stripe, and the backend grants it durably via `legacyEntitlement`
   * (a separate column, because the RevenueCat webhook overwrites
   * `subscriptionTier` and would otherwise downgrade them into this very
   * screen). Showing them a paywall would be asking them to buy what they
   * already own — the single worst moment in this migration.
   *
   * Deliberately requires BOTH the legacy flag and an entitled tier. Tier
   * alone is not safe to key on: it defaults optimistically before the
   * backend confirms, so a lone tier check could wave ordinary new users
   * straight past the paywall. `isReturningLegacyMember` is only ever true
   * for an account the legacy bridge just created.
   */
  const isEntitledReturningMember =
    state.legacy.isReturningLegacyMember &&
    state.user.subscriptionTier === "pro";

  React.useEffect(() => {
    if (isGate || !state.legacy.isReturningLegacyMember) return;

    if (isEntitledReturningMember) {
      logEvent("legacy_paywall_skipped");
      proceedToApp();
      return;
    }

    // Returning member, but the tier says otherwise. Login hydrates it, so
    // this only happens if that call failed. Ask once more before showing a
    // paying member a paywall — their subscription is in Stripe, so the
    // "Restore purchases" button here would not help them.
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (cancelled || profile.subscriptionTier !== "pro") return;
        setSubscriptionTier("pro");
        logEvent("legacy_paywall_skipped", { via: "retry" });
        proceedToApp();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Runs once: proceedToApp completes onboarding and re-roots the navigator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revenue-bearing properties for the paywall outcome events. Read off the
  // live RevenueCat package so the numbers are the localized store prices the
  // user actually saw, not the hardcoded copy on this screen.
  const packageProps = (pkg: PurchasesPackage | null) => ({
    plan: selectedPlan,
    ...(pkg
      ? {
          product_id: pkg.product.identifier,
          price: pkg.product.price,
          currency: pkg.product.currencyCode,
        }
      : {}),
  });

  /**
   * packageProps PLUS the revenue AppsFlyer can actually read.
   *
   * 🔑 AppsFlyer recognises money ONLY under the reserved names af_revenue /
   * af_currency; `price` and `currency` above are ordinary custom parameters to
   * it. Both are sent, deliberately — Braze and Amplitude read `price`, so
   * renaming would silently break the two destinations that already work.
   *
   * 🔴 ONLY for onboarding_paywall_purchased. packageProps() is shared with
   * `cancelled` and `failed`, and BOTH of those reach AppsFlyer through the
   * allowlist — attaching revenue there would book money against purchases that
   * never happened, and on iOS would fire a revenue SKAdNetwork conversion
   * value on a failure. Same reason renewals must not share the initial
   * purchase's event name in the RevenueCat→AppsFlyer mapping.
   *
   * 🔴 This is also what makes iOS SKAN revenue reachable at all: conversion
   * values are computed ON-DEVICE by the SDK, so RevenueCat's server-side
   * purchase event cannot drive them — only what the app itself reports can.
   */
  const purchaseProps = (pkg: PurchasesPackage | null) => ({
    ...packageProps(pkg),
    ...(pkg
      ? {
          af_revenue: pkg.product.price,
          af_currency: pkg.product.currencyCode,
        }
      : {}),
  });

  const handleSubscribe = async () => {
    if (purchasing || restoring) return;
    // INTENT, not revenue: this fires on the tap, before the store sheet opens.
    // "Cost per paid signup" must be built on onboarding_paywall_purchased
    // below — counting this one includes every cancel and every failure.
    logEvent("onboarding_paywall_subscribe", { plan: selectedPlan });

    // Local/dev builds can't complete a real purchase (RevenueCat isn't wired
    // for Android, and the simulator has no StoreKit), so Subscribe instantly
    // grants pro and proceeds — letting post-paywall screens be tested.
    // Compiled out of production builds via __DEV__. Mirrors the
    // successful-purchase path below. We also persist the tier to the backend
    // (local-env-gated server-side) so the grant survives re-login rather than
    // living only in client state; a backend failure still flips locally so the
    // shortcut never dead-ends.
    if (__DEV__) {
      try {
        await setSubscriptionTierDev("pro");
      } catch {
        // Non-fatal: keep the local unblock working even if the backend is down.
      }
      setSubscriptionTier("pro");
      // Deliberately NO purchase event here — no money moved. Dev-build events
      // land in the real Amplitude project, so firing one would put fabricated
      // revenue in the same funnel the ad spend is judged on.
      //
      // Mirrors the real success path on BOTH sides, which is the point of the
      // shortcut: without the gate branch, the reveal a gate member paid for
      // could not be exercised in a dev build at all.
      if (isGate) revealAfterGatePurchase();
      else proceedToApp();
      return;
    }

    const pkg = selectedPlan === "monthly" ? monthlyPkg : annualPkg;
    if (!pkg) {
      // No live package. In onboarding we never block the flow; in the gate we
      // must not grant free access, so surface an error and stay on the wall.
      if (isGate) {
        toast.show({ message: "Couldn't load subscription. Please try again." });
      } else {
        proceedToApp();
      }
      return;
    }
    setPurchasing(true);
    const outcome = await purchasePackage(pkg);
    if (outcome.userCancelled) {
      logEvent("onboarding_paywall_cancelled", packageProps(pkg));
      setPurchasing(false);
      return;
    }
    if (outcome.error) {
      // The purchase failed, but the user may already own the subscription
      // (reinstall, new device, or a StoreKit "already subscribed" state where
      // purchasePackage throws instead of completing). Try a restore before
      // surfacing an error — if it recovers pro, treat it as success so the
      // wall self-heals instead of dead-ending on the "try again" toast.
      const restored = await restorePurchases();
      setPurchasing(false);
      if (restored.isPro) {
        // Recovered an EXISTING subscription — no new revenue. Kept distinct
        // from onboarding_paywall_purchased so a reinstall never inflates CAC.
        logEvent("onboarding_paywall_recovered", packageProps(pkg));
        setSubscriptionTier("pro");
        if (isGate) revealAfterGatePurchase();
        else proceedToApp();
      } else {
        logEvent("onboarding_paywall_failed", packageProps(pkg));
        toast.show({
          message: "Purchase couldn't be completed. Please try again.",
        });
      }
      return;
    }
    setPurchasing(false);
    if (outcome.isPro) {
      // THE revenue event. Fires only here: a completed purchase that actually
      // granted the entitlement. This is the one to build cost-per-acquisition
      // on, and the one to forward to the ad platforms.
      logEvent("onboarding_paywall_purchased", purchaseProps(pkg));
      // Optimistic local flip; the backend reconciles via RevenueCat webhook
      // and getProfile() re-syncs the tier on next launch. In the gate this
      // re-renders RootNavigator into Main — which is exactly why the reveal
      // has to be dispatched INTO the Main stack rather than pushed here.
      setSubscriptionTier("pro");
    } else {
      // Neither cancelled nor errored, yet no entitlement — the store reported
      // success but pro didn't activate. Rare and invisible without an event,
      // and it means someone may have paid and not been let in.
      logEvent("onboarding_paywall_no_entitlement", packageProps(pkg));
    }
    // 🔴 A gate member proceeds ONLY on a real entitlement. Onboarding still
    // always continues (it never blocks the flow on a paywall outcome), but
    // showing the reveal to someone the store did not actually grant pro would
    // hand out the very thing the gate exists to sell.
    if (isGate) {
      if (outcome.isPro) revealAfterGatePurchase();
    } else {
      proceedToApp();
    }
  };

  const handleRestore = async () => {
    if (purchasing || restoring) return;
    logEvent("onboarding_paywall_restore");
    setRestoring(true);
    const outcome = await restorePurchases();
    setRestoring(false);
    if (outcome.isPro) {
      // A restore is never new revenue — it must not be counted as a purchase.
      logEvent("onboarding_paywall_restore_success");
      setSubscriptionTier("pro");
      toast.show({ message: "Subscription restored", icon: "✓" });
      // States tab: "Restore Purchase → straight to After purchase → Type
      // reveal." A restore earns the reveal the same as a fresh purchase.
      if (isGate) revealAfterGatePurchase();
      else proceedToApp();
    } else {
      logEvent("onboarding_paywall_restore_none");
      toast.show({ message: "No active subscription found to restore." });
    }
  };

  return (
    <View style={styles.container}>
      {/* The page background.
          🔑 This is ONE calibrated vertical gradient, not a reproduction of
          Lang's construction. Her frame builds it from two heavily blurred
          ellipses over a black bottom-darken layer; react-native-svg's
          FeGaussianBlur renders that unreliably (the same stdDeviation gives a
          visibly tighter blur, and it is expensive over a 3x-screen surface).
          Measuring the frame instead showed the horizontal variation is at most
          5/255 — it is a vertical ramp in all but name — so these stops are
          sampled straight off her render and land within ~1/255 of it. If the
          design changes, RE-MEASURE the frame and re-derive the stops. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="paywallBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#422224" />
              <Stop offset="0.03" stopColor="#442527" />
              <Stop offset="0.10" stopColor="#4E3032" />
              <Stop offset="0.18" stopColor="#503335" />
              <Stop offset="0.30" stopColor="#503335" />
              <Stop offset="0.34" stopColor="#4D2F31" />
              <Stop offset="0.42" stopColor="#432325" />
              <Stop offset="0.50" stopColor="#381618" />
              <Stop offset="0.58" stopColor="#361416" />
              <Stop offset="1" stopColor="#361416" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#paywallBg)" />
        </Svg>
      </View>

      <View style={styles.topBar}>
        {/* Screen Copy row 14 `paywall.back` is LOCKED: "Returns to Type ready
            with the Type still hidden." goBack() does exactly that from both
            stacks — Onboarding and Gate both push Paywall on top of TypeReady.
            🔑 Still not a skip: the paywall remains a hard wall, and back only
            ever lands on the screen before it. */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={purchasing || restoring}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowBackIcon size={24} color={WHITE} />
        </TouchableOpacity>

        <TypeCardStack />

        {/* Mirrors the back button's width so the card stack sits dead-centre
            (the frame carries the same invisible twin). */}
        <View style={styles.backBtnGhost} pointerEvents="none" />
      </View>

      <View style={styles.body}>
        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>Your Type is ready.</Text>

          {/* 🔴 PENDING COPY — Bryan wants a line generated in the moment from
              what Ester learned in onboarding (2026-09-30). The generator does
              not read onboarding answers yet, and its current fallback says
              "your scan" to people who skipped the scan, so rendering anything
              here today would ship a false claim. Lang designed the no-message
              state for exactly this; we sit in it until the line exists.
              When it does, pass it in and the card appears. */}
          {esterLine ? (
            <View style={styles.esterCard}>
              <View style={styles.esterMark}>
                <ResetMarkIcon size={26} color={WHITE} />
              </View>
              <Text style={styles.esterText}>{esterLine}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.valueBlock}>
          {VALUE_LINES.map(({ Icon, label }) => (
            <View key={label} style={styles.valueRow}>
              <View style={styles.valueIcon}>
                <Icon size={32} color={WHITE} />
              </View>
              <Text style={styles.valueText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Plans + CTA are one group so the body has THREE children under
            space-between, as the frame does — headline, value lines, purchase.
            Four children would spread the plans away from the button. */}
        <View style={styles.purchaseGroup}>
        <View style={styles.plansRow}>
          <PlanCard
            label="Monthly"
            price={plans.monthly.price}
            billed={plans.monthly.billed}
            variant="monthly"
            selected={selectedPlan === "monthly"}
            onPress={() => setSelectedPlan("monthly")}
          />
          <PlanCard
            label="Yearly"
            unit={plans.yearly.unit}
            price={plans.yearly.price}
            billed={plans.yearly.billed}
            variant="yearly"
            selected={selectedPlan === "yearly"}
            onPress={() => setSelectedPlan("yearly")}
            saleTag={plans.yearly.saleTag}
          />
        </View>

        <View style={styles.ctaBlock}>
          <Text style={styles.cancelHint}>Cancel anytime</Text>
          <TouchableOpacity
            onPress={handleSubscribe}
            activeOpacity={0.85}
            disabled={purchasing || restoring}
            style={[
              styles.subscribeBtn,
              (purchasing || restoring) && styles.subscribeBtnDisabled,
            ]}
          >
            {/* Sheen down the top ~40% of the button, per the frame. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="ctaSheen" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={WHITE} stopOpacity="0.8" />
                    <Stop offset="0.3955" stopColor={WHITE} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaSheen)" />
              </Svg>
            </View>
            {purchasing ? (
              <ActivityIndicator color={MAROON} />
            ) : (
              <Text style={styles.subscribeText}>Unlock my Type</Text>
            )}
          </TouchableOpacity>
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              hitSlop={8}
            >
              <Text style={styles.footerText}>Privacy Policy</Text>
            </TouchableOpacity>
            <View style={styles.footerDot} />
            <TouchableOpacity onPress={handleRestore} disabled={restoring} hitSlop={8}>
              <Text style={styles.footerText}>
                {restoring ? "Restoring…" : "Restore Purchase"}
              </Text>
            </TouchableOpacity>
            <View style={styles.footerDot} />
            <TouchableOpacity
              onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
              hitSlop={8}
            >
              <Text style={styles.footerText}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
          {state.auth.authUser ? (
            // Showing WHICH account is the point: "signed in as
            // xk7…@privaterelay.appleid.com" tells a member at a glance they
            // are in the wrong place.
            <View style={styles.accountRow}>
              <Text style={styles.accountText} numberOfLines={1} ellipsizeMode="middle">
                Signed in as {state.auth.authUser.email ?? "this account"}
              </Text>
              <TouchableOpacity onPress={handleSignOut} hitSlop={8}>
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAROON,
    paddingTop: TOP_PAD,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  // Top bar — Figma has no explicit height; tallest child (close button = 40)
  // sets the row. Set 40 here so the body sits 4px closer to the logo than
  // the prior 44 height.
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
  },

  // 40 tall so the card stack (83) overhangs it, as the frame does.
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: MAROON_ALT,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnGhost: { width: 40, height: 40 },

  // The face-down Type cards. Sizes are the frame's, kept as-is because the
  // rotations and offsets only read right at this scale.
  cardStack: { width: 64, height: 83 },
  faceCard: {
    position: "absolute",
    width: 64,
    height: 84,
    borderRadius: 4.681,
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 7,
    paddingBottom: 8,
    paddingHorizontal: 5,
    gap: 8,
  },
  faceCardBack: {
    backgroundColor: "#AFA594",
    left: -6,
    top: 0,
    transform: [{ rotate: "-6deg" }],
  },
  faceCardMid: {
    backgroundColor: "#C9BFAF",
    left: -7,
    top: -4,
    transform: [{ rotate: "-4deg" }],
  },
  faceCardFront: { backgroundColor: BONE, left: 0, top: 0 },
  faceCardLogo: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  skeletonGroup: { width: "100%", gap: 2.34 },
  // The blank rows that stand in for the Type's name and description — the
  // "face-down" half of the metaphor.
  skeletonBar: {
    height: 3.121,
    borderRadius: 0.78,
    backgroundColor: "rgba(54,20,22,0.12)",
    width: "100%",
  },
  skeletonTitle: { height: 4.681, width: 33 },

  // Body
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    width: "100%",
  },

  headlineBlock: { width: "100%", alignItems: "center", gap: 24 },
  purchaseGroup: { width: "100%", alignItems: "center", gap: 24 },
  headline: {
    fontFamily: fonts.catalogue,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: WHITE,
    textAlign: "center",
    includeFontPadding: false,
  },

  // Ester's line. Square top-left corner, rounded elsewhere — the speech-bubble
  // shape used for her elsewhere in the app.
  esterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    borderWidth: 0.5,
    borderColor: DIVIDER,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    paddingTop: 8,
    paddingBottom: 12,
    paddingLeft: 6,
    paddingRight: 8,
  },
  esterMark: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  esterText: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.16,
    color: WHITE,
  },

  // Value lines — icon + text, no bordered box (Bryan, 2026-09-30).
  valueBlock: { width: "100%", paddingHorizontal: 4, paddingBottom: 12 },
  // 32 in layout, 46.2 drawn: the glow overflows a centred box rather than
  // widening it. Negative margins here instead SHRANK the footprint to 17.8 and
  // dragged every row left.
  valueIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  valueText: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: WHITE,
  },

  // Plan cards
  plansRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    width: "100%",
  },
  planCard: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  // Radii are bound to the card itself (Monthly vs Yearly) per Figma —
  // each plan has its own asymmetric shape regardless of which is
  // selected. Selection state only flips the border + bg below.
  planRadiiMonthly: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 24,
  },
  planRadiiYearly: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 4,
  },
  planUnselected: {
    borderWidth: 1,
    borderColor: DIVIDER,
    // The frame's soft warm lift on the unselected card.
    boxShadow: "0px 2px 6px 0px rgba(124,87,87,0.32)",
  },
  planSelected: {
    borderWidth: 2,
    borderColor: WHITE,
    // The glow that marks the chosen plan. RN 0.76+ takes `boxShadow` on both
    // platforms, so this is a real coloured glow rather than an Android
    // `elevation` grey.
    boxShadow: "0px 0px 13.1px 0px rgba(237,235,224,0.5)",
  },
  planTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: WHITE,
    letterSpacing: -0.2,
  },
  planPrice: {
    alignItems: "flex-start",
    gap: 2,
  },
  planUnit: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: TEXT_ALT,
    letterSpacing: -0.14,
  },
  planPriceText: {
    fontFamily: fonts.dmSansBold,
    fontSize: 24,
    color: WHITE,
    letterSpacing: -0.24,
  },
  planBilled: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: TEXT_ALT,
    letterSpacing: -0.12,
  },
  saleTag: {
    position: "absolute",
    left: 14,
    top: -10,
    backgroundColor: MAROON_ALT,
    borderWidth: 1,
    borderColor: WHITE,
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 4,
    borderRadius: 100,
  },
  // Was Playfair. Bryan queried the odd typeface and Lang moved it to the
  // sans everything else uses.
  saleTagText: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    color: WHITE,
    letterSpacing: -0.12,
  },

  // CTA block
  ctaBlock: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  cancelHint: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: TEXT_ALT,
    letterSpacing: -0.14,
    textAlign: "center",
  },
  subscribeBtn: {
    backgroundColor: BONE,
    minHeight: 44,
    width: "100%",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 24,
    // Two shadows, as the frame has them: a white glow hugging the button and
    // the deep drop beneath it.
    boxShadow:
      "0px 0px 13.1px 0px rgba(250,253,254,0.4), 0px 25px 50px 0px rgba(0,0,0,0.25)",
    overflow: "hidden",
  },
  planSheen: { overflow: "hidden" },
  subscribeBtnDisabled: {
    opacity: 0.6,
  },
  subscribeText: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: BONE,
    letterSpacing: -0.12,
  },
  footerDot: {
    width: 0.5,
    height: 12,
    backgroundColor: DIVIDER,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 10,
  },
  accountText: {
    flexShrink: 1,
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: BONE,
    opacity: 0.7,
    letterSpacing: -0.12,
  },
  signOutText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: BONE,
    letterSpacing: -0.12,
    textDecorationLine: "underline",
  },
});

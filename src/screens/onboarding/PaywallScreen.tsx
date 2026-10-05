import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert,
  ScrollView,
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
  GLOW_OVERHANG,
  GLOW_SCALE,
  ResetMarkIcon,
  TypeMeaningIcon,
  MealsIcon,
  GuidanceIcon,
} from "../../components/PaywallIcons";
import { OnboardingBackButton } from "../../components";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { markAppOpenFlowShown } from "../../utils/appOpenFlowGate";

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

// 🔴 TOP_PAD is measured from the SCREEN TOP, status bar included — Lang's
// frames draw a 62pt `System UI` band at y=0 and put the top row at y=60
// (confirmed on 5266:68078). So the 60 already allows for a notch; it is not a
// gap below one.
//
// That is what makes the shrink above dangerous. The card stack is 64x83 and
// sits CENTRED in a 40pt top bar, so it rises ~21.5pt above the bar — ~27 once
// the three cards' rotations are counted. Dropping TOP_PAD to 36 on a short
// screen therefore put the top of the stack 9pt from the screen top, and on a
// Galaxy S24 (status bar ~34) it ran up UNDER THE FRONT CAMERA CUTOUT and was
// cut off. This screen has no SafeAreaView, so nothing else was going to catch
// it. At the design's own 60 the stack starts at 33pt and clears it.
const STACK_OVERHANG = 27;

// 🔴 Short-screen fit, same measured approach as Pre-scan. Lang's frame is an
// iPhone at 874pt; on a 780pt S24 the stack did not fit and "Unlock my Type"
// was pushed past the bottom edge. Reclaimed in order of what the design misses
// least — all of it is padding, nothing here scales type or the plan cards:
//   1. the three benefit rows' vertical padding   12/16 -> 5/9   (42pt)
//   2. the gap under the headline                 32 -> 20       (12pt)
//   3. the body's top padding                     54 -> 36       (18pt)
//   4. the gap above the purchase block           24 -> 16       (8pt)
const MAX_ROW_CUT = 14;
const MAX_HEAD_CUT = 12;
const MAX_TOP_CUT = 18;
const MAX_PURCHASE_CUT = 8;
const MAX_RECLAIM =
  MAX_ROW_CUT * 3 + MAX_HEAD_CUT + MAX_TOP_CUT + MAX_PURCHASE_CUT;
// The design value the shrink is allowed to walk back towards, never past.
const DESIGN_TOP_PAD = 60;

const MAROON_ALT = "#513436"; // page-surface-(alt)
const MAROON = "#361416";
const WHITE = "#FAFDFE";
const BONE = "#F3EFE3";
const TEXT_ALT = "#B0A3A4";
// ghost-surface: #361416 at 12%. Everything ON a face-down card is this one
// tone — the monogram as much as the skeleton rows — which is what makes the
// card read as unrevealed.
const GHOST_ON_BONE = "rgba(54,20,22,0.12)";

// 🔑 The BRAND mark (rounded body, hole, dot, two feet) — a different glyph
// from the R letterform on the face-down cards, and the frame uses each in its
// own place. Silver-shaded rather than flat white: the frame renders it at
// ~(217,220,221), which is this asset, not a tinted mark.
//
// 🔴 This is a TIGHTLY CROPPED copy of brand-logo-silver.png, which is 224x224
// with the glyph filling only 75% — 12.5% transparent padding a side (the same
// trap as ester-avatar.png). With the padded original, `size` meant "box",
// not "mark", and a 26 box drew a 19pt mark. Cropping once means 26 means 26,
// with no compensating magic number to get wrong later. The original is left
// alone; other screens still use it.
const BRAND_MARK = require("../../../assets/images/brand-mark-tight.png");
const DIVIDER = "#7E6869";


// Screen Copy row 14 is SUPERSEDED here. Bryan replaced the four benefit rows
// with these three on 2026-09-30, after the Sheet was written — later artefact
// wins. The Pro/Free comparison table went with them: there is no free tier to
// compare against.
//
// 🔴 Copy is Bryan's, not the frame's. Figma renders line 3 as "...works BEST
// for you"; his message says "works for you". Using his.
/**
 * Screen Copy row 14, benefits 1, 2 and 4 — all Final.
 *
 * 🔴 These are BRYAN'S strings, not the ones in Lang's frame. The frame reads
 * "Understand what your Type means / Get meals built to help you lose weight /
 * Get guidance that adapts as Reset learns what works for you", and row 14's
 * `Figma shows now` column does NOT list them — it still lists the OLD Pro/Free
 * table ("Reveal your type · Access to deep reads", …). So the Sheet was never
 * updated for this frame, and the frame's lines have never passed copy review.
 * Bryan's row notes are the reason that matters: benefit 2 carries "No
 * 'perfect,' 'metabolism-based' or medical claims", and the frame's version
 * promises weight loss in exactly that row; benefit 4 carries "Never call Ester
 * a doctor, clinician or nutritionist."
 *
 * 🔴 BENEFIT 3 IS DELIBERATELY ABSENT. "Daily scans and Reset Score" is the one
 * row Bryan marked **Check**, not Final: "Confirm both are live at launch.
 * Reset Score first appears around Day 21." Row 18 cut the Reset Score card
 * from the reveal for that same reason, so advertising the Score as something
 * you get by subscribing would sell a number that does not exist for three
 * weeks. It goes in once he confirms — and it needs a fourth icon from Lang.
 */
const VALUE_LINES: { Icon: (p: { size?: number; color?: string }) => React.JSX.Element; label: string }[] = [
  { Icon: TypeMeaningIcon, label: "Your Type and Deep Read" },
  { Icon: MealsIcon, label: "Meals picked for your patterns" },
  { Icon: GuidanceIcon, label: "Ongoing guidance from Ester" },
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
        {/* 🔴 Ghost tone, NOT full-strength maroon. Measured off the frame at
            (219,212,202), which is exactly MAROON at 12% over the bone card —
            the same token as the skeleton rows below it. Rendering it solid
            made the card look face-UP. */}
        <ResetMarkIcon size={36} color={GHOST_ON_BONE} />
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
  // 🔑 READ from the system, not assumed — the inset varies per device and the
  // S24's cutout is centred, exactly where the stack is.
  //
  // 🔑 Clamped to DESIGN_TOP_PAD so this can only ever UNDO the shrink, never
  // push past what Lang drew. On the S24 it restores the full 60; on an iPhone,
  // where TOP_PAD is already 60, it is a no-op. Without the clamp an iPhone 16
  // Pro (59pt inset) would have computed 86 and dropped the whole title block
  // 26pt below the design, on a screen that was never broken.
  const insets = useSafeAreaInsets();
  const topPad = Math.min(
    DESIGN_TOP_PAD,
    Math.max(TOP_PAD, Math.round(insets.top) + STACK_OVERHANG),
  );

  // 🔑 Measured against the real viewport, latched so it only ever grows — see
  // the same pattern and the reasons for it in PreScanScreen. On any screen
  // where the frame's own values already fit, `shrink` stays 0 and every value
  // below is the frame's.
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [shrink, setShrink] = useState(0);

  useEffect(() => {
    if (viewportH > 0 && contentH > viewportH) {
      setShrink((s) => Math.min(MAX_RECLAIM, s + Math.ceil(contentH - viewportH)));
    }
  }, [viewportH, contentH]);

  const rowCut = Math.min(MAX_ROW_CUT, Math.ceil(shrink / 3));
  let remaining = Math.max(0, shrink - rowCut * 3);
  const headCut = Math.min(MAX_HEAD_CUT, remaining);
  remaining -= headCut;
  const topCut = Math.min(MAX_TOP_CUT, remaining);
  remaining -= topCut;
  const purchaseCut = Math.min(MAX_PURCHASE_CUT, remaining);
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

  // 🔴 Claim today's app-open flow while a GATE member is on this screen, for
  // the same reason TypeRevealScreen claims it at the end of onboarding.
  // Purchasing flips the tier to "pro", which is the last thing RootNavigator's
  // `authReady` is waiting on (it already has isAuthenticated +
  // hasCompletedOnboarding) — so the moment the tier flips, that effect fires
  // `navigate("Main", { screen: "AppOpenFlow" })` with NO nested screen, lands
  // on `Greeting`, and beats `revealAfterGatePurchase`'s deferred dispatch.
  // The member pays and is shown the DAILY open flow instead of the reveal they
  // just bought. Reported on an S24, 2026-10-02.
  //
  // Claiming on mount rather than at purchase time keeps it out of the five
  // separate places that grant pro, and is deterministic: the gate is already
  // taken before any of them can flip the tier. The cost is that a gate member
  // who opens the paywall and backs out skips that day's open flow, which is a
  // fair description of what happened anyway.
  const gateUserId = state.auth.authUser?.id;
  useEffect(() => {
    if (!isGate || !gateUserId) return;
    void markAppOpenFlowShown(gateUserId);
  }, [isGate, gateUserId]);

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
  // ✅ DECIDED, Bryan 2026-10-01: "ship the two pre-written Ester lines for now
  // rather than scope the generated version. We can revisit true
  // personalization after this is live." So the static line is the CHOSEN
  // behaviour for V1, not a stopgap someone forgot to finish.
  // (For the record: the signed-off frame 5283:17117 contains exactly ONE
  // line, this one. "Two pre-written lines" came from our side of that thread
  // and does not correspond to anything in the file.)
  //
  // 🔑 Why this particular sentence is the safe one, if it is ever reworded:
  // it is true for every member regardless of path. Every member answers the
  // energy question (q1 is literally "When does your energy usually drop?"),
  // and it claims nothing about a scan, so it holds for scanners and skippers
  // alike. Anything that asserts a reading we have not taken breaks that.
  //
  // ▶ The generated version — the same `scan-insights` change that would fix
  // the Deep Read takeaway card for skipped-scan members — is deliberately
  // AFTER release. Do both from one change when it comes, and not before the
  // Deep Read claim rules land (Open Check #7).
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
    <View style={[styles.container, { paddingTop: topPad }]}>
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

      {/* Screen Copy row 15, "After purchase" (Final): "Unlocking your Type…".
          🔴 The string was MISSING ENTIRELY — the frame (5251:61742) is a bare
          centred spinner and its `Figma shows now` literally reads "Spinner, no
          text", so the words only exist in the Sheet. Bryan's note: "The
          previous screen already said the Type is ready. Flows straight into
          the reveal; no second gate." — hence an overlay on the paywall rather
          than a route of its own. */}
      {purchasing ? (
        <View style={styles.purchaseOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={WHITE} />
          <Text style={styles.purchaseOverlayText}>Unlocking your Type…</Text>
        </View>
      ) : null}

      <View style={styles.topBar}>
        {/* Screen Copy row 14 `paywall.back` is LOCKED: "Returns to Type ready
            with the Type still hidden." goBack() does exactly that from both
            stacks — Onboarding and Gate both push Paywall on top of TypeReady.
            🔑 Still not a skip: the paywall remains a hard wall, and back only
            ever lands on the screen before it. */}
        <OnboardingBackButton
          onPress={() => navigation.goBack()}
          disabled={purchasing || restoring}
        />

        <TypeCardStack />

        {/* Mirrors the back button's width so the card stack sits dead-centre
            (the frame carries the same invisible twin). */}
        <View style={styles.backBtnGhost} pointerEvents="none" />
      </View>

      {/* 🔴 Scrollable, not a plain View. Lang's frame is an iPhone (874pt);
          a Galaxy S24 is 780pt, and the 94pt difference fell off the BOTTOM —
          `Privacy Policy · Restore Purchase · Terms of Use` rendered below the
          screen with nothing to scroll, so Restore Purchase was unreachable on
          the device. Measured on an S24 2026-10-02: the CTA ends at 2293 of
          2340px and the footer row needs ~110px more.
          `flexGrow: 1` keeps `space-between` doing exactly what it did on a
          tall screen — this changes nothing where the content already fits,
          and only becomes a scroll where it did not. */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[
          styles.body,
          { paddingTop: 54 - topCut },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!purchasing && !restoring}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentH(h)}
      >
        <View style={[styles.headlineBlock, { gap: 32 - headCut }]}>
          <Text style={styles.headline}>Your Type is ready.</Text>

          {/* 🔴 STILL A PLACEHOLDER, not a generated read — see the note on
              `esterLine` above for why this particular sentence is the only
              one safe to render today, and why the card is not simply left in
              Lang's no-message state. Bryan wants a line generated in the
              moment from what Ester learned (2026-09-30); the generator does
              not read onboarding answers yet. When it does, pass it in here
              and delete the constant. */}
          {esterLine ? (
            <View style={styles.esterCard}>
              <Image
                source={BRAND_MARK}
                style={styles.esterMark}
                resizeMode="contain"
              />
              <Text style={styles.esterText}>{esterLine}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.valueBlock}>
          {/* 🔴 NO value line here. Screen Copy row 14 `paywall.value`
              ("Reveal your Type and put it to work.", Final) added one above
              the benefit rows — its `Figma shows now` cell is empty because it
              exists in no frame. Cole, 2026-10-02: Bryan signed off on Lang's
              paywall as drawn, which has the Ester bubble running straight into
              the benefits, and the extra line cluttered the screen. Lang's
              layout wins here, so the string is deliberately unused.
              ⚠️ The Sheet still lists it as Final — it needs marking Cut on the
              Screen Copy tab so the next copy pass does not re-add it. */}
          {VALUE_LINES.map(({ Icon, label }) => (
            <View
              key={label}
              style={[
                styles.valueRow,
                {
                  paddingTop: 12 - Math.ceil(rowCut / 2),
                  paddingBottom: 16 - Math.floor(rowCut / 2),
                },
              ]}
            >
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
        <View style={[styles.purchaseGroup, { gap: 24 - purchaseCut }]}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAROON,
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
  backBtnGhost: { width: 40, height: 40 },

  // Sits above the paywall and swallows taps so the CTA cannot be double-fired
  // while the purchase resolves.
  purchaseOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: MAROON,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  purchaseOverlayText: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: WHITE,
    textAlign: "center",
  },

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
    backgroundColor: GHOST_ON_BONE,
    width: "100%",
  },
  skeletonTitle: { height: 4.681, width: 33 },

  // Body
  bodyScroll: { flex: 1, width: "100%" },
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "space-between",
    // The frame's own value. Was 24, which sat the headline 30pt too high
    // under the card stack.
    paddingTop: 54,
    width: "100%",
  },

  // ⚠️ The frame's nominal gap is 24, but Figma's line box for the headline sits
  // lower than Android's, so a literal 24 put the bubble 9pt high. 32 lands the
  // bubble's top where the frame has it. Measured, not guessed.
  headlineBlock: { width: "100%", alignItems: "center", gap: 32 },
  purchaseGroup: { width: "100%", alignItems: "center", gap: 24 },
  headline: {
    fontFamily: fonts.catalogue,
    fontSize: 40,
    // 🔴 NO `includeFontPadding: false` here, and lineHeight has to clear the
    // descenders. That prop strips the padding Android uses to reserve
    // descender room, which flat-cut the "y" in "Your Type is ready." — the
    // exact failure recorded against the onboarding title in PR119. For a
    // clipped descender do the OPPOSITE: leave includeFontPadding alone and
    // give the line box room.
    lineHeight: 48,
    letterSpacing: -0.4,
    color: WHITE,
    textAlign: "center",
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
  // 🔴 brand-logo-silver.png is 224x224 with the glyph filling only 75% —
  // 12.5% TRANSPARENT PADDING per side (the same trap as ester-avatar.png).
  esterMark: { width: 26, height: 26 },
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
  // 🔴 Sized to the FULL drawn box and pulled back by the overhang, so the
  // footprint is still 32 but nothing is clipped. Sizing this to 32 and
  // relying on overflow cut the fork/knife and compass mid-glyph on Android;
  // negative margins on a 32 box instead shrank the footprint to 17.8 and
  // dragged every row left. This is the combination that is right.
  valueIcon: {
    width: 32 * GLOW_SCALE,
    height: 32 * GLOW_SCALE,
    margin: -32 * GLOW_OVERHANG,
    alignItems: "center",
    justifyContent: "center",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  // A step above the benefit rows without competing with the 40pt headline.
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

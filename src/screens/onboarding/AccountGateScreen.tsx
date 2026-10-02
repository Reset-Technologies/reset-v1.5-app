import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K, MetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { GoogleMark } from "../../components/GoogleMark";
import { useApp } from "../../context/AppContext";
import { loginWithApple, loginWithGoogle } from "../../services/auth";
import { syncOnboardingToBackend } from "../../services/onboarding";
import { submitScanResults } from "../../services/profile";
import { logEvent } from "../../services/braze";

import {
  GoogleSignin,
  isGoogleSignInAvailable,
} from "../../services/googleSignin";

type Props = NativeStackScreenProps<any, "AccountGate">;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const WHITE = "#FAFDFE";
const ON_BONE_SUBTLE = "#7E6869";

const ESTER_AVATAR = require("../../../assets/images/ester-avatar-silver.png");
// Pre-blurred type card from Figma export. We render this as the featured
// teaser as-is — no live blur or per-type avatar/text overlay needed.
// Mini-card silhouette (the small cards behind the featured one — still
// coded). Per-type artwork drops in as it comes from the PM; remaining
// types fall back to the silver Ester avatar.
const TYPE_SILHOUETTE = require("../../../assets/images/ester-avatar-silver.png");
const TYPE_LOGO: Record<MetabolicType, any> = {
  Burner: require("../../../assets/images/onboarding/type-logo-burner.png"),
  Chameleon: require("../../../assets/images/onboarding/type-logo-chameleon.png"),
  Ember: require("../../../assets/images/onboarding/type-logo-ember.png"),
  Explorer: require("../../../assets/images/onboarding/type-logo-explorer.png"),
  // The rebounder logo is a near-neutral silver-mauve; iOS's wide-gamut display
  // amplifies its faint purple while Android renders the literal sRGB (reads
  // gray). Android gets a saturation-boosted variant so it matches the iOS
  // purple; iOS keeps the original.
  Rebounder:
    Platform.OS === "android"
      ? require("../../../assets/images/onboarding/type-logo-rebounder-android.png")
      : require("../../../assets/images/onboarding/type-logo-rebounder.png"),
};

const SCREEN_W = Dimensions.get("window").width;

// All five types, in the order Figma shows them in the background fan.


// Tagline blurbs from Figma, keyed to the matching code type.


export function AccountGateScreen({ navigation }: Props) {
  const { state, setUserAccount, setAuth, setTypingResult, completeOnboarding } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");
  // Measured height of the graphic area, so the featured card can scale down
  // to fit short screens (capped at its 373 design height).

  useEffect(() => {
    logEvent("onboarding_account_gate");
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  /**
   * Everything this screen does *besides* authenticating: push the onboarding
   * answers to the backend (which returns the metabolic type) and submit the
   * scan. Both auth paths ran identical copies of this; it's extracted so the
   * RES-207 already-authenticated path below reuses exactly the same code
   * rather than a second implementation that could drift.
   *
   * Failures stay swallowed, as before — a sync problem must not strand
   * someone mid-onboarding with an account they can't get past.
   */
  const syncOnboardingData = async () => {
    try {
      const { primaryBucket, startingRead, glp1Flag } =
        await syncOnboardingToBackend({
          goal: state.user.goal,
          behaviorAnswers: {
            q1: state.user.quizAnswers.q1,
            q2: state.user.quizAnswers.q2,
            q3: state.user.quizAnswers.q3,
          },
          tastePreferences: state.user.tastePreferences,
          dietaryRestrictions: state.user.dietaryRestrictions,
        });
      if (primaryBucket) {
        setTypingResult({ metabolicType: primaryBucket, startingRead, glp1Flag });
      }
    } catch {}

    if (state.biometrics?.raw) {
      try {
        await submitScanResults(state.biometrics.raw);
      } catch {}
    }
  };

  /**
   * RES-207 — a returning BetterWell member arrives here already signed in:
   * the legacy bridge created their account at login. Asking them to make a
   * second account would be absurd, but the rest of what this screen does is
   * still required — without the sync they'd reach the type reveal with no
   * metabolic type and an unsubmitted scan. So skip the sign-up UI, do the
   * real work, and move on. The existing full-screen spinner covers it.
   */
  useEffect(() => {
    if (!state.auth.isAuthenticated) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      await syncOnboardingData();
      if (!cancelled) finishAccount();
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount: this is a one-way handoff, and
    // re-running it on any state change would re-sync and re-navigate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishAccount = () => {
    // RES-119: the 3-card reveal flow is now part of every onboarding, not
    // gated on a real scan — TypeRevealScreen falls back to a placeholder
    // score when biometrics are missing.
    //
    // reset (not navigate) so the now-stale account screens leave the stack —
    // a signed-up user must never be able to land back on a sign-up screen.
    // RES-188: third-party-AI consent sits between account creation and reveal.
    navigation.reset({ index: 0, routes: [{ name: "AiConsent" }] });
  };


  /**
   * The server refuses to link a provider into an account it cannot prove the
   * signer owns (one holding a password, or an address the provider did not
   * verify). That is not an error to display — it is a route: send the member
   * to sign in the way they already can, carrying the provider token so they
   * do not have to repeat the prompt.
   *
   * Returns true if the error was handled as a redirect.
   */
  const routeIfLinkRequired = (
    err: any,
    provider: "apple" | "google",
    idToken: string,
  ): boolean => {
    if (err?.code !== "ACCOUNT_EXISTS_LINK_REQUIRED") return false;
    logEvent("onboarding_account_gate_linkRequired", { method: provider });
    navigation.navigate("LinkAccount", {
      email: String(err.body?.email ?? ""),
      authProvider: (err.body?.authProvider as string[]) ?? [],
      hasPassword: err.body?.hasPassword === true,
      provider,
      idToken,
      continueTo: "AiConsent",
    });
    return true;
  };

  const handleAppleSignIn = async () => {
    if (isLoading) return;
    logEvent("onboarding_account_gate_appleCTA");
    setError(null);
    setIsLoading(true);
    let appleIdToken = "";
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token from Apple");
      appleIdToken = credential.identityToken;

      const user = await loginWithApple(credential.identityToken);
      setUserAccount(
        user.email ?? "apple-user",
        user.firstName ?? credential.fullName?.givenName ?? undefined
      );
      setAuth(user);

      // 🔑 ONLY when the server says this login created the account. Apple and
      // Google use one endpoint for sign-up and sign-in, so firing
      // unconditionally would report every returning member as a new
      // registration and inflate every cost-per-signup we report.
      if (user.isNewUser) logEvent("signup_completed", { method: "apple" });

      await syncOnboardingData();

      finishAccount();
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") return;
      if (routeIfLinkRequired(err, "apple", appleIdToken)) return;
      setError(err.message || "Apple sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    logEvent("onboarding_account_gate_googleCTA");
    setError(null);
    setIsLoading(true);
    let googleIdToken = "";
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");
      googleIdToken = idToken;

      const user = await loginWithGoogle(idToken);
      setUserAccount(user.email ?? "google-user", user.firstName ?? undefined);
      setAuth(user);

      // 🔑 ONLY when the server says this login created the account. Apple and
      // Google use one endpoint for sign-up and sign-in, so firing
      // unconditionally would report every returning member as a new
      // registration and inflate every cost-per-signup we report.
      if (user.isNewUser) logEvent("signup_completed", { method: "google" });

      await syncOnboardingData();

      finishAccount();
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED") return;
      if (routeIfLinkRequired(err, "google", googleIdToken)) return;
      setError(err.message || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * The way back to an account the member already has.
   *
   * Without this, anyone using Apple's Hide My Email lands here with a relay
   * alias that matches no existing account, so the server correctly mints a NEW
   * one and they quietly end up with a duplicate — the exact problem this work
   * exists to stop. Their address can never be matched, so the only way to
   * reunite them with their account is to let them say so and sign in.
   *
   * Two thirds of our Apple accounts use a relay address, so this is the common
   * case for Apple, not an edge case.
   */
  const handleExistingAccount = () => {
    logEvent("onboarding_account_gate_existingAccountCTA");
    navigation.navigate("Login");
  };

  const handleEmail = () => {
    logEvent("onboarding_account_gate_emailCTA");
    navigation.navigate("CreateAccount");
  };

  return (
    <View style={styles.container}>
      {/* Bottom darken gradient — same recipe used across the maroon flow. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="gateBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gateBg)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Top bar: Ester logo centered (spacers keep it centered). */}
        <View style={styles.topBar}>
          <View style={{ width: 28 }} />
          <Image source={ESTER_AVATAR} style={styles.avatar} resizeMode="contain" />
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.center}>
          {/* 🔴 The blurred Type-card teaser is GONE. Lang's frame for this
              screen (5264:67655) is text and buttons only — no graphic at all.
              ⚠️ That is the frame's call, not the Sheet's: the Sheet only cuts a
              blurred card on row 12 (Building the Type), so this rests on the
              layout source alone. Easy to put back if Lang meant it to stay. */}

          {/* Title + subtitle + buttons */}
          <View style={styles.footer}>
            {/* Screen Copy row 9 (Final, "Merged"). The old draft pair
                ("Save your progress" / "Your answers, Type, and plan will stay
                with you.") is Cut, and so is promising the Type here — the Type
                is not revealed until after the paywall, two screens later. */}
            <Text style={styles.title}>Got it. That’s everything I need for now.</Text>
            <Text style={styles.subtitle}>Create an account to save your answers.</Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* The frame puts the auth buttons in their own flex-1 block pinned
                to the bottom, with the two Ester lines above it. Without this
                wrapper the lines are siblings of the buttons and flex-end drags
                the whole group to the bottom of the screen. */}
            <View style={styles.authButtons}>
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={4}
                style={styles.appleNativeBtn}
                onPress={handleAppleSignIn}
              />
            )}

            {isGoogleSignInAvailable && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={MAROON} />
                ) : (
                  <>
                    <GoogleMark size={20} />
                    <Text style={styles.primaryBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleEmail}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.ghostBtnText}>Continue with email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleExistingAccount}
              disabled={isLoading}
              activeOpacity={0.85}
              hitSlop={8}
              style={styles.existingAccountBtn}
            >
              <Text style={styles.existingAccountText}>
                Already have a Reset account? Sign in.
              </Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={WHITE} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  avatar: { width: 40, height: 40 },

  center: {
    flex: 1,
    /**
     * 🔑 24, not 12. The frame nests the inset TWICE and I only took the first
     * one: `SLOT` sits at x=12 inside a 402 body, and its children sit at a
     * further x=12 inside that — 354 wide, so 24 clear of each edge. Reading
     * the SLOT alone put every line 12pt too close to the screen edge.
     * (The top bar's own 12 is the SLOT-level inset and is correct there; it
     * holds 56pt icon buttons, not text.)
     */
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  miniSilhouetteWrap: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },

  miniHeader: { alignSelf: "stretch", gap: 4 },


  // Bottom CTA block
  // The frame's Buttons block is flex-1 / justify-end: the two Ester lines sit
  // at the TOP of the slot and the buttons at the BOTTOM, with the space
  // between them. `space-between` on the parent is not the same thing — it
  // spread the text apart and left the buttons mid-screen.
  footer: { flex: 1, paddingTop: 16, alignItems: "center", width: "100%" },
  authButtons: {
    flex: 1,
    gap: 12,
    paddingTop: 16,
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
  },
  // Both lines are Title-2 at the same weight and colour in the frame — this
  // is Ester talking, not a headline over a caption, so they match.
  title: {
    fontFamily: fonts.catalogue,
    color: WHITE,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    width: "100%",
  },
  subtitle: {
    fontFamily: fonts.catalogue,
    color: WHITE,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    width: "100%",
    marginTop: 24,
  },
  errorText: {
    fontFamily: fonts.dmSans,
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
  },
  appleNativeBtn: {
    width: "100%",
    height: 52,
    marginTop: 4,
  },
  primaryBtn: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    backgroundColor: WHITE,
    minHeight: 44,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 24,
  },
  primaryBtnText: {
    fontFamily: fonts.catalogue,
    color: MAROON,
    fontSize: 20,
    letterSpacing: -0.2,
  },
  // 🔑 Transparent and small, per the frame — it is the quiet third option.
  // As a filled block at 20pt it read as a second primary button.
  ghostBtn: {
    width: "100%",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    fontFamily: fonts.catalogueMedium,
    color: WHITE,
    fontSize: 14,
  },
  // A text link rather than a fourth button: this is the escape hatch for
  // returning members, and it should not compete with the three ways to sign up.
  existingAccountBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  existingAccountText: {
    fontFamily: fonts.dmSans,
    color: WHITE,
    opacity: 0.7,
    fontSize: 16,
    letterSpacing: -0.16,
  },
});

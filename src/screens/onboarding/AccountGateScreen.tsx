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
import Constants from "expo-constants";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K, MetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { loginWithApple, loginWithGoogle } from "../../services/auth";
import { syncOnboardingToBackend } from "../../services/onboarding";
import { submitScanResults } from "../../services/profile";
import { logEvent } from "../../services/braze";

// Google Sign-In is Android-only; importing on iOS crashes in Expo Go.
const GoogleSignin =
  Platform.OS === "android"
    ? require("@react-native-google-signin/google-signin").GoogleSignin
    : null;

if (GoogleSignin) {
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
  });
}

type Props = NativeStackScreenProps<any, "AccountGate">;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const WHITE = "#FAFDFE";
const ON_BONE_SUBTLE = "#7E6869";
const GHOST = "rgba(250,253,254,0.24)";

const ESTER_AVATAR = require("../../../assets/images/ester-avatar-silver.png");
// Pre-blurred type card from Figma export. We render this as the featured
// teaser as-is — no live blur or per-type avatar/text overlay needed.
const FEATURED_CARD = require("../../../assets/images/onboarding/account-gate-card.png");
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
const TYPE_ORDER: MetabolicType[] = [
  "Chameleon",
  "Burner",
  "Ember", // Figma "Restorer"
  "Explorer",
  "Rebounder",
];

const TYPE_DISPLAY_NAME: Record<MetabolicType, string> = {
  Chameleon: "Chameleon",
  Burner: "Burner",
  Ember: "Restorer",
  Explorer: "Explorer",
  Rebounder: "Rebounder",
};

// Tagline blurbs from Figma, keyed to the matching code type.
const TYPE_BLURB: Record<MetabolicType, string> = {
  Chameleon: "Two weeks on. Two weeks off. Same body, different rules.",
  Burner: "Sharp in the morning, gone by 3pm. Every single day.",
  Ember: "You do everything right and the tank is still empty.",
  Explorer: "You've never fit cleanly into any category.",
  Rebounder: "The diet always works. Until it doesn't. Again.",
};

function TypeCardMini({ type, label, blurb }: { type: MetabolicType; label: string; blurb: string }) {
  const logo = TYPE_LOGO[type];
  return (
    <View style={styles.miniCard}>
      <View style={styles.miniInfo}>
        <Text style={styles.miniInfoDot}>i</Text>
      </View>
      <View style={styles.miniSilhouetteWrap}>
        <Image source={logo} style={styles.miniSilhouette} resizeMode="contain" />
      </View>
      <View style={styles.miniHeader}>
        <Text style={styles.miniTitle}>{label}</Text>
        <Text style={styles.miniBlurb} numberOfLines={3}>
          {blurb}
        </Text>
      </View>
    </View>
  );
}

export function AccountGateScreen({ navigation }: Props) {
  const { state, setUserAccount, setAuth, setTypingResult, completeOnboarding } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");
  // Measured height of the graphic area, so the featured card can scale down
  // to fit short screens (capped at its 373 design height).
  const [graphicH, setGraphicH] = useState(0);
  const featuredCardHeight = graphicH ? Math.min(373, graphicH - 24) : 373;

  useEffect(() => {
    logEvent("onboarding_account_gate");
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const finishAccount = () => {
    // RES-119: the 3-card reveal flow is now part of every onboarding, not
    // gated on a real scan — TypeRevealScreen falls back to a placeholder
    // score when biometrics are missing.
    //
    // reset (not navigate) so the now-stale account screens leave the stack —
    // a signed-up user must never be able to land back on a sign-up screen.
    navigation.reset({ index: 0, routes: [{ name: "TypeReveal" }] });
  };

  const handleAppleSignIn = async () => {
    logEvent("onboarding_account_gate_appleCTA");
    setError(null);
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token from Apple");

      const user = await loginWithApple(credential.identityToken);
      setUserAccount(
        user.email ?? "apple-user",
        user.firstName ?? credential.fullName?.givenName ?? undefined
      );
      setAuth(user);

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
          setTypingResult({
            metabolicType: primaryBucket,
            startingRead,
            glp1Flag,
          });
        }
      } catch {}

      if (state.biometrics?.raw) {
        try {
          await submitScanResults(state.biometrics.raw);
        } catch {}
      }

      finishAccount();
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") return;
      setError(err.message || "Apple sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    logEvent("onboarding_account_gate_googleCTA");
    setError(null);
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");

      const user = await loginWithGoogle(idToken);
      setUserAccount(user.email ?? "google-user", user.firstName ?? undefined);
      setAuth(user);

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
          setTypingResult({
            metabolicType: primaryBucket,
            startingRead,
            glp1Flag,
          });
        }
      } catch {}

      if (state.biometrics?.raw) {
        try {
          await submitScanResults(state.biometrics.raw);
        } catch {}
      }

      finishAccount();
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED") return;
      setError(err.message || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
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
          {/* Stacked graphic: row of mini cards behind, featured card in front */}
          <View
            style={styles.graphicWrap}
            onLayout={(e) => setGraphicH(e.nativeEvent.layout.height)}
          >
            <View style={styles.bgRow} pointerEvents="none">
              {TYPE_ORDER.map((t) => (
                <TypeCardMini
                  key={t}
                  type={t}
                  label={TYPE_DISPLAY_NAME[t]}
                  blurb={TYPE_BLURB[t]}
                />
              ))}
            </View>

            <Image
              source={FEATURED_CARD}
              style={[styles.featuredCard, { height: featuredCardHeight }]}
              resizeMode="contain"
            />
            {/* Static teaser intentionally uses the designer-baked blur image
                instead of overlaying type-specific text + a live blur — the
                user's actual type stays hidden until account creation. */}
          </View>

          {/* Title + subtitle + buttons */}
          <View style={styles.footer}>
            <Text style={styles.title}>Your type is ready. Unlock it now</Text>
            <Text style={styles.subtitle}>Everything's about to make sense.</Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {appleAvailable && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleAppleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={MAROON} />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue with Apple</Text>
                )}
              </TouchableOpacity>
            )}

            {Platform.OS === "android" && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={MAROON} />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue with Google</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleEmail}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.ghostBtnText}>Use email instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: "space-between",
  },

  graphicWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  bgRow: {
    position: "absolute",
    flexDirection: "row",
    gap: 8,
    opacity: 0.5,
    alignItems: "center",
  },

  // Mini cards (5 across, behind featured)
  miniCard: {
    width: 84,
    height: 126,
    backgroundColor: BONE,
    borderRadius: 12,
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 8,
    alignItems: "flex-end",
    gap: 8,
  },
  miniInfo: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: MAROON,
    alignItems: "center",
    justifyContent: "center",
  },
  miniInfoDot: { color: BONE, fontSize: 6, lineHeight: 8 },
  miniSilhouetteWrap: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  miniSilhouette: { width: 56, height: 56 },
  miniHeader: { alignSelf: "stretch", gap: 4 },
  miniTitle: {
    fontFamily: fonts.dmSans,
    color: MAROON,
    fontSize: 7,
    lineHeight: 7,
  },
  miniBlurb: {
    fontFamily: fonts.dmSans,
    color: MAROON,
    opacity: 0.4,
    fontSize: 5,
    lineHeight: 6,
  },

  // Featured card — designer-baked blurred PNG, 240x373 natural size. Height
  // is set inline from the measured graphic area (capped at 373) so on shorter
  // screens (e.g. Galaxy S24) it scales down to fit instead of bleeding into
  // the top logo and the title; aspectRatio derives the width to match.
  featuredCard: {
    height: 373,
    aspectRatio: 240 / 373,
  },

  // Bottom CTA block
  footer: { gap: 12, paddingTop: 24, alignItems: "center" },
  title: {
    fontFamily: fonts.dmSans,
    color: WHITE,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.dmSans,
    color: BONE,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  errorText: {
    fontFamily: fonts.dmSans,
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: fonts.dmSans,
    color: MAROON,
    fontSize: 20,
    letterSpacing: -0.2,
  },
  ghostBtn: {
    width: "100%",
    backgroundColor: GHOST,
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    fontFamily: fonts.dmSans,
    color: WHITE,
    fontSize: 20,
    letterSpacing: -0.2,
  },
});

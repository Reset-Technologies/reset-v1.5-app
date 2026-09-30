import React, { useEffect } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fonts } from "../../constants/typography";
import { K } from "../../constants/colors";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "TypeReady">;

const BRAND_LOGO = require("../../../assets/images/brand-logo-silver.png");

/**
 * "Your Type is ready." — the screen between consent and the paywall.
 *
 * Layout is Lang's Dev Ready frame (Figma 5251:61067): the page surface with
 * the bottom-darken gradient, the brand mark, centred headline and supporting
 * line, and a single full-width CTA with the 4/4/4/24 corner.
 *
 * 🔴 THE COPY IS NOT THE FRAME'S. The frame still shows "Your type is ready.
 * Unlock it now" / "Everything's about to make sense." / "Unlock my type!",
 * which the Screen Copy tab lists verbatim in its `Figma shows now` column —
 * the column that exists to mark placeholders engineering must REPLACE. Row 13
 * is Final and says why: "'Unlock my type!' would promise a reveal and deliver
 * a price screen." Take the layout from Figma, the words from the Sheet.
 *
 * 🔴 THE TYPE IS FULLY HIDDEN. No name, no one-liner, no mascot, no blurred
 * card — the whole point of the reorder (Bryan, 2026-09-29) is that the Type is
 * what the member buys. Anything that leaks it here gives away the thing the
 * paywall is selling.
 *
 * Returning unpaid members resume here too (Flow row 13), which is why this
 * screen reads no state — there is nothing to show that depends on it.
 */
export function TypeReadyScreen({ navigation }: Props) {
  useEffect(() => {
    logEvent("onboarding_type_ready");
  }, []);

  const handleSeePlans = () => {
    logEvent("onboarding_type_ready_seePlansCTA");
    navigation.navigate("Paywall");
  };

  return (
    <View style={styles.container}>
      {/* Bottom-darken gradient over the page surface, same treatment as
          Pre-scan and the reveal so the run of screens reads as one surface. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="typeReadyBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#typeReadyBg)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.body}>
          <Image source={BRAND_LOGO} style={styles.mark} resizeMode="contain" />

          <Text style={styles.headline}>Your Type is ready.</Text>
          <Text style={styles.supporting}>
            Choose a plan to see your Type, what it means, and your first meal.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cta}
            onPress={handleSeePlans}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="See plans"
          >
            <Text style={styles.ctaLabel}>See plans</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.brown },
  safe: { flex: 1, paddingHorizontal: 24 },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  // Figma renders the mark at 234 with mix-blend-lighten, which RN has no
  // reliable cross-platform equivalent for. The silver asset already reads
  // light on the maroon surface, so it goes on unblended.
  mark: { width: 234, height: 234, marginBottom: 8 },
  headline: {
    fontFamily: fonts.catalogue,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    color: K.white,
    textAlign: "center",
  },
  supporting: {
    maxWidth: 349,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: K.bone,
    textAlign: "center",
  },
  footer: { paddingBottom: 24, paddingTop: 16 },
  // The house button shape: square but for a large top-right corner.
  cta: {
    backgroundColor: K.white,
    minHeight: 44,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 25 },
    shadowRadius: 25,
    elevation: 8,
  },
  ctaLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
});

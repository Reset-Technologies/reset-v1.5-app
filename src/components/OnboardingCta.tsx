import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { K } from "../constants/colors";
import { fonts } from "../constants/typography";

/**
 * The button shape in Lang's V1 onboarding Dev Ready frames: square but for a
 * large top-right corner, white on the maroon page surface, with the on-dark
 * shadow. Disabled is a 50% opacity of the same fill rather than a grey swap.
 *
 * 🔑 Deliberately NOT the shared `Button`. That one is pill-shaped "per Full
 * Nelson" — the older language — and the rebuilt onboarding screens are the
 * only place this shape appears so far. When the rest of the app moves over,
 * this is the thing to widen rather than a second variant on `Button`.
 */
export function OnboardingCta({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "ghostFilled";
  disabled?: boolean;
  loading?: boolean;
}) {
  const ghost = variant === "ghost";
  const ghostFilled = variant === "ghostFilled";
  const onDark = ghost || ghostFilled;
  return (
    <TouchableOpacity
      style={[
        ghostFilled ? styles.ghostFilled : ghost ? styles.ghost : styles.primary,
        disabled && !onDark && styles.primaryDisabled,
        disabled && onDark && styles.ghostDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={onDark ? K.white : K.brown} />
      ) : (
        <Text
          style={
            ghostFilled
              ? styles.ghostFilledLabel
              : ghost
                ? styles.ghostLabel
                : styles.primaryLabel
          }
        >
          {title}
        </Text>
      )}
      {/* Keeps the height stable between the label and spinner states. */}
      <View style={styles.minHeight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
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
  primaryDisabled: { opacity: 0.5 },
  primaryLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  ghost: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  ghostDisabled: { opacity: 0.5 },
  /**
   * The second action on a full-bleed photographic surface — Opening's "Log in"
   * (Figma 5251:43275). It is NOT the `ghost` variant: that one is transparent
   * and 14pt, sized to sit UNDER a primary button as a quieter opt-out. This
   * one is a peer of the primary — same height, same 20pt label — and carries
   * a translucent fill so it stays legible over video. Radius is 4 on all four
   * corners, not the 4/4/4/24 of the primary, which is what keeps the primary
   * reading as the primary.
   */
  ghostFilled: {
    backgroundColor: "rgba(250,253,254,0.24)",
    minHeight: 44,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  ghostFilledLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.white,
  },
  ghostLabel: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.white,
  },
  minHeight: { height: 0 },
});

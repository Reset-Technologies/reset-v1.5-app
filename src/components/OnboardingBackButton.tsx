import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { ArrowBackIcon } from "./PaywallIcons";
import { K } from "../constants/colors";

/**
 * The back control in Lang's onboarding frames — a 40pt circle on the alt page
 * surface with the 24pt arrow glyph (e.g. Scan setup, Figma 5262:67221).
 *
 * 🔑 Extracted because the same 40/999/#513436 block had been pasted into
 * Pre-scan, the email sign-up and the paywall, and Scan setup had drifted to a
 * hand-drawn stroked chevron with no circle behind it — visibly not the same
 * button one screen later. One component means the next screen that needs a
 * back arrow cannot invent a fourth version.
 *
 * The hairline is the frame's "Hairline Stroke (Dark)" effect, which none of
 * the hand-rolled copies carried.
 */
export function OnboardingBackButton({
  onPress,
  disabled = false,
  accessibilityLabel = "Back",
}: {
  onPress: () => void;
  /** The paywall locks its back control while a purchase is resolving. */
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.btn}
      hitSlop={12}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <ArrowBackIcon size={24} color={K.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // 40 = the frame's 24pt glyph + 8pt padding on each side.
  btn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#513436", // page-surface (alt)
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 0 2px 0 rgba(235,235,235,0.24)",
  },
});

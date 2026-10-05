import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { CheckIcon } from "./PaywallIcons";

/**
 * The agreement checkbox, Figma 5266:67914 (unchecked) / 5266:68045 (checked).
 *
 * 🔑 ONE component on purpose. This treatment was built for the AI-consent
 * screen and the sign-up screen grew its own, simpler copy — a flat white fill
 * with a system-font "✓" in it — so the same control looked like two different
 * controls one screen apart. Anything that changes here must change for both,
 * which is only true while there is one of them.
 *
 * 🔴 Lang's sign-up frame (5265:67848) has NO checkbox: it runs the form
 * straight into "Create account". The attestation there is RES-196, ours for
 * compliance, so there is no frame to match it against — the consent screen is
 * the only drawn precedent and this is it.
 *
 * The checked state is not just a filled circle:
 *  - a white top sheen, rgba(255,255,255,0.5) fading out by 63.275%, over the
 *    flat #7E6869 — an SVG overlay because RN has no `backgroundImage`
 *  - "Inset Bubble (Dark)": an inner shadow plus a 1px lift above
 *  - no border; once it is on, the fill IS the shape
 *  - the 16pt glyph she drew, not a text tick
 */
const DIVIDER = "#7E6869"; // divider-line

export function ConsentCheckbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxOn]}>
      {checked ? (
        <>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="cbSheen" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
                  <Stop offset="0.63275" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#cbSheen)" />
            </Svg>
          </View>
          <CheckIcon size={16} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: DIVIDER,
    alignItems: "center",
    justifyContent: "center",
    // Clips the checked state's sheen to the circle.
    overflow: "hidden",
  },
  boxOn: {
    backgroundColor: DIVIDER,
    borderColor: "transparent",
    boxShadow:
      "inset 0 0 4px 0 rgba(0,0,0,0.22), 0 -1px 2px 0 rgba(0,0,0,0.16)",
  },
});

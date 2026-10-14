import { StyleSheet, TextStyle } from "react-native";
import { K } from "./colors";

export const fonts = {
  // Serif - for headlines and display text
  playfair: "PlayfairDisplay_400Regular",
  playfairBold: "PlayfairDisplay_700Bold",
  // Sans - for body text
  dmSans: "DMSans_400Regular",
  dmSansMedium: "DMSans_500Medium",
  dmSansBold: "DMSans_700Bold",
  // Caption serif (Figma "Caption Quadrant")
  quadrant: "QuadrantText_400Regular",
  // Display sans (Figma "Catalogue")
  catalogue: "Catalogue_400Regular",
  catalogueMedium: "Catalogue_500Medium",
  catalogueBold: "Catalogue_700Bold",
};

// Spacing tokens
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius tokens
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = StyleSheet.create({
  h1: {
    fontFamily: fonts.playfairBold,
    fontSize: 32,
    lineHeight: 40,
    color: K.text,
  } as TextStyle,
  h2: {
    fontFamily: fonts.playfairBold,
    fontSize: 24,
    lineHeight: 32,
    color: K.text,
  } as TextStyle,
  h3: {
    fontFamily: fonts.playfairBold,
    fontSize: 20,
    lineHeight: 28,
    color: K.text,
  } as TextStyle,
  body: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 24,
    color: K.text,
  } as TextStyle,
  bodyMedium: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 16,
    lineHeight: 24,
    color: K.text,
  } as TextStyle,
  bodySmall: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    lineHeight: 20,
    color: K.sub,
  } as TextStyle,
  caption: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    lineHeight: 16,
    color: K.faded,
  } as TextStyle,
  button: {
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    lineHeight: 24,
    color: K.bone, // Light text for dark button backgrounds
  } as TextStyle,
  label: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: K.text,
  } as TextStyle,
});

/**
 * The smallest lineHeight-to-fontSize ratio that renders a Catalogue descender
 * whole on Android.
 *
 * 🔴 ANDROID CLIPS GLYPHS THAT OVERFLOW THE LINE BOX. iOS (CoreText) does not,
 * so this is invisible on the simulator and on every Figma frame — it only
 * shows on a real Android device, and it shows as a "y", "p", "g" or "q" with
 * its tail sliced off flat.
 *
 * 🔴 DO NOT "FIX" A CLIPPED DESCENDER WITH `includeFontPadding: false`. That
 * prop strips the very padding Android uses to reserve descender room, so it
 * makes the cut WORSE. That attempt was made and reverted once already
 * (`be3d9e9`, PR #119). The fix is the opposite: give the line box more room.
 *
 * 🔑 MEASURED, not guessed. On an S24, "Your Type is ready." at 40pt:
 *
 *     lineHeight 44  →  descender 16px, ink stops 1px from the box edge
 *                       still 60px wide — a hard cut
 *     lineHeight 48  →  descender 21px, tail tapers 58→41 and ends
 *     lineHeight 52/56/60 → descender 21px, byte-identical tail
 *
 * The glyph is fully drawn from 48 on and extra room changes nothing, so
 * 48/40 = 1.2 is the floor, not a cushion.
 */
export const DESCENDER_SAFE_RATIO = 1.2;

/**
 * Lang's line height for a block, raised only if it would clip a descender.
 *
 * Pass the frame's own value: where it already clears the floor it is returned
 * untouched, so this never quietly overrides a deliberate design value — it
 * only catches the ones that would cut a tail off.
 */
export function lineBox(fontSize: number, frameLineHeight: number): number {
  return Math.max(frameLineHeight, Math.ceil(fontSize * DESCENDER_SAFE_RATIO));
}

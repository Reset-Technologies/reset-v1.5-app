import { StyleSheet, TextStyle } from "react-native";
import { K } from "./colors";

export const fonts = {
  /**
   * ⚠️ DEPRECATED — neither family is in Lang's type system, which has exactly
   * two: `Style/Sans serif` = Catalogue and `Style/Serif` = Quadrant Text
   * Trial. These predate her tokens. As of 2026-10-25 nothing in `src/`
   * references them; they are kept only so the `useFonts` map in `App.tsx`
   * still resolves. **Do not reach for them in new code** — use `catalogue*`
   * for sans and `quadrant` for a caption or a secondary line.
   *
   * ▶ Follow-up: once this has shipped and settled, drop them from `App.tsx`'s
   * `useFonts` and from package.json. That is a startup-cost change, so it is
   * deliberately not bundled with the typeface sweep.
   */
  playfair: "PlayfairDisplay_400Regular",
  playfairBold: "PlayfairDisplay_700Bold",
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

/**
 * The shared text presets.
 *
 * 📌 Families follow Lang's type system, which has exactly two: `Style/Sans
 * serif` = **Catalogue** and `Style/Serif` = **Quadrant Text Trial**. DM Sans
 * and Playfair are in neither — they predate her tokens. Her sizes already
 * matched these presets, so only the families moved:
 *
 *   h1 32  -> Title 1            Catalogue   h2 24 -> Title 2   Catalogue
 *   h3 20  -> Title 3            Catalogue   body  -> Body 1    Catalogue
 *   bodySmall 14 -> Body 2 Quandrant  QUADRANT (her only 14 regular is serif)
 *   caption 12   -> Caption Quandrant QUADRANT (her only 12 token is serif)
 *   label 14     -> Button            Catalogue Medium
 *
 * 🔴 `bodySmall` and `caption` become SERIF. That is the single biggest visual
 * change in the sweep — 46 callsites — and it is what her system says: every
 * 12-14px secondary line in her frames is Quadrant, which is how Explore's
 * `resultMeta` and `tileCount` already ship.
 *
 * ⚠️ `button` keeps 16 against her Button token's 14; the size axis is a
 * separate decision and is not part of a typeface sweep.
 */
export const typography = StyleSheet.create({
  h1: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    lineHeight: 40,
    color: K.text,
  } as TextStyle,
  h2: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    lineHeight: 32,
    color: K.text,
  } as TextStyle,
  h3: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 28,
    color: K.text,
  } as TextStyle,
  body: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 24,
    color: K.text,
  } as TextStyle,
  bodyMedium: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 16,
    lineHeight: 24,
    color: K.text,
  } as TextStyle,
  bodySmall: {
    fontFamily: fonts.quadrant,
    fontSize: 14,
    lineHeight: 20,
    color: K.sub,
  } as TextStyle,
  caption: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    lineHeight: 16,
    color: K.faded,
  } as TextStyle,
  button: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 16,
    lineHeight: 24,
    color: K.bone, // Light text for dark button backgrounds
  } as TextStyle,
  label: {
    fontFamily: fonts.catalogueMedium,
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

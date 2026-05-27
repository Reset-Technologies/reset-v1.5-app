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

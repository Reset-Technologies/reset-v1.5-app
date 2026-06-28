import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";

interface SavedMealsCardProps {
  onPress?: () => void;
}

// "Saved Meals" banner shown on the home screen below the meal recommendations
// (RES-161, Figma node 3543-5397). Tapping it navigates to the saved-meals
// view. Mirrors the sibling CheckInCard's banner styling + day/evening theming
// (nestedBg card, subtleText label/arrow) so the home feed stays consistent.
// The empty space above the label matches the design's banner, whose
// (here-hidden) action row reserves the top space.
export function SavedMealsCard({ onPress }: SavedMealsCardProps) {
  const { nestedBg, subtleText } = useAppPalette();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: nestedBg }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.topSpacer} />
      <View style={styles.row}>
        <Text style={[styles.title, { color: subtleText }]}>Saved Meals</Text>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14M13 5l7 7-7 7"
            stroke={subtleText}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: 4,
    gap: spacing.xl,
  },
  // Mirrors the banner's (hidden) action row, which reserves the top space.
  topSpacer: {
    height: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -0.32,
  },
});

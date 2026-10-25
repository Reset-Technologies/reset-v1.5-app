import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";

interface CheckInCardProps {
  onPress: () => void;
}

export function CheckInCard({ onPress }: CheckInCardProps) {
  const { nestedBg, subtleText } = useAppPalette();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: nestedBg }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text style={[styles.label, { color: subtleText }]}>Today's Entry</Text>
      <View style={styles.promptRow}>
        <Text style={[styles.prompt, { color: subtleText }]}>What went well today?</Text>
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
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 4,
    gap: spacing.xl,
  },
  label: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  prompt: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.32,
  },
});

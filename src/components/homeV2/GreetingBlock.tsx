import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";

interface GreetingBlockProps {
  nameGreeting: string;
  message: string;
}

export function GreetingBlock({ nameGreeting, message }: GreetingBlockProps) {
  const { textColor } = useAppPalette();
  return (
    <View style={styles.block}>
      <Text style={[styles.nameGreeting, { color: textColor }]}>{nameGreeting}</Text>
      <Text style={[styles.message, { color: textColor }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 4,
  },
  nameGreeting: {
    fontFamily: fonts.catalogueBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
  },
  message: {
    fontFamily: fonts.catalogue,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
});

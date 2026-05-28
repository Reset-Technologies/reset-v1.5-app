import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import { useApp } from "../../context/AppContext";
import { toMetabolicType } from "../../constants/colors";

const TYPE_LOGO = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
};

interface HomeHeaderProps {
  dateLabel: string;
  dayLabel?: string;
  title?: string;
}

export function HomeHeader({
  dateLabel,
  dayLabel = "Reset Day",
  title = "Today",
}: HomeHeaderProps) {
  const { textColor, subtleText } = useAppPalette();
  const { state } = useApp();
  const metabolicType =
    toMetabolicType(state.user.metabolicType) ?? "Explorer";
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaDate, { color: textColor }]}>{dateLabel}</Text>
          <Text style={[styles.metaDay, { color: subtleText }]}>{dayLabel}</Text>
        </View>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      </View>
      <View style={styles.mascotWrap}>
        <Image
          source={TYPE_LOGO[metabolicType]}
          style={styles.mascotImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: 0,
    gap: spacing.md,
    minHeight: 180,
  },
  textBlock: {
    flex: 1,
    gap: 4,
    paddingTop: 0,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
  },
  metaDate: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    lineHeight: 19,
  },
  metaDay: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    lineHeight: 19,
  },
  title: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.32,
  },
  mascotWrap: {
    marginTop: -65,
    marginRight: -40,
  },
  mascotImage: {
    width: 266,
    height: 266,
    transform: [{ rotate: "-10deg" }],
  },
});

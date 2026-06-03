import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { K, TC, toMetabolicType } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { useApp } from "../../context/AppContext";

const TYPE_LOGO = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
};

interface SurveyHeaderProps {
  step: number;
  totalSteps: number;
  label?: string;
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
}


export function SurveyHeader({
  step,
  totalSteps,
  label = "Today's Check-In",
  title,
  onClose,
}: SurveyHeaderProps) {
  const { state } = useApp();
  const metabolicType = toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const progress = Math.min(Math.max(step / totalSteps, 0), 1);
  const fillWidth = `${Math.max(5, progress * 100)}%` as const;

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={10}
          style={[styles.iconBtn, styles.iconBtnLeft]}
          activeOpacity={0.7}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>

        <Image source={TYPE_LOGO[metabolicType]} style={styles.logo} resizeMode="contain" />

        {/* Spacer keeps the logo centered now that the mute icon is gone
            (voice lives only in the Ester chat). */}
        <View style={[styles.iconBtn, styles.iconBtnRight]} />
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: fillWidth, backgroundColor: TC[metabolicType].bg }]} />
        </View>
      </View>

      <View style={styles.textBlock}>
        <View style={styles.labelRow}>
          <View style={styles.labelDot} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 8,
    alignItems: "stretch",
  },
  logo: {
    width: 30,
    height: 30,
    alignSelf: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 34,
  },
  progressRow: {
    alignItems: "center",
    marginTop: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  iconBtnLeft: {
    alignItems: "flex-start",
  },
  iconBtnRight: {
    alignItems: "flex-end",
  },
  closeGlyph: {
    fontSize: 18,
    color: K.brown,
    fontWeight: "400",
  },
  progressTrack: {
    height: 2,
    width: "40%",
    borderRadius: 4,
    backgroundColor: K.border,
    overflow: "hidden",
  },
  progressFill: {
    height: 2,
    backgroundColor: K.ochre,
    borderRadius: 4,
  },
  textBlock: {
    marginTop: 24,
    paddingHorizontal: 34,
    gap: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  labelDot: {
    width: 6.781,
    height: 6.781,
    borderRadius: 3.39,
    backgroundColor: "#92B4BD",
  },
  label: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
    textAlign: "left",
  },
  title: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    color: K.brown,
  },
});

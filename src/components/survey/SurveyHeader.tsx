import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Svg, { Path } from "react-native-svg";
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
  onMuteChange?: (muted: boolean) => void;
}


export function SurveyHeader({
  step,
  totalSteps,
  label = "Today's Check-In",
  title,
  onClose,
  onMuteChange,
}: SurveyHeaderProps) {
  const { state } = useApp();
  const metabolicType = toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const progress = Math.min(Math.max(step / totalSteps, 0), 1);
  const fillWidth = `${Math.max(5, progress * 100)}%` as const;
  const [muted, setMuted] = useState(false);

  const handleMutePress = () => {
    const next = !muted;
    setMuted(next);
    onMuteChange?.(next);
  };

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

        <TouchableOpacity
          onPress={handleMutePress}
          hitSlop={10}
          style={[styles.iconBtn, styles.iconBtnRight]}
          activeOpacity={0.7}
        >
          <MuteIcon color={K.brown} />
        </TouchableOpacity>
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

function MuteIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={12} viewBox="0 0 18 12" fill="none">
      <Path
        d="M14.0383 6.77908L11.9653 8.85233C11.8268 8.99066 11.6527 9.06149 11.443 9.06483C11.2335 9.06799 11.0562 8.99716 10.9113 8.85233C10.7664 8.70733 10.694 8.53166 10.694 8.32533C10.694 8.11899 10.7664 7.94333 10.9113 7.79833L12.9845 5.72533L10.9113 3.65233C10.7729 3.51383 10.7022 3.33974 10.699 3.13008C10.6957 2.92058 10.7664 2.74333 10.9113 2.59833C11.0562 2.45349 11.2319 2.38108 11.4383 2.38108C11.6448 2.38108 11.8204 2.45349 11.9653 2.59833L14.0383 4.67158L16.1112 2.59833C16.2497 2.45999 16.4238 2.38916 16.6335 2.38583C16.8432 2.38266 17.0204 2.45349 17.1653 2.59833C17.3101 2.74333 17.3825 2.91899 17.3825 3.12533C17.3825 3.33166 17.3101 3.50733 17.1653 3.65233L15.092 5.72533L17.1653 7.79833C17.3037 7.93683 17.3746 8.11091 17.3778 8.32058C17.3809 8.53008 17.3101 8.70733 17.1653 8.85233C17.0204 8.99716 16.8448 9.06958 16.6383 9.06958C16.4319 9.06958 16.2562 8.99716 16.1112 8.85233L14.0383 6.77908ZM3.7115 8.22533H0.90375C0.646083 8.22533 0.431 8.13908 0.2585 7.96658C0.0861666 7.79424 0 7.57916 0 7.32133V4.12933C0 3.87149 0.0861666 3.65641 0.2585 3.48408C0.431 3.31158 0.646083 3.22533 0.90375 3.22533H3.7115L6.70375 0.233076C6.94342 -0.00659108 7.21933 -0.0614248 7.5315 0.0685752C7.84367 0.198742 7.99975 0.434326 7.99975 0.775326V10.6753C7.99975 11.0163 7.84367 11.2519 7.5315 11.3821C7.21933 11.5121 6.94342 11.4572 6.70375 11.2176L3.7115 8.22533ZM6.49975 2.57533L4.34975 4.72533H1.49975V6.72533H4.34975L6.49975 8.87533V2.57533Z"
        fill={color}
      />
    </Svg>
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

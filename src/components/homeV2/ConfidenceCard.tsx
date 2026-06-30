import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";

interface ConfidenceCardProps {
  confidence: number | null;
  daysToFull: number;
}

const ICON_SIZE = 20;
const ICON_RADIUS = 8;
const ICON_CENTER = ICON_SIZE / 2;

function buildPieSlicePath(fraction: number): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0) return "";
  if (clamped >= 1) {
    return `M ${ICON_CENTER} ${ICON_CENTER - ICON_RADIUS}
            A ${ICON_RADIUS} ${ICON_RADIUS} 0 1 1 ${ICON_CENTER} ${ICON_CENTER + ICON_RADIUS}
            A ${ICON_RADIUS} ${ICON_RADIUS} 0 1 1 ${ICON_CENTER} ${ICON_CENTER - ICON_RADIUS} Z`;
  }
  const angle = clamped * 2 * Math.PI;
  const endX = ICON_CENTER + ICON_RADIUS * Math.sin(angle);
  const endY = ICON_CENTER - ICON_RADIUS * Math.cos(angle);
  const largeArc = clamped > 0.5 ? 1 : 0;
  return `M ${ICON_CENTER} ${ICON_CENTER}
          L ${ICON_CENTER} ${ICON_CENTER - ICON_RADIUS}
          A ${ICON_RADIUS} ${ICON_RADIUS} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function ConfidencePie({ fraction, color }: { fraction: number; color: string }) {
  const path = buildPieSlicePath(fraction);
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}>
      <Circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        r={ICON_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
      />
      {path ? <Path d={path} fill={color} /> : null}
    </Svg>
  );
}

export function ConfidenceCard({ daysToFull }: ConfidenceCardProps) {
  const { nestedBg, textColor, subtleText, evening } = useAppPalette();
  // RES-157: no numeric %. The pie fills as the user nears 100% confidence —
  // its empty slice is how many days remain.
  const fraction = Math.max(0, Math.min(1, (100 - daysToFull) / 100));
  const accent = evening ? "#B8D0D6" : K.brown;

  return (
    <View style={[styles.card, { backgroundColor: nestedBg }]}>
      <View style={styles.left}>
        <Text style={[styles.label, { color: textColor }]}>Confidence:</Text>
        <ConfidencePie fraction={fraction} color={accent} />
      </View>
      <View style={styles.right}>
        <Text style={[styles.hint, { color: textColor }]}>
          We're still learning your signals so continue to scan each day.
        </Text>
        {daysToFull > 0 ? (
          <Text style={[styles.sub, { color: subtleText }]}>
            Estimated {daysToFull} days til near 100% confidence
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 4,
    padding: spacing.md,
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
  },
  left: {
    gap: 8,
    alignItems: "center",
  },
  label: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  right: {
    flex: 1,
    gap: 7,
  },
  hint: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
  },
  sub: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
  },
});

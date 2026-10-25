import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";

interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
  onChange: (value: number) => void;
}

export function NumberStepper({
  value,
  min = 0,
  max = 24,
  step = 1,
  unitLabel,
  onChange,
}: NumberStepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDec = () => {
    if (canDecrement) onChange(Math.max(min, value - step));
  };
  const handleInc = () => {
    if (canIncrement) onChange(Math.min(max, value + step));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={handleDec}
          disabled={!canDecrement}
          activeOpacity={0.7}
          hitSlop={12}
          style={[styles.iconBtn, !canDecrement && styles.iconBtnDisabled]}
        >
          <Text style={styles.iconGlyph}>−</Text>
        </TouchableOpacity>

        <View style={styles.numberWrap}>
          <Text style={styles.number}>{value}</Text>
        </View>

        <TouchableOpacity
          onPress={handleInc}
          disabled={!canIncrement}
          activeOpacity={0.7}
          hitSlop={12}
          style={[styles.iconBtn, !canIncrement && styles.iconBtnDisabled]}
        >
          <Text style={styles.iconGlyph}>+</Text>
        </TouchableOpacity>
      </View>
      {unitLabel ? <Text style={styles.unit}>{unitLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 24,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    height: 113,
    width: "100%",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: {
    opacity: 0.3,
  },
  iconGlyph: {
    fontSize: 28,
    color: K.brown,
    fontWeight: "300",
    marginTop: -2,
  },
  numberWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  number: {
    fontFamily: fonts.catalogueBold,
    fontSize: 100,
    lineHeight: 110,
    letterSpacing: -6,
    color: K.brown,
    textAlign: "center",
  },
  unit: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.sub,
    textAlign: "center",
  },
});

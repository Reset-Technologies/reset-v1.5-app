import React from "react";
import { Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";

interface ContinueButtonProps {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
}

export function ContinueButton({
  label = "Continue",
  onPress,
  disabled = false,
  variant = "primary",
  style,
}: ContinueButtonProps) {
  const isGhost = variant === "ghost";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.button,
        isGhost ? styles.ghost : styles.primary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          isGhost ? styles.ghostLabel : styles.primaryLabel,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    padding: 16,
    borderRadius: 4,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  primary: {
    backgroundColor: K.brown,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: K.brown,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
  },
  primaryLabel: {
    color: K.white,
  },
  ghostLabel: {
    color: K.brown,
  },
});

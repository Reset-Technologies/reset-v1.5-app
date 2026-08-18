import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { K } from "../constants/colors";

export type AvatarState = "neutral" | "observing" | "celebrating";

interface AvatarProps {
  size?: number;
  state?: AvatarState;
}

// Different background colors based on Ester's state
const STATE_COLORS: Record<AvatarState, string> = {
  neutral: K.ochre,      // Default warm gold
  observing: K.blue,     // Muted blue when analyzing
  celebrating: K.ok,     // Green when celebrating
};

// Different expressions based on state
const STATE_EXPRESSIONS: Record<AvatarState, string> = {
  neutral: "E",
  observing: "👀",
  celebrating: "🎉",
};

export function Avatar({ size = 48, state = "neutral" }: AvatarProps) {
  const backgroundColor = STATE_COLORS[state];
  const expression = STATE_EXPRESSIONS[state];
  const isEmoji = expression.length > 1;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        }
      ]}
    >
      <Text style={[styles.content, { fontSize: isEmoji ? size * 0.4 : size * 0.45 }]}>
        {expression}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: K.brown,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    color: K.white,
    fontWeight: "700",
  },
});

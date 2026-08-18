import React from "react";
import { View, StyleSheet, Text, Image } from "react-native";
import { K } from "../constants/colors";

// Ester's actual mark, not a stand-in letter. The full-colour cut (the same one
// EsterChatScreen uses on its light theme) rather than the silver badge: with no
// tinted disc behind it the mark sits straight on the screen background, and
// silver all but disappears against bone.
const ESTER_MARK = require("../../assets/images/ester-avatar.png");

// Ester at rest is drawn bare, so she is not boxed into the disc the emoji
// states need. The box itself stays `size` square so every existing call site
// lays out exactly as before — only what's painted inside it changes.
const MARK_SCALE = 0.825;

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

// Expression overlay for the transient states. `neutral` is null because that
// is Ester at rest — her own mark says who she is better than a glyph can.
// The other two are momentary reactions layered on top of that identity, so
// they stay as expressions.
const STATE_EXPRESSIONS: Record<AvatarState, string | null> = {
  neutral: null,
  observing: "👀",
  celebrating: "🎉",
};

export function Avatar({ size = 48, state = "neutral" }: AvatarProps) {
  const expression = STATE_EXPRESSIONS[state];
  const isResting = expression === null;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        // The tinted disc (and the shadow that lifts it off the page) belongs to
        // the emoji states only — they need a surface to read against. Ester's
        // own mark carries its own colour and shape, so it gets neither.
        !isResting && styles.disc,
        !isResting && {
          borderRadius: size / 2,
          backgroundColor: STATE_COLORS[state],
        },
      ]}
    >
      {isResting ? (
        <Image
          source={ESTER_MARK}
          style={{ width: size * MARK_SCALE, height: size * MARK_SCALE }}
          resizeMode="contain"
        />
      ) : (
        <Text style={[styles.content, { fontSize: size * 0.4 }]}>
          {expression}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  disc: {
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

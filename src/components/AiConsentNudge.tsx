import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleProp,
  ViewStyle,
} from "react-native";
import { K } from "../constants/colors";
import { typography } from "../constants/typography";
import { useAiConsentGate } from "../hooks/useAiConsentGate";

interface Props {
  /** Called after consent is successfully granted (e.g. to refetch content). */
  onGranted?: () => void;
  /** Button background — pass the surface accent so it blends in. */
  accent?: string;
  textColor?: string;
  subtleText?: string;
  cardBg?: string;
  borderColor?: string;
  /** Tighter copy + padding for height-constrained layouts (e.g. Next Meal). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

// RES-188 — shown in place of AI-generated content (insight blurbs, tooltip
// takes) when the user hasn't granted third-party-AI consent. It's the inline
// version of Bryan's "short explanation + option to consent then": a brief
// disclosure with a button that grants consent and loads the real content.
export function AiConsentNudge({
  onGranted,
  accent = K.brown,
  textColor = K.text,
  subtleText = K.sub,
  cardBg = K.white,
  borderColor = K.border,
  compact = false,
  style,
}: Props) {
  const { grant } = useAiConsentGate();
  const [busy, setBusy] = useState(false);

  const handleTurnOn = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await grant();
    setBusy(false);
    if (ok) onGranted?.();
    else
      Alert.alert(
        "Couldn't update",
        "We couldn't turn that on just now. Please try again.",
      );
  };

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: cardBg, borderColor },
        style,
      ]}
    >
      {!compact ? (
        <Text style={[styles.title, { color: textColor }]}>
          AI personalization is off
        </Text>
      ) : null}
      <Text style={[styles.body, { color: subtleText }]}>
        {compact
          ? "Turn on AI personalization to see Ester's take — shares your data with OpenAI & ElevenLabs (voice)."
          : "Turn it on to get Ester's personalized read here. This shares your first name, chats, check-in answers, and scan wellness signals with our AI partners (OpenAI, and ElevenLabs for voice)."}
      </Text>
      <TouchableOpacity
        style={[
          styles.btn,
          compact && styles.btnCompact,
          { backgroundColor: accent },
        ]}
        onPress={handleTurnOn}
        activeOpacity={0.85}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator size="small" color={K.bone} />
        ) : (
          <Text style={styles.btnText}>Turn on AI personalization</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardCompact: {
    padding: 12,
    gap: 7,
  },
  title: {
    ...typography.bodyMedium,
    fontSize: 15,
  },
  body: {
    ...typography.caption,
    lineHeight: 19,
  },
  btn: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCompact: {
    marginTop: 2,
    paddingVertical: 9,
  },
  btnText: {
    ...typography.bodyMedium,
    color: K.bone,
    fontSize: 14,
  },
});

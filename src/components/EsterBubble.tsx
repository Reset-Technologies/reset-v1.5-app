import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { K } from "../constants/colors";
import { typography, spacing, radius } from "../constants/typography";
import { Avatar, AvatarState } from "./Avatar";

export type EsterVariant = "greeting" | "inline" | "observation" | "nudge";

interface EsterBubbleProps {
  message: string;
  variant?: EsterVariant;
  avatarState?: AvatarState;
  showAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ester Component System
 *
 * 4 Variants:
 * - greeting: Large bubble for Home screen, prominent avatar
 * - inline: Small bubble after check-in or quick responses
 * - observation: Card style for nudge slot, observational messages
 * - nudge: Card with action prompt, used for prompts like scan reminders
 */
export function EsterBubble({
  message,
  variant = "greeting",
  avatarState = "neutral",
  showAvatar = true,
  style,
}: EsterBubbleProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <View style={[styles.container, config.containerStyle, style]}>
      {showAvatar && (
        <Avatar size={config.avatarSize} state={avatarState} />
      )}
      <View style={[styles.bubble, config.bubbleStyle, !showAvatar && styles.bubbleNoAvatar]}>
        <Text style={[styles.text, config.textStyle]} numberOfLines={config.maxLines}>
          {message}
        </Text>
      </View>
    </View>
  );
}

// Variant configurations
const VARIANT_CONFIG: Record<EsterVariant, {
  avatarSize: number;
  containerStyle: ViewStyle;
  bubbleStyle: ViewStyle;
  textStyle: object;
  maxLines?: number;
}> = {
  greeting: {
    avatarSize: 48,
    containerStyle: {
      alignItems: "flex-start",
    },
    bubbleStyle: {
      backgroundColor: K.bone,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderTopLeftRadius: 4,
    },
    textStyle: {
      ...typography.body,
      fontSize: 17,
      lineHeight: 26,
    },
    maxLines: undefined,
  },
  inline: {
    avatarSize: 32,
    containerStyle: {
      alignItems: "flex-start",
    },
    bubbleStyle: {
      backgroundColor: K.bone,
      padding: spacing.md,
      borderRadius: radius.md,
      borderTopLeftRadius: 4,
    },
    textStyle: {
      ...typography.bodySmall,
      fontSize: 14,
      lineHeight: 20,
    },
    maxLines: undefined,
  },
  observation: {
    avatarSize: 36,
    containerStyle: {
      alignItems: "flex-start",
    },
    bubbleStyle: {
      backgroundColor: K.blue,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderTopLeftRadius: 4,
    },
    textStyle: {
      ...typography.body,
      fontSize: 15,
      lineHeight: 22,
      color: K.brown,
    },
    maxLines: undefined,
  },
  nudge: {
    avatarSize: 40,
    containerStyle: {
      alignItems: "flex-start",
    },
    bubbleStyle: {
      backgroundColor: K.ochre,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderTopLeftRadius: 4,
    },
    textStyle: {
      ...typography.bodyMedium,
      fontSize: 15,
      lineHeight: 22,
      color: K.brown,
    },
    maxLines: undefined,
  },
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.md,
  },
  bubble: {
    flex: 1,
  },
  bubbleNoAvatar: {
    borderTopLeftRadius: radius.lg,
  },
  text: {
    color: K.text,
  },
});

// Greeting card - top of Home screen
// Dynamic message based on signals (scan data, check-in, behavioral pattern, or meal feedback)
export function EsterGreeting({
  message,
  subMessage,
  avatarState = "neutral",
}: {
  message: string;
  subMessage?: string;
  avatarState?: AvatarState;
}) {
  return (
    <View style={greetingStyles.container}>
      <Avatar size={48} state={avatarState} />
      <View style={greetingStyles.content}>
        <Text style={greetingStyles.message}>{message}</Text>
        {subMessage && (
          <Text style={greetingStyles.subMessage}>{subMessage}</Text>
        )}
      </View>
    </View>
  );
}

const greetingStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: K.bone,
    padding: spacing.lg,
    paddingVertical: 20,
    borderRadius: radius.lg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  message: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 26,
    color: K.brown,
  },
  subMessage: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: K.textMuted,
    marginTop: 4,
  },
});

// Observation card variant for nudge slot
export function EsterObservation({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <View style={observationStyles.card}>
      <View style={observationStyles.header}>
        <Avatar size={32} state="observing" />
        <Text style={observationStyles.label}>Ester noticed</Text>
      </View>
      <Text style={observationStyles.message}>{message}</Text>
    </View>
  );
}

const observationStyles = StyleSheet.create({
  card: {
    backgroundColor: K.blue,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: K.brown,
    opacity: 0.7,
  },
  message: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: K.brown,
  },
});

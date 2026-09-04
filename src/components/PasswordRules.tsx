import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { typography } from "../constants/typography";

/**
 * The password policy, and the UI that explains it — in ONE place.
 *
 * 🔴 Why shared: sign-up and password-reset each had their own copy of the
 * rule and they had already drifted. Reset mirrored the backend's
 * IsStrongPassword (min 8 + lower + upper + number + symbol); sign-up checked
 * `length >= 8` while its placeholder claimed the full set. A user could
 * create an account with a password the reset flow would refuse to restore.
 *
 * Both screens also failed the same way: the rules were invisible (placeholder
 * text, or nowhere), and an invalid password produced a silently DISABLED
 * button — no error, nothing to read, nothing to fix. Keep the two together so
 * the policy and its explanation can only ever move as a unit.
 *
 * 📌 Kept in sync with the backend: see auth.service.ts register(), which
 * enforces the same set server-side.
 */
export const PASSWORD_RULES: {
  key: string;
  label: string;
  test: (v: string) => boolean;
}[] = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "One number", test: (v) => /[0-9]/.test(v) },
  { key: "symbol", label: "One symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

/**
 * State for a password field that has to explain itself.
 *
 * `flag()` is called on a failed submit: it reddens the unmet rules and shakes
 * them. Red appears only AFTER an attempt — reddening rules someone has not
 * had a chance to satisfy yet reads as being told off for typing — and clears
 * itself the moment the password becomes valid, so the correction is
 * acknowledged immediately rather than on the next submit.
 */
export function usePasswordRules(password: string) {
  const failedRules = PASSWORD_RULES.filter((r) => !r.test(password));
  const isValid = failedRules.length === 0;
  const [showError, setShowError] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isValid) setShowError(false);
  }, [isValid]);

  const flag = () => {
    setShowError(true);
    shake.setValue(0);
    Animated.sequence(
      [1, -1, 1, 0].map((toValue) =>
        Animated.timing(shake, {
          toValue,
          duration: 60,
          useNativeDriver: true,
        }),
      ),
    ).start();
  };

  /** Rule keys that failed, for analytics. NEVER the password itself. */
  const failedKeys = () => failedRules.map((r) => r.key).join(",");

  return { failedRules, isValid, showError, shake, flag, failedKeys };
}

interface PasswordRulesProps {
  password: string;
  showError: boolean;
  shake: Animated.Value;
  /** Colours differ between the onboarding and auth palettes. */
  metColor: string;
  unmetColor: string;
  errorColor: string;
}

export function PasswordRules({
  password,
  showError,
  shake,
  metColor,
  unmetColor,
  errorColor,
}: PasswordRulesProps) {
  return (
    <Animated.View
      style={{
        transform: [
          {
            translateX: shake.interpolate({
              inputRange: [-1, 1],
              outputRange: [-6, 6],
            }),
          },
        ],
      }}
      accessibilityLiveRegion={showError ? "assertive" : "none"}
    >
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const color = met ? metColor : showError ? errorColor : unmetColor;
        return (
          <View key={rule.key} style={styles.row}>
            <Text style={[styles.mark, { color }]}>{met ? "✓" : "•"}</Text>
            <Text style={[styles.text, { color }]}>{rule.label}</Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  mark: {
    ...typography.bodySmall,
    width: 12,
    textAlign: "center",
  },
  text: {
    ...typography.bodySmall,
  },
});

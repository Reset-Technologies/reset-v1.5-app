import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fonts } from "../../constants/typography";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "TypeReady">;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const ON_BONE_SUBTLE = "#7E6869";

/**
 * "Your Type is ready." — the screen between consent and the paywall.
 *
 * 🔒 Copy is locked: Screen Copy row 13 of the V1 onboarding handoff. Headline,
 * body and CTA are verbatim and must not be reworded here.
 *
 * 🔴 THE TYPE IS FULLY HIDDEN. No name, no one-liner, no mascot, no blurred
 * card — Screen Copy row 12 cuts the blurred card everywhere before purchase,
 * and the whole point of the reorder (Bryan, 2026-09-29) is that the Type is
 * what the member buys. Anything that leaks it here gives away the thing the
 * paywall is selling.
 *
 * The body deliberately says a plan choice comes next rather than promising a
 * reveal: per the Sheet, "Unlock my type!" would promise a reveal and deliver a
 * price screen.
 *
 * Returning unpaid members resume here too (Flow row 13), which is why this
 * screen reads no state — there is nothing to show that depends on it.
 */
export function TypeReadyScreen({ navigation }: Props) {
  useEffect(() => {
    logEvent("onboarding_type_ready");
  }, []);

  const handleSeePlans = () => {
    logEvent("onboarding_type_ready_seePlansCTA");
    navigation.navigate("Paywall");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.headline}>Your Type is ready.</Text>
        <Text style={styles.supporting}>
          Choose a plan to see your Type, what it means, and your first meal.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={handleSeePlans}
          accessibilityRole="button"
          accessibilityLabel="See plans"
        >
          <Text style={styles.ctaLabel}>See plans</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BONE },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  headline: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.32,
    color: MAROON,
    textAlign: "center",
  },
  supporting: {
    marginTop: 16,
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: ON_BONE_SUBTLE,
    textAlign: "center",
  },
  footer: { paddingHorizontal: 24, paddingBottom: 24 },
  cta: {
    backgroundColor: MAROON,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: BONE,
  },
});

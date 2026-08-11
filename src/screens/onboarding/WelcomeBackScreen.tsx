import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { Button, Avatar } from "../../components";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "WelcomeBack">;

/**
 * RES-207 — the one screen a returning BetterWell member sees that nobody else
 * does. They signed in with their old credentials and the backend created
 * their account just-in-time, so from their point of view an app they paid for
 * has been replaced by one they've never seen.
 *
 * Bryan's decision: welcome them back, then run ordinary onboarding — the
 * questionnaire and scan happen exactly as they do for a new member. Only two
 * things are removed, and both because they'd be insulting to someone who
 * already has an account and already pays: creating an account, and paying
 * again.
 *
 * So this screen has one job — explain the discontinuity before it becomes
 * confusing. It deliberately does not sell, and it does not apologise.
 */
export function WelcomeBackScreen({ navigation }: Props) {
  const { state } = useApp();
  const firstName = state.auth.authUser?.firstName?.trim();

  useEffect(() => {
    logEvent("legacy_welcome_back");
  }, []);

  const handleContinue = () => {
    logEvent("legacy_welcome_back_continueCTA");
    // Straight to the same place PreScan's primary CTA goes: calibration feeds
    // the scan. Everything downstream is the ordinary onboarding flow.
    navigation.navigate("Calibration");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.avatarWrap}>
          <Avatar size={56} />
        </View>

        <Text style={styles.heading}>
          {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        </Text>

        <Text style={styles.body}>
          Reset has been rebuilt from the ground up. Your account and your
          subscription came with you — there's nothing to buy again.
        </Text>

        <Text style={styles.body}>
          Because this version works differently, I need to get to know you
          again: a few questions and a quick scan. It takes a couple of
          minutes, and then your meals are built around what I find.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button title="Let's get started" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.cream,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 20,
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  heading: {
    fontFamily: fonts.playfairBold,
    fontSize: 32,
    lineHeight: 40,
    color: K.text,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 24,
    color: K.textMuted,
    textAlign: "center",
  },
  footer: {
    padding: 24,
  },
});

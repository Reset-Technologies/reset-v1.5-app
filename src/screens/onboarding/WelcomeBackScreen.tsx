import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { Button } from "../../components";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";

// Ester's real mark, deliberately local to this screen rather than folded into
// `Avatar`. Avatar is shared by ~10 other surfaces (the onboarding run, the
// check-in reply, scan results) and its resting state is the "E" badge those
// screens are designed around — changing it there would restyle the whole app
// as a side effect of this one screen. The full-colour cut, not the silver
// badge: with no tinted disc behind it, silver disappears against bone.
const ESTER_MARK = require("../../../assets/images/ester-avatar.png");

// The box stays 92 so the surrounding layout is measured against a constant,
// while the mark itself is inset — it is drawn bare here, with none of the
// disc-and-shadow treatment Avatar gives its emoji states.
const MARK_BOX = 92;
const MARK_SIZE = MARK_BOX * 0.825;

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
          {/* Larger than the usual 56: this is the first screen a returning
              member sees, and Ester introduces herself on it. */}
          <View style={styles.markBox}>
            <Image
              source={ESTER_MARK}
              style={styles.mark}
              resizeMode="contain"
            />
          </View>
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
  markBox: {
    width: MARK_BOX,
    height: MARK_BOX,
    justifyContent: "center",
    alignItems: "center",
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  avatarWrap: {
    alignItems: "center",
    // Pulls the heading up under the mark. `content` sets gap: 20 for every
    // child, which is more air than this pairing wants, so this trims the
    // avatar-to-heading gap to 12 without touching the rest of the screen.
    marginBottom: -8,
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

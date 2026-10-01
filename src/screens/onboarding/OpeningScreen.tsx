import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { VideoView, useVideoPlayer } from "expo-video";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { logEvent } from "../../services/braze";
import { OnboardingCta, ResetWordmark } from "../../components";

type Props = NativeStackScreenProps<any, "Opening">;

const INTRO_VIDEO = require("../../../assets/videos/education-intro.mp4");

/**
 * The Opening — the first screen of onboarding, Flow row 1 (`opening`),
 * Lang's "Info 1" frame (Figma 5251:43275).
 *
 * 🔴 THIS REPLACED A FOUR-SLIDE EDUCATION CAROUSEL. The Sheet has exactly one
 * opening screen: Flow row 1 is a single frame, and there is no Screen Copy row
 * for any second, third or fourth slide. The carousel's titles ("Your body has
 * its own rules.", "Finally lose the weight", …) were ours, never Bryan's.
 * The Edit Log shows him trimming this screen rather than growing it — he cut
 * the longer supporting line with the note "The next screen introduces the
 * scan. Two screens in a row said the same thing."
 *
 * 🔴 THE COPY IS THE SHEET'S, NOT THE FRAME'S. The frame still shows "Lose
 * weight your way" without the full stop, and the old supporting line "Your
 * metabolic type shows how your body actually processes energy…" — which is
 * verbatim what row 1's `Figma shows now` column flags as the placeholder to
 * replace. Layout from Lang, words from Bryan.
 *
 * ⚠️ The video is the one the carousel used. Lang's mock shows different
 * footage (a woman by a window); ours is a family/food reel. The frame only
 * specifies "full-bleed media here", so this is a question of which clip, not
 * of structure — raised with Lang, not a blocker.
 */
export function OpeningScreen({ navigation }: Props) {
  const player = useVideoPlayer(INTRO_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    logEvent("onboarding_opening");
  }, []);

  // This screen stays mounted under the whole scan flow once Pre-scan is
  // pushed on top, so without this the loop keeps decoding behind it. Same
  // treatment the carousel had.
  useEffect(() => {
    const blurUnsub = navigation.addListener("blur", () => player.pause());
    const focusUnsub = navigation.addListener("focus", () => player.play());
    return () => {
      blurUnsub();
      focusUnsub();
    };
  }, [navigation, player]);

  const handleGetStarted = () => {
    logEvent("onboarding_opening_getStartedCTA");
    navigation.navigate("PreScan");
  };

  const handleLogin = () => {
    logEvent("onboarding_opening_loginCTA");
    navigation.navigate("Login");
  };

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* The frame's "gradient overlay behind bottom actions" — a bottom scrim
          so the headline and buttons hold over whatever frame the video is on.
          Starts around the headline rather than at the buttons, since the copy
          is the part that sits over the busiest footage.
          🔑 Weighted harder than a first guess at it: Lang's mock sits over a
          dim interior shot, but this clip is daylight exteriors and a bright
          kitchen, so a scrim tuned to her still left the headline sitting on a
          lit face. It has to hold for the whole 27s loop, not one frame. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="openingScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.30" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.55" stopColor="#000000" stopOpacity="0.52" />
              <Stop offset="0.78" stopColor="#000000" stopOpacity="0.82" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.93" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#openingScrim)" />
        </Svg>
      </View>

      {/* 🔑 TOP inset only. The frame's 48pt bottom padding is measured from
          the SCREEN edge and already contains the home-indicator band (the
          indicator sits 8 from the bottom, so the buttons still clear it by
          ~40). Taking the safe-area bottom inset as well stacked 48 on top of
          ~34 and lifted both buttons ~30pt off where Lang put them. */}
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {/* Frame: wordmark 72x24, centred, 62 from the top. */}
        <View style={styles.wordmarkRow}>
          <ResetWordmark />
        </View>

        <View style={styles.spacer} />

        {/* Frame's "Bottom content wrapper": copy and actions, 40 apart. */}
        <View style={styles.bottom}>
          <View style={styles.copy}>
            {/* Screen Copy row 1 `opening.headline` (Final). */}
            <Text style={styles.headline}>Lose weight your way.</Text>
            {/* Row 1 `opening.body` (Final, Edited). */}
            <Text style={styles.body}>
              Find your Type, then get meals that fit it.
            </Text>
          </View>

          <View style={styles.actions}>
            {/* Flow row 1: "Get started → Pre-scan. Log in → account routing." */}
            <OnboardingCta title="Get started" onPress={handleGetStarted} />
            <OnboardingCta
              title="Log in"
              variant="ghostFilled"
              onPress={handleLogin}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.brown },
  safe: { flex: 1 },
  // 62 from the top of the frame, less the status bar the SafeAreaView already
  // insets past.
  wordmarkRow: { alignItems: "center", paddingTop: 18 },
  spacer: { flex: 1 },
  // Frame: px 24, pb 48, copy and actions 40 apart.
  bottom: { paddingHorizontal: 24, paddingBottom: 48, gap: 40 },
  copy: { gap: 20 },
  headline: {
    fontFamily: fonts.catalogue,
    fontSize: 48,
    // 🔴 No `includeFontPadding: false`, and the line box has to clear the
    // descenders in "weight" and "your" — the same trap that flat-cut the "y"
    // on Type ready and on the PR119 onboarding title.
    lineHeight: 56,
    letterSpacing: -0.48,
    color: K.white,
  },
  body: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.16,
    color: K.white,
    opacity: 0.8,
  },
  actions: { gap: 12 },
});

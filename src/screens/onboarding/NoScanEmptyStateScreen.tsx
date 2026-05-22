import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Line, Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { logEvent } from "../../services/braze";
import { SampleMealSheet } from "./SampleMealSheet";

type Props = NativeStackScreenProps<any, "NoScanEmptyState">;

const SCREEN_W = Dimensions.get("window").width;

const BRAND_LOGO = require("../../../assets/images/brand-logo-silver.png");
const TYPES_GRAPHIC = require("../../../assets/images/onboarding/prescan-types.png");
const MEAL_VISUALS = require("../../../assets/images/onboarding/meal-plan-visuals.png");
const BLURRED_SCORE = require("../../../assets/images/onboarding/blurred-score-40.png");

const BLUE_SURFACE = "#E9F0F2";
const ON_BLUE_SUBTLE = "#7E6869";
const DIVIDER = "#C3B9BA";

function ArrowForward({ size = 20, color = K.brown }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M13 5l7 7-7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, {
          toValue: -3,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(380),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, y]);
  return (
    <Animated.View style={[styles.dot, { transform: [{ translateY: y }] }]} />
  );
}

const TYPING_DURATION_MS = 1600;

function EsterIntroCard({ onArrowPress }: { onArrowPress: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Phase 1: tick the reveal state after the typing window. LayoutAnimation
  // smooths the bubble's height change as the dots row swaps for the text.
  useEffect(() => {
    const t = setTimeout(() => {
      LayoutAnimation.configureNext({
        duration: 300,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      setRevealed(true);
    }, TYPING_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  // Phase 2: fade in the text + arrow after they're actually mounted.
  // Doing this in a second effect avoids the mount-after-start race with
  // the native driver (which leaves the views stuck at opacity 0).
  useEffect(() => {
    if (!revealed) return;
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [revealed, contentOpacity]);

  return (
    <View style={styles.esterCard}>
      <View style={{ flex: 1, gap: 4 }}>
        {!revealed ? (
          <View style={styles.dotsRow}>
            <TypingDot delay={0} />
            <TypingDot delay={140} />
            <TypingDot delay={280} />
          </View>
        ) : (
          <Animated.View style={{ opacity: contentOpacity, gap: 4 }}>
            <Text style={styles.esterIntroBold}>Hi, I&apos;m Ester!</Text>
            <Text style={styles.esterIntroBody}>
              Your personal nutritionist. Before I make recommendations, I&apos;d love to learn a little about you.
            </Text>
          </Animated.View>
        )}
      </View>
      {revealed && (
        <Animated.View style={{ opacity: contentOpacity }}>
          <TouchableOpacity
            style={styles.esterArrowOutline}
            onPress={onArrowPress}
            activeOpacity={0.7}
            testID="noScanEmptyState_esterArrowCTA"
          >
            <ArrowForward size={14} color={K.brown} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// Reuses the same fanned-card PNG that PreScanScreen renders, so the two
// pre-scan surfaces feel like one continuous teaser visually.
function TypeCardsFan() {
  // Render the image wider than the banner so the cards visually bleed past
  // the rounded edges (Figma "Profile Slider" sits 350px wide inside a much
  // narrower banner; the cards on the ends are intentionally clipped).
  const w = Math.round(SCREEN_W * 1.15);
  const h = Math.round(w * (880 / 1206));
  return (
    <View style={styles.typeFanWrap}>
      <Image
        source={TYPES_GRAPHIC}
        style={{ width: w, height: h }}
        resizeMode="contain"
      />
    </View>
  );
}

function MealCardsStack() {
  // Single baked composition (cards fan + Ester bubble). Sits in the
  // banner's flex flow as the last flex child (sets the banner's height),
  // left-aligned with bleeds that push it to the banner's outer bottom-
  // left corner. The "See a sample meal" CTA is absolutely positioned on
  // top — see the meal banner JSX.
  const w = Math.round((SCREEN_W - 48 /* page padding */ - 32 /* banner padding */) * 1.125);
  // Natural aspect (no height padding) so the image content fills the
  // container edge-to-edge — with `contain`, extra height would become
  // transparent padding and leave a gap at the banner's bottom edge.
  const h = Math.round(w * (501 / 1056));
  return (
    <View style={styles.mealVisualsWrap}>
      <Image
        source={MEAL_VISUALS}
        style={{ width: w, height: h }}
        resizeMode="contain"
      />
    </View>
  );
}

// ResetScoreMeter — uniform light-blue semicircle of ticks (no progress
// fill, no needle), matching Figma node 1623:30326. The score "40" sits
// blurred just below the arc. Built inline (not ScoreRing) because the
// shared component always paints a maroon "filled" arc up to the score.
function ResetScoreMeter() {
  // Wider than the banner content area — wrap bleeds past banner padding
  // via marginHorizontal: -16 (see gaugeWrap style).
  const W = SCREEN_W - 48;
  const H = Math.round(W * 0.62);
  const CENTER_X = W / 2;
  const CENTER_Y = H - 30;
  const INNER_R = Math.round(W * 0.35);
  const TICK_LEN = Math.round(W * 0.11);
  const TICK_WIDTH = 2.5;
  const TOTAL_TICKS = 91;
  const START_DEG = -90;
  const SWEEP_DEG = 180;
  const TICK_COLOR = "#B8D0D6";

  const polar = (deg: number, r: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return {
      x: CENTER_X + r * Math.cos(rad),
      y: CENTER_Y + r * Math.sin(rad),
    };
  };

  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {Array.from({ length: TOTAL_TICKS }).map((_, i) => {
          const tFrac = i / (TOTAL_TICKS - 1);
          const angle = START_DEG + tFrac * SWEEP_DEG;
          const inner = polar(angle, INNER_R);
          const outer = polar(angle, INNER_R + TICK_LEN);
          return (
            <Line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={TICK_COLOR}
              strokeWidth={TICK_WIDTH}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </View>
  );
}

// BlurredScore — pre-rendered PNG of the blurred "40" so the meter ticks
// stay crisp. The image is fully transparent outside the smudge so it
// composites cleanly over the meter without a visible bounding box.
function BlurredScore() {
  return (
    <View style={styles.gaugeScoreWrap} pointerEvents="none">
      <Image
        source={BLURRED_SCORE}
        style={styles.gaugeScoreImage}
        resizeMode="contain"
      />
    </View>
  );
}

function FeaturedCta({
  label,
  onPress,
  testID,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.featuredCtaRow}
      onPress={onPress}
      activeOpacity={0.85}
      testID={testID}
    >
      <View style={compact ? styles.featuredCtaLabelCompact : styles.featuredCtaLabel}>
        <Text style={compact ? styles.featuredCtaTextCompact : styles.featuredCtaText}>
          {label}
        </Text>
      </View>
      <View style={compact ? styles.featuredCtaArrowCompact : styles.featuredCtaArrow}>
        <ArrowForward size={compact ? 16 : 20} color={K.brown} />
      </View>
    </TouchableOpacity>
  );
}

export function NoScanEmptyStateScreen({ navigation }: Props) {
  const [sampleMealVisible, setSampleMealVisible] = useState(false);

  useEffect(() => {
    logEvent("onboarding_no_scan_empty_state");
  }, []);

  const handleScan = () => {
    logEvent("onboarding_no_scan_empty_state_scanCTA");
    // Every scan-oriented CTA on this screen (Ester arrow, "Start your
    // scan", "Scan to find out yours") routes the user back to PreScan,
    // where the actual scan flow begins.
    navigation.navigate("PreScan");
  };

  const handleSampleMeal = () => {
    logEvent("onboarding_no_scan_empty_state_sampleMealCTA");
    setSampleMealVisible(true);
  };

  const handleSampleMealScan = () => {
    setSampleMealVisible(false);
    handleScan();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Image source={BRAND_LOGO} style={styles.topLogo} resizeMode="contain" />

          <EsterIntroCard onArrowPress={handleScan} />

          {/* Section 1 — Type cards teaser */}
          <View style={styles.banner}>
            <View style={styles.bannerHeader}>
              <Text style={styles.bannerTitle}>One of these sounds like your life</Text>
              <Text style={styles.bannerSub}>
                Your body&apos;s sending you signals.{" "}
                <Text style={styles.bannerSubBold}>We tell you what they mean.</Text>
              </Text>
            </View>
            <TypeCardsFan />
            <FeaturedCta
              label="Start your scan"
              onPress={handleScan}
              testID="noScanEmptyState_scanCTA_types"
            />
          </View>

          {/* Section 2 — Meal plan teaser */}
          <View style={styles.banner}>
            <View style={styles.bannerHeader}>
              <Text style={styles.bannerTitle}>A meal plan built for your body</Text>
              <Text style={styles.bannerSub}>
                Daily recommendations work with how you&apos;re feeling
              </Text>
            </View>
            <MealCardsStack />
            <View style={styles.mealCtaOverlay}>
              <FeaturedCta
                label="See a sample meal"
                onPress={handleSampleMeal}
                testID="noScanEmptyState_sampleMealCTA"
                compact
              />
            </View>
          </View>

          {/* Section 3 — Reset Score teaser */}
          <View style={styles.banner}>
            <View style={styles.bannerHeader}>
              <Text style={styles.bannerTitle}>The Reset Score</Text>
              <Text style={styles.bannerSub}>
                A reflection of your health, day by day. All it takes is a scan.
              </Text>
            </View>
            <View style={styles.gaugeWrap}>
              <ResetScoreMeter />
              {/* Blurred "40" sits behind the CTA. We can't use BlurView
                  here — it would blur the meter ticks behind the score
                  too. Instead we stamp the text many times at small
                  offsets with low opacity, which only smudges the glyphs
                  themselves and leaves the meter alone. */}
              <BlurredScore />
              {/* CTA renders after the score, so it sits on top in z-order
                  and visually overlaps the blurred number. */}
              <View style={styles.gaugeCtaWrap} pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.gaugeCta}
                  onPress={handleScan}
                  activeOpacity={0.85}
                  testID="noScanEmptyState_scanCTA_score"
                >
                  <Text style={styles.gaugeCtaText}>Scan to find out yours</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <SampleMealSheet
        visible={sampleMealVisible}
        onClose={() => setSampleMealVisible(false)}
        onScan={handleSampleMealScan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.white },
  safe: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 64,
    gap: 24,
  },

  // Top brand logo. PNG has transparent padding around the R mark, so the
  // box is oversized to land the visible mark at ~56px on screen.
  topLogo: { width: 80, height: 80 },

  // Ester intro card
  esterCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    backgroundColor: K.white,
  },
  dotsRow: { flexDirection: "row", gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: ON_BLUE_SUBTLE },
  esterIntroBold: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 20,
    lineHeight: 24,
    color: K.brown,
    letterSpacing: -0.2,
  },
  esterIntroBody: {
    fontFamily: fonts.dmSans,
    fontSize: 18,
    lineHeight: 22,
    color: K.brown,
    letterSpacing: -0.2,
  },
  esterArrowOutline: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: K.brown,
    alignItems: "center",
    justifyContent: "center",
  },

  // Generic banner (used for all 3 sections)
  banner: {
    backgroundColor: BLUE_SURFACE,
    borderRadius: 4,
    padding: 16,
    gap: 24,
    overflow: "hidden",
  },
  bannerHeader: { gap: 8 },
  bannerTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 36,
    color: K.brown,
    letterSpacing: -0.32,
  },
  bannerSub: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    color: ON_BLUE_SUBTLE,
    letterSpacing: -0.16,
  },
  bannerSubBold: { color: K.brown },

  // Type-cards fan
  typeFanWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -16, // bleed past banner padding (left + right edges)
    // Pull the wrap up so the cards land ~16px under the subtitle, and
    // pull the CTA up so the Burner/Explorer cards visually extend behind
    // the "Start your scan" button. The PNG's transparent top space is
    // smaller than I first guessed; -32 lands the cards just under the
    // subtitle, while keeping the CTA overlap deep enough.
    marginTop: -32,
    marginBottom: -140,
  },

  // Meal-plan visuals (single composited image: cards fan + Ester bubble).
  // Stays in the banner's flex flow but bleeds left + bottom so the image
  // touches the banner's outer bottom-left corner. The CTA is rendered as
  // an absolute overlay on top of this (see mealCtaOverlay).
  mealVisualsWrap: {
    alignSelf: "flex-start",
    marginLeft: -16,
    marginBottom: -16,
  },
  // "See a sample meal" CTA, absolutely positioned at the banner's
  // bottom-right corner (inside the 16px banner padding).
  mealCtaOverlay: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },

  // Reset Score gauge — semicircle of light-blue ticks with the blurred
  // "40" + "Scan to find out yours" CTA stacked underneath the arc.
  gaugeWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
    marginHorizontal: -16, // bleed past banner padding so the meter can
    // fill the banner edge-to-edge.
  },
  // Wraps the blurred score and centers it horizontally inside the gauge.
  // Sits just above the arc baseline so the smudge nestles into the lower
  // empty space inside the arc.
  gaugeScoreWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pre-rendered blurred-"40" PNG (natural size 534x409 = ~1.305 aspect).
  // Sized smaller so it visually sits inside the arc.
  gaugeScoreImage: {
    width: 198,
    height: Math.round(198 * (409 / 534)),
  },
  // CTA wrapper — full-width absolute layer that horizontally centers the
  // pill on top of (and roughly in the middle of) the blurred score image.
  gaugeCtaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 60,
    alignItems: "center",
  },
  // CTA pill — Figma `Ghost-Surface` token (rgba(54,20,22,0.12)) with a
  // 4px corner radius. Sits on top of the lower portion of the "40".
  gaugeCta: {
    backgroundColor: "rgba(54,20,22,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  gaugeCtaText: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: K.white,
  },

  // Featured CTA row (white pill + circular arrow), right-aligned
  featuredCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  featuredCtaLabel: {
    backgroundColor: K.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  featuredCtaLabelCompact: {
    backgroundColor: K.white,
    paddingHorizontal: 13,
    paddingVertical: 13,
    minHeight: 36,
    justifyContent: "center",
  },
  featuredCtaText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 24,
    color: K.brown,
    letterSpacing: -0.2,
  },
  featuredCtaTextCompact: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 20,
    color: K.brown,
    letterSpacing: -0.16,
  },
  featuredCtaArrow: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: K.white,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredCtaArrowCompact: {
    width: 45,
    height: 45,
    borderRadius: 999,
    backgroundColor: K.white,
    alignItems: "center",
    justifyContent: "center",
  },
});


import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Image,
  Share,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { MetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
// RES-121: metabolicType is now sourced from `state.user.metabolicType`
// (set by CreateAccountScreen after the backend's TypingService runs on
// the submitted behaviorAnswers). The FE no longer computes the type.
import { useApp } from "../../context/AppContext";
import { logEvent, setCustomAttribute } from "../../services/braze";
import { ScoreRing } from "../../components/survey/ScoreRing";
import { getResetScore, ResetScore } from "../../services/resetScore";
import { getScanInsightsMessage } from "../../services/scanInsights";

type Props = NativeStackScreenProps<any, "TypeReveal">;

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const WHITE = "#FAFDFE";
const BLUE_BG = "#E9F0F2";
const SUBTLE = "#7E6869";
const GHOST_W = "rgba(250,253,254,0.24)";

const TYPE_LOGO: Record<MetabolicType, any> = {
  Burner: require("../../../assets/images/onboarding/type-logo-burner.png"),
  Chameleon: require("../../../assets/images/onboarding/type-logo-chameleon.png"),
  Ember: require("../../../assets/images/onboarding/type-logo-ember.png"),
  Explorer: require("../../../assets/images/onboarding/type-logo-explorer.png"),
  Rebounder: require("../../../assets/images/onboarding/type-logo-rebounder.png"),
};

const MEAL_TEASER_BG = require("../../../assets/images/onboarding/meal-teaser-bg.png");

const TYPE_DISPLAY: Record<MetabolicType, string> = {
  Chameleon: "Chameleon",
  Burner: "Burner",
  Ember: "Restorer",
  Explorer: "Explorer",
  Rebounder: "Rebounder",
};

const TYPE_TAGLINE: Record<MetabolicType, string> = {
  Chameleon: "Two weeks on. Two weeks off. Same body, different rules.",
  Burner: "Sharp in the morning, gone by 3pm. Every single day.",
  Ember: "You do everything right and the tank is still empty.",
  Explorer: "You've never fit cleanly into any category.",
  Rebounder: "The diet always works. Until it doesn't. Again.",
};

const TYPE_PARAGRAPH: Record<MetabolicType, string> = {
  Chameleon:
    "Your body lives in two-week phases. Heavier energy needs one half, lighter the next. Same body, different rules.",
  Burner:
    "Your metabolism runs hot under stress. Protein-forward meals keep your afternoon stable when cortisol spikes.",
  Ember:
    "Your body is running on rationed supply. When the raw materials run low, everything dims together — energy, recovery, metabolism. Weight is one of the last things a rationing body will release.",
  Explorer:
    "Your metabolic signals aren't loud yet — easier for me to read. A balanced baseline lets me learn your pattern fast.",
  Rebounder:
    "Your metabolism has adapted to protect itself. Calorie-sufficient meals help your metabolism find its rhythm again — never deficit-framed.",
};

// RES-121 non-scanner copy. When the backend returns `starting_read`, we
// surface "Explorer" with soft directional language that points to "we'll
// learn more once you scan" rather than asserting a metabolic pattern.
const STARTING_READ_TAGLINE =
  "Your starting read — we'll sharpen it together once you scan.";
const STARTING_READ_PARAGRAPH =
  "Without a scan, I'm working from your answers alone. A balanced baseline is the right place to start, and the first scan will tell me how your body actually responds.";

// Card width fills the screen with a fixed 12px gutter on each side, on every
// device — replaces the old 378px Figma-frame cap so larger phones (e.g. Pro
// Max) aren't letterboxed. All cards share the same footprint; the stack-peek
// effect comes from the staggered offsets + the inset "Bubble" shadow.
const CARD_SIDE_MARGIN = 12;
const CARD_W = SCREEN_W - CARD_SIDE_MARGIN * 2;
const CARD_WIDTHS = [CARD_W, CARD_W, CARD_W, CARD_W];
// Figma 1916-17871 card layout height: 738, bumped ~10% taller (812).
const CARD_H = 812;
// The stack is centered vertically; each card behind the front sits 6px lower
// so a thin sliver peeks at the bottom (front = idx 0, back = idx 3).
const CARD_STACK_STEP = 6;
const CARD_TOP = Math.max(0, Math.round((SCREEN_H - CARD_H) / 2));

const TOTAL_CARDS = 4;

// Mirrors the backend's fallback text — used only if the parallel LLM
// fetch fails outright (timeout, auth error, etc.). The normal "no scan"
// case doesn't apply here because TypeReveal is only reached after a
// successful scan + account creation.
const INSIGHT_FALLBACK =
  "Your scan picked up where you are right now — and today's meals are picked to meet you there.";

// All cards share the page-surface white per Figma — the visible peek
// between stacked cards comes from the inset "Bubble" shadow, not a
// contrasting fill.
const CARD_BG_FRONT = "#FAFDFE";

const SWIPE_DISMISS_DX = -Math.max(80, SCREEN_W * 0.28);
const SWIPE_DISMISS_VX = -0.6;

// Per-card pre-entry pose (offset from settled, before slide-in completes).
// Mirrors Figma 1940:17991 — cards fly in from upper-right with positive
// rotation, with the back card landing first and the front card last.
const ENTRY_POSE = [
  // idx 0 (front): biggest fling
  { dx: SCREEN_W * 0.75, dy: -SCREEN_H * 0.55, rot: 16 },
  // idx 1
  { dx: SCREEN_W * 0.6, dy: -SCREEN_H * 0.45, rot: 13 },
  // idx 2 (insight)
  { dx: SCREEN_W * 0.42, dy: -SCREEN_H * 0.3, rot: 9 },
  // idx 3 (back): subtle settle
  { dx: SCREEN_W * 0.28, dy: -SCREEN_H * 0.2, rot: 6 },
];

// Final exit pose for the active card after a successful swipe — flies
// upper-left with CCW rotation, matching Figma 1940:17129 (card at
// translate(-117.95, -200.45), rotate -4.27°, continuing off-screen).
const EXIT_DX = -SCREEN_W * 1.2;
const EXIT_DY = -SCREEN_H * 0.55;
const EXIT_ROT = -16;

// ── Cards ──────────────────────────────────────────────────────────────
function FrontCard({
  type,
  startingRead,
  revealed,
  onReveal,
  onShareResults,
}: {
  type: MetabolicType;
  startingRead: boolean;
  revealed: boolean;
  onReveal: () => void;
  onShareResults: () => void;
}) {
  const logo = TYPE_LOGO[type];
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const revealedOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: revealed ? 0 : 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(revealedOpacity, {
        toValue: revealed ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [revealed]);

  return (
    <View style={[styles.card, { width: CARD_WIDTHS[0], backgroundColor: CARD_BG_FRONT }]}>
      <View style={styles.cardContentTight}>
        <View style={styles.innerStack}>
          <Text style={styles.headerText}>Here is your type!</Text>

          <View style={styles.typeBoneCard}>
            <View style={styles.typeLogoWrap}>
              <Image source={logo} style={styles.typeLogo} resizeMode="contain" />
            </View>
            <View style={styles.typeTextWrap}>
              <Text style={styles.typeName}>{TYPE_DISPLAY[type]}</Text>
              <Text style={styles.typeTagline}>
                {startingRead ? STARTING_READ_TAGLINE : TYPE_TAGLINE[type]}
              </Text>
            </View>
            <Text style={styles.typeParagraph}>
              {startingRead ? STARTING_READ_PARAGRAPH : TYPE_PARAGRAPH[type]}
            </Text>

            {/* Blur overlay with Tap to reveal — fades out once tapped. */}
            <Animated.View
              pointerEvents={revealed ? "none" : "auto"}
              style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
            >
              <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.blurDim} />
              <View style={styles.revealCenter}>
                <TouchableOpacity
                  onPress={onReveal}
                  activeOpacity={0.85}
                  style={styles.revealBtn}
                >
                  <Text style={styles.revealBtnText}>Tap to reveal</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>

          <Animated.View
            pointerEvents={revealed ? "auto" : "none"}
            style={{ opacity: revealedOpacity }}
          >
            <TouchableOpacity
              onPress={onShareResults}
              activeOpacity={0.85}
              style={styles.shareBtn}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 16.08C17.24 16.08 16.56 16.38 16.04 16.85L8.91 12.7C8.96 12.47 9 12.24 9 12C9 11.76 8.96 11.53 8.91 11.3L15.96 7.19C16.5 7.69 17.21 8 18 8C19.66 8 21 6.66 21 5C21 3.34 19.66 2 18 2C16.34 2 15 3.34 15 5C15 5.24 15.04 5.47 15.09 5.7L8.04 9.81C7.5 9.31 6.79 9 6 9C4.34 9 3 10.34 3 12C3 13.66 4.34 15 6 15C6.79 15 7.5 14.69 8.04 14.19L15.16 18.35C15.11 18.56 15.08 18.78 15.08 19C15.08 20.61 16.39 21.92 18 21.92C19.61 21.92 20.92 20.61 20.92 19C20.92 17.39 19.61 16.08 18 16.08Z"
                  fill={MAROON}
                />
              </Svg>
              <Text style={styles.shareBtnText}>Share results</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Animated.Text style={[styles.swipeCaption, { opacity: revealedOpacity }]}>
          Swipe left to continue
        </Animated.Text>
      </View>
    </View>
  );
}

function MiddleCard({
  type,
  score,
  confidence,
  daysToFull,
}: {
  type: MetabolicType;
  score: number;
  confidence: number;
  daysToFull: number;
}) {
  const logo = TYPE_LOGO[type];
  // ScoreRing renders into a 320×200 box at width=BASE_W. The card's blue
  // score surface is `cardW - cardPadding*2 - surfacePadding*2` wide; size
  // the ring just under that so the SVG sits flush.
  const ringWidth = CARD_WIDTHS[1] - 24 * 2 - 16 * 2;

  return (
    <View style={[styles.card, { width: CARD_WIDTHS[1], backgroundColor: CARD_BG_FRONT }]}>
      <View style={styles.cardContent}>
        <Image source={logo} style={styles.middleTypeLogo} resizeMode="contain" />

        <Text style={styles.midGreeting}>
          Thanks for checking in!{"\n\n"}Great to know you're a{" "}
          <Text style={styles.midGreetingBold}>{TYPE_DISPLAY[type]}.</Text>
          {"\n\n"}Here's how you're looking today:
        </Text>

        <View style={styles.scoreBlock}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrowText}>Today's Reset Score</Text>
          </View>
          <View style={styles.scoreSurface}>
            <ScoreRing score={score} animate={false} width={ringWidth} />
          </View>
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>
            <Text style={styles.confidenceValue}>{confidence}%</Text>
            {daysToFull > 0 ? (
              <Text style={styles.confidenceHint}>
                Estimated {daysToFull} days til near 100% confidence
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.swipeHint}>Swipe left to continue</Text>
      </View>
    </View>
  );
}

function InsightCard({
  type,
  insightText,
}: {
  type: MetabolicType;
  insightText: string;
}) {
  const logo = TYPE_LOGO[type];
  return (
    <View style={[styles.card, { width: CARD_WIDTHS[2], backgroundColor: CARD_BG_FRONT }]}>
      <View style={styles.insightCardContent}>
        <Image source={logo} style={styles.middleTypeLogo} resizeMode="contain" />
        <Text style={styles.midGreeting}>
          Here's my biggest takeaway from your scan.
        </Text>
        <View style={styles.insightWrap}>
          <View style={[styles.eyebrowRow, styles.insightEyebrowRow]}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrowText}>Today's Insight</Text>
          </View>
          <View style={styles.insightBubble}>
            <Text style={styles.insightBody}>{insightText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BackCard({ type, onTap }: { type: MetabolicType; onTap: () => void }) {
  const logo = TYPE_LOGO[type];
  return (
    <View style={[styles.card, { width: CARD_WIDTHS[3], backgroundColor: CARD_BG_FRONT }]}>
      <View style={styles.backCardContent}>
        <View style={styles.backCardTop}>
          <Image source={logo} style={styles.middleTypeLogo} resizeMode="contain" />
          <Text style={styles.midGreeting}>
            Based on your scan and {TYPE_DISPLAY[type].toLowerCase()} archetype, I have your{" "}
            <Text style={styles.midGreetingBold}>first</Text> meal rec ready!
          </Text>
        </View>

        <View style={styles.mealTeaserWrap}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrowText}>Based on your score</Text>
          </View>
          <View style={styles.mealTeaser}>
            <Image
              source={MEAL_TEASER_BG}
              style={styles.mealTeaserImage}
              resizeMode="cover"
              blurRadius={5.5}
            />
            <View style={StyleSheet.absoluteFill}>
              {/* Maroon bottom-darkening for white-title legibility. (The Figma
                  amber upper-right peek was removed — corner-to-corner gradients
                  stretch into a full-height band on wider cards.) */}
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="mealMaroon" x1="0.05" y1="0" x2="0" y2="1">
                    <Stop offset="0.41" stopColor={MAROON} stopOpacity="0" />
                    <Stop offset="0.91" stopColor={MAROON} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#mealMaroon)" />
              </Svg>
            </View>
            <Text style={styles.mealTeaserTitle}>Want to see it?</Text>
            <TouchableOpacity
              onPress={onTap}
              style={styles.mealArrowBtn}
              activeOpacity={0.85}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke={WHITE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────
export function TypeRevealScreen({ navigation }: Props) {
  const { state } = useApp();

  // `metabolicType` is set in CreateAccountScreen from the backend
  // typing-function response. Fall back to "Explorer" when:
  //   - the response hasn't landed yet (undefined), OR
  //   - the backend returned `starting_read` (non-scanner path).
  // The ticket: starting_read surfaces as Explorer with soft directional
  // copy. The display lookups (TYPE_DISPLAY/LOGO/TAGLINE/PARAGRAPH) are
  // keyed by the 5 real archetypes only, so we normalize here once.
  const rawType = state.user.metabolicType as string | undefined;
  const metabolicType: MetabolicType =
    rawType && rawType !== "starting_read"
      ? (rawType as MetabolicType)
      : "Explorer";

  // Pull the same Reset Score the Home screen will show, so the number on
  // the middle card matches Home exactly (rather than the raw SDK wellness).
  // Backend lazily computes/persists if the fire-and-forget recompute kicked
  // off by submitScanResults hasn't landed yet, so the fetch always succeeds
  // when a scan exists. The insight blurb is fetched in parallel — the LLM
  // call dominates total latency, so kicking it off alongside the score
  // keeps the loading window tight.
  const [resetScore, setResetScore] = useState<ResetScore | null>(null);
  const [insightText, setInsightText] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [scoreRes, insightRes] = await Promise.allSettled([
        getResetScore(),
        // No meal slots yet — the endpoint adapts the prompt to skip meal
        // references when slots are absent.
        getScanInsightsMessage(undefined),
      ]);
      if (cancelled) return;
      if (scoreRes.status === "fulfilled") {
        setResetScore(scoreRes.value.score ?? null);
      }
      if (insightRes.status === "fulfilled") {
        setInsightText(insightRes.value.text);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const score = Math.round(
    resetScore?.score ?? state.biometrics?.wellness ?? 70
  );
  const confidence = Math.round(resetScore?.confidence ?? 15);
  // Same formula HomeScreenV2 uses for the ConfidenceCard, so the days
  // estimate stays consistent between TypeReveal and Home.
  const daysToFull =
    confidence < 100 ? Math.max(1, Math.ceil(100 - confidence)) : 0;

  useEffect(() => {
    logEvent("onboarding_type_reveal", { metabolic_type: metabolicType });
    setCustomAttribute("metabolic_type", metabolicType);
    // metabolicType is sourced from state directly now — backend is the
    // authoritative writer (see CreateAccountScreen / AccountGateScreen).
  }, []);

  const [revealed, setRevealed] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // Per-card entry progress: 0 = pre-entry pose (offset + rotation), 1 = settled.
  const slideIn = useMemo(
    () =>
      Array.from({ length: TOTAL_CARDS }, () => new Animated.Value(0)),
    []
  );
  // Pan offset (x + y) for the currently active card. Recreated after each
  // successful dismiss so the next active card binds to a fresh pan at (0,0)
  // — otherwise resetting the shared pan after the exit animation would
  // visibly snap the just-dismissed card back to center for one frame
  // before the state update hides it (visible as a flash).
  const [panEpoch, setPanEpoch] = useState(0);
  const pan = useMemo(
    () => new Animated.ValueXY({ x: 0, y: 0 }),
    [panEpoch]
  );

  useEffect(() => {
    if (!loaded) return;
    // Back card lands first, then front — so the stack visibly assembles
    // in z-order, mirroring Figma 1940:17991. Gated on `loaded` so the
    // cards only fly in once BOTH the Reset Score and the insight blurb
    // have resolved — otherwise we'd briefly show fallback values for
    // either one before snapping to the real text.
    Animated.stagger(
      140,
      [3, 2, 1, 0].map((i) =>
        Animated.spring(slideIn[i], {
          toValue: 1,
          useNativeDriver: true,
          friction: 9,
          tension: 50,
        }),
      ),
    ).start();
  }, [loaded]);

  const advance = () => {
    setActiveIdx((i) => Math.min(i + 1, TOTAL_CARDS));
  };

  // Navigate AFTER React commits the state change — calling navigation.replace
  // inside the setActiveIdx updater triggers a navigator state update while
  // TypeReveal is rendering, which React flags as a setState-in-render warning.
  useEffect(() => {
    if (activeIdx >= TOTAL_CARDS) {
      logEvent("onboarding_type_reveal_continueCTA");
      // After the meal-rec teaser card, route to the Paywall (which owns
      // the completeOnboarding + setHomeV2Enabled handoff to NextMeal).
      navigation.replace("Paywall");
    }
  }, [activeIdx, navigation]);

  const dismissActive = () => {
    // Continue the swipe from wherever the user released — translate up-left
    // and rotate CCW off-screen.
    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: EXIT_DX,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(pan.y, {
        toValue: EXIT_DY,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start(() => {
      advance();
      setPanEpoch((e) => e + 1);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dx <= 0) {
            // Subtle upward lift while dragging left so the gesture
            // previews the angled exit trajectory.
            pan.setValue({ x: g.dx, y: g.dx * 0.35 });
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < SWIPE_DISMISS_DX || g.vx < SWIPE_DISMISS_VX) {
            dismissActive();
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 7,
            }).start();
          }
        },
      }),
    [pan]
  );

  const renderCard = (idx: 0 | 1 | 2 | 3) => {
    const isActive = idx === activeIdx;
    const isDismissed = idx < activeIdx;
    const pose = ENTRY_POSE[idx];

    // Entry contribution: at slideIn=0 we sit at the pre-entry pose
    // (upper-right + tilted CW), at slideIn=1 we sit at (0,0,0°).
    const entryX = slideIn[idx].interpolate({
      inputRange: [0, 1],
      outputRange: [pose.dx, 0],
    });
    const entryY = slideIn[idx].interpolate({
      inputRange: [0, 1],
      outputRange: [pose.dy, 0],
    });
    const entryRotNum = slideIn[idx].interpolate({
      inputRange: [0, 1],
      outputRange: [pose.rot, 0],
    });

    // Pan contribution (only meaningful while active). Pan tilts the card
    // CCW toward the exit pose as it moves left.
    const panRotNum = pan.x.interpolate({
      inputRange: [-SCREEN_W, 0],
      outputRange: [EXIT_ROT, 0],
      extrapolate: "clamp",
    });

    let translateX: Animated.AnimatedInterpolation<number> | Animated.Value;
    let translateY: Animated.AnimatedInterpolation<number> | Animated.Value;
    let rotateNum: Animated.AnimatedInterpolation<number> | Animated.Value;

    if (isDismissed) {
      // Hidden via opacity, but parked at exit pose for consistency.
      translateX = new Animated.Value(EXIT_DX);
      translateY = new Animated.Value(EXIT_DY);
      rotateNum = new Animated.Value(EXIT_ROT);
    } else if (isActive) {
      translateX = Animated.add(entryX, pan.x);
      translateY = Animated.add(entryY, pan.y);
      rotateNum = Animated.add(entryRotNum, panRotNum);
    } else {
      translateX = entryX;
      translateY = entryY;
      rotateNum = entryRotNum;
    }

    const rotate = rotateNum.interpolate({
      inputRange: [-360, 360],
      outputRange: ["-360deg", "360deg"],
    });

    let content: React.ReactNode = null;
    if (idx === 0) {
      content = (
        <FrontCard
          type={metabolicType}
          startingRead={!!state.user.startingRead}
          revealed={revealed}
          onReveal={() => {
            logEvent("onboarding_type_reveal_tap");
            setRevealed(true);
          }}
          onShareResults={async () => {
            logEvent("onboarding_type_reveal_share");
            try {
              await Share.share({
                message: `I'm a ${TYPE_DISPLAY[metabolicType]} on Reset — ${TYPE_TAGLINE[metabolicType]}`,
              });
            } catch {}
          }}
        />
      );
    } else if (idx === 1) {
      content = (
        <MiddleCard
          type={metabolicType}
          score={score}
          confidence={confidence}
          daysToFull={daysToFull}
        />
      );
    } else if (idx === 2) {
      content = (
        <InsightCard
          type={metabolicType}
          insightText={insightText ?? INSIGHT_FALLBACK}
        />
      );
    } else {
      content = <BackCard type={metabolicType} onTap={advance} />;
    }

    const cardW = CARD_WIDTHS[idx];

    return (
      <Animated.View
        key={idx}
        pointerEvents={isDismissed ? "none" : "auto"}
        style={[
          styles.cardSlot,
          {
            width: cardW,
            top: CARD_TOP + idx * CARD_STACK_STEP,
            left: (SCREEN_W - cardW) / 2,
            transform: [
              { translateX },
              { translateY },
              { rotate },
            ],
            zIndex: 10 - idx,
            opacity: isDismissed ? 0 : 1,
          },
        ]}
        {...(isActive ? panResponder.panHandlers : {})}
      >
        {content}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Bottom-darken gradient over the maroon page surface. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="revealBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#revealBg)" />
        </Svg>
      </View>

      {/* No top avatar on this screen — the card stack is the focal point. */}

      {/* Loading state while the Reset Score + scan-insight blurb fetch in
          parallel. Cards are still rendered underneath but sit at their
          entry pose (off-screen, up-right) until `loaded` flips and the
          stagger kicks in. */}
      {!loaded && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={WHITE} />
        </View>
      )}

      {/* Cards rendered back→front so z-order works naturally. Gated on
          `loaded` so the entry-pose cards (translated up + right with
          rotation) don't peek onto the screen during the parallel
          reset-score + scan-insights fetch — we want a clean loading
          state with just the spinner until both resolve. */}
      {loaded && (
        <>
          {renderCard(3)}
          {renderCard(2)}
          {renderCard(1)}
          {renderCard(0)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  safe: { width: "100%" },
  topBar: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topAvatar: { width: 40, height: 40 },

  // Card slot positioning
  cardSlot: {
    position: "absolute",
    height: CARD_H,
  },

  // Card chrome — shadow values from Figma 1916-17871 "Bubble" effect.
  // Inset shadows give the cards a soft inner rim at the bottom edge.
  card: {
    backgroundColor: WHITE,
    borderRadius: 48,
    height: CARD_H,
    boxShadow:
      "0 0 1px 0 rgba(0,0,0,0.07) inset, 0 2px 6px -1px rgba(34,10,10,0.38), 0 -9px 4px -8px rgba(54,20,22,0.44) inset, 0 -5px 10px -3px rgba(54,20,22,0.38) inset",
    elevation: 6,
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 24,
  },
  cardContentTight: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 24,
  },
  // Inner stack — mirrors Figma 2005:26264 (the flex-1 container holding
  // header + bone card + share-button placeholder).
  innerStack: {
    flex: 1,
    width: "100%",
    gap: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  // Post-reveal "Share results" button — Figma 1679:20300.
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 44,
    padding: 16,
    borderRadius: 4,
    backgroundColor: "rgba(54,20,22,0.12)",
    alignSelf: "center",
  },
  shareBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: MAROON,
  },
  swipeCaption: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.12,
    color: SUBTLE,
    width: "100%",
    textAlign: "center",
  },

  // Front card
  headerText: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    color: MAROON,
    letterSpacing: -0.24,
    width: "100%",
    textAlign: "left",
  },
  typeBoneCard: {
    width: "100%",
    height: 461,
    backgroundColor: BONE,
    borderRadius: 24,
    padding: 24,
    gap: 24,
    overflow: "hidden",
  },
  typeLogoWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  typeLogo: {
    width: 186,
    height: 186,
  },
  typeTextWrap: { gap: 8 },
  typeName: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 36,
    color: MAROON,
    letterSpacing: -0.32,
  },
  typeTagline: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 24,
    color: SUBTLE,
    letterSpacing: -0.2,
  },
  typeParagraph: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    lineHeight: 20,
    color: SUBTLE,
    letterSpacing: -0.14,
  },
  blurDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(54,20,22,0.24)",
  },
  revealCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  revealBtn: {
    backgroundColor: GHOST_W,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 4,
    minHeight: 44,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  revealBtnText: {
    fontFamily: fonts.dmSans,
    color: WHITE,
    fontSize: 20,
    letterSpacing: -0.2,
  },

  // Middle / back common text
  midGreeting: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    color: MAROON,
    letterSpacing: -0.24,
  },
  midGreetingBold: {
    fontFamily: fonts.dmSansBold,
    color: MAROON,
  },
  middleTypeLogo: {
    width: 56,
    height: 56,
    alignSelf: "flex-start",
  },

  // Reset Score block
  scoreBlock: { gap: 6 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#92B4BD",
  },
  eyebrowText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: SUBTLE,
    letterSpacing: -0.12,
  },
  scoreSurface: {
    backgroundColor: BLUE_BG,
    borderRadius: 4,
    borderTopRightRadius: 64,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  confidenceRow: {
    backgroundColor: BLUE_BG,
    borderRadius: 4,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  confidenceLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: MAROON,
    letterSpacing: -0.12,
  },
  confidenceValue: {
    fontFamily: fonts.dmSans,
    fontWeight: "700",
    fontSize: 16,
    color: MAROON,
    letterSpacing: -0.16,
  },
  confidenceHint: {
    flex: 1,
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: SUBTLE,
    letterSpacing: -0.12,
  },

  // Back card
  backCardContent: {
    flex: 1,
    padding: 24,
    gap: 24,
  },
  backCardTop: {
    flex: 1,
    gap: 24,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  mealTeaserWrap: { gap: 6, width: "100%" },
  mealTeaser: {
    height: 144,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 64,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 16,
  },
  // Explicit numeric width (= full card width, wider than the bubble) anchored
  // with a left bleed guarantees the cover image fills the whole bubble and
  // overruns both edges — so the 330px asset is actually upscaled (left/right
  // alone left it at intrinsic width) and the blurRadius edge-fade is clipped.
  mealTeaserImage: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -24,
    width: CARD_W,
  },
  mealTeaserTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 36,
    color: WHITE,
    letterSpacing: -0.32,
  },
  mealArrowBtn: {
    position: "absolute",
    right: 14,
    bottom: 15,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: GHOST_W,
    alignItems: "center",
    justifyContent: "center",
  },

  swipeHint: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: SUBTLE,
    letterSpacing: -0.12,
    textAlign: "center",
  },

  // Insight card (3rd in stack — "Here's my biggest takeaway from your scan.")
  // Per Figma 2413:8440 — single column, vertically centered, gap 24 between
  // logo / header / insight group; the insight group itself is gap 6 (eyebrow
  // → bubble) so it reads as one unit directly below the header.
  insightCardContent: {
    flex: 1,
    padding: 24,
    gap: 24,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  insightWrap: { gap: 6, width: "100%" },
  insightEyebrowRow: { paddingHorizontal: 8 },
  insightBubble: {
    borderWidth: 0.5,
    borderColor: "#C3B9BA",
    paddingTop: 10,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  insightBody: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    color: SUBTLE,
    letterSpacing: -0.16,
  },
});

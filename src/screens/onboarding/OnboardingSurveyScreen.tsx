import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { VideoView, useVideoPlayer } from "expo-video";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";
import { getQuizQ2, determineType } from "../../constants/types";
import {
  SURVEY_STEPS,
  SurveyOption,
  resolveOptions,
} from "./onboardingSurvey";

type Props = NativeStackScreenProps<any, "Survey">;

const ESTER_BADGE = require("../../../assets/images/ester-avatar-silver.png");
// Plays on the post-scan splash (Figma 1553-17494) and again on the
// "Analyzing your responses" interstitial (Figma 1565-7668).
const POST_SCAN_VIDEO = require("../../../assets/videos/post-scan-intro.mp4");

// ── Ester "typing" indicator (three pulsing dots, bare — wrap in a bubble at
//    the call site). ───────────────────────────────────────────────────
function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={styles.dotsRow}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function OnboardingSurveyScreen({ navigation, route }: Props) {
  const stepIndex: number = ((route.params as any)?.step ?? 0) as number;
  const step = SURVEY_STEPS[stepIndex] ?? SURVEY_STEPS[0];
  const insets = useSafeAreaInsets();
  const {
    state,
    setGoal,
    setQuizAnswer,
    setDietaryRestrictions,
    setMetabolicType,
  } = useApp();

  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const introPlayer = useVideoPlayer(POST_SCAN_VIDEO, (player) => {
    player.muted = true;
    player.loop = false;
    if (step.kind === "logo" || step.kind === "analyzing") player.play();
  });

  const isQuestion = step.kind === "question";
  const q1Answer = (state.user.quizAnswers?.q1 as string | undefined) ?? null;

  const questionText = useMemo(() => {
    if (step.kind !== "question") return "";
    if (step.question === "_dynamic") {
      const a = (q1Answer as "afternoon_evening" | "random") || "afternoon_evening";
      return getQuizQ2(a).esterPrompt;
    }
    return step.question;
  }, [step, q1Answer]);

  const options: SurveyOption[] = useMemo(
    () => (step.kind === "question" ? resolveOptions(step, q1Answer) : []),
    [step, q1Answer]
  );

  const goNext = () => {
    const next = stepIndex + 1;
    if (next < SURVEY_STEPS.length) navigation.push("Survey", { step: next });
    else navigation.replace("AccountGate");
  };

  // Reveal: brief "typing" beat, then fade the content in.
  useEffect(() => {
    setRevealed(false);
    setSelected([]);
    contentOpacity.setValue(0);
    if (step.kind === "logo") {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => {
      setRevealed(true);
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, 850);
    return () => clearTimeout(t);
  }, [stepIndex]);

  // Auto-advance for the non-interactive beats.
  useEffect(() => {
    if (step.kind === "question") return;
    if (step.kind === "analyzing") {
      const q1 =
        (state.user.quizAnswers?.q1 as "afternoon_evening" | "random") ||
        "afternoon_evening";
      const q2 =
        (state.user.quizAnswers?.q2 as "crash" | "drift") || "crash";
      setMetabolicType(determineType(q1, q2));
      const t = setTimeout(() => navigation.replace("AccountGate"), step.durationMs);
      return () => clearTimeout(t);
    }
    // logo / message
    const t = setTimeout(goNext, (step as any).durationMs ?? 2000);
    return () => clearTimeout(t);
  }, [stepIndex]);

  const finalizeAnswer = (ids: string[]) => {
    if (step.kind !== "question" || ids.length === 0) return;
    logEvent(step.eventName, { value: ids.join(",") });
    switch (step.key) {
      case "goal":
        setGoal(ids[0]);
        break;
      case "q1":
        setQuizAnswer("q1", ids[0]);
        break;
      case "q2":
        setQuizAnswer("q2", ids[0]);
        break;
      case "restrict":
        setDietaryRestrictions(ids);
        break;
    }
    goNext();
  };

  const commitAnswer = () => finalizeAnswer(selected);

  const toggleOption = (id: string) => {
    if (step.kind !== "question") return;
    if (!step.multiSelect) {
      setSelected([id]);
      // Auto-advance after a brief beat so the selection highlight reads.
      setTimeout(() => finalizeAnswer([id]), 220);
      return;
    }
    if (id === "none") {
      setSelected(["none"]);
      return;
    }
    setSelected((prev) => {
      const f = prev.filter((s) => s !== "none");
      return f.includes(id) ? f.filter((s) => s !== id) : [...f, id];
    });
  };

  // The pushed-step stack means "back" naturally returns to the previous step
  // (and from step 0, out to the scan-nudge screen).
  const handleClose = () => navigation.goBack();

  const showProgress = step.kind !== "logo" && step.kind !== "analyzing";
  const showClose = step.kind !== "analyzing";
  const progress = (step as any).progress ?? 0;

  return (
    <View style={styles.container}>
      {/* Dark-bottom gradient over the maroon page surface. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="surveyBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#surveyBg)" />
        </Svg>
      </View>

      {/* Top bar: close · Ester badge · mute. */}
      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topRow}>
          {showClose ? (
            <TouchableOpacity onPress={handleClose} hitSlop={14} style={styles.iconBtn}>
              <Text style={styles.closeGlyph}>×</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Image source={ESTER_BADGE} style={styles.badge} resizeMode="contain" />
          <View style={styles.iconBtn} />
        </View>
        {showProgress && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
      </SafeAreaView>

      {/* Body */}
      {step.kind === "logo" ? (
        <View style={styles.logoWrap} pointerEvents="none">
          <View style={styles.logoVideoBlend}>
            <VideoView
              player={introPlayer}
              style={styles.logoVideo}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        </View>
      ) : step.kind === "analyzing" ? (
        <View style={styles.analyzingWrap} pointerEvents="none">
          <View style={styles.analyzingVideoBlend}>
            <VideoView
              player={introPlayer}
              style={styles.analyzingVideo}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
          <View style={styles.analyzingBubble}>
            <TypingDots />
            <Text style={styles.analyzingText}>{step.text}</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 120, paddingBottom: 220 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!revealed ? (
            <View style={styles.typingBubble}>
              <TypingDots />
            </View>
          ) : (
            <Animated.View style={{ opacity: contentOpacity }}>
              {step.kind === "message" &&
                step.lines.map((l, i) => (
                  <Text key={i} style={[styles.messageLine, i > 0 && { marginTop: 12 }]}>
                    {l}
                  </Text>
                ))}
              {step.kind === "question" && (
                <>
                  <Text style={styles.question}>{questionText}</Text>
                  <View style={styles.options}>
                    {options.map((o) => {
                      const sel = selected.includes(o.id);
                      return (
                        <TouchableOpacity
                          key={o.id}
                          onPress={() => toggleOption(o.id)}
                          activeOpacity={0.85}
                          style={[styles.bubble, sel && styles.bubbleSelected]}
                        >
                          <Text style={[styles.bubbleText, sel && styles.bubbleTextSelected]}>
                            {o.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </Animated.View>
          )}
        </ScrollView>
      )}

      {/* Arrow: only on multi-select questions, once something is picked.
          Single-select questions auto-advance after tap. */}
      {isQuestion && step.kind === "question" && step.multiSelect && selected.length > 0 && (
        <SafeAreaView edges={["bottom"]} style={styles.bottomBar} pointerEvents="box-none">
          <View style={styles.continueRow}>
            <TouchableOpacity onPress={commitAnswer} style={styles.arrowBtn} activeOpacity={0.85}>
              <Text style={styles.arrowGlyph}>→</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const BONE = K.bone;
const MAROON = K.brown;
const WHITE = "#FAFDFE";
const GHOST = "rgba(250,253,254,0.24)";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAROON,
  },
  // top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
    marginTop: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: {
    color: WHITE,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "300",
  },
  badge: {
    width: 40,
    height: 40,
  },
  progressTrack: {
    alignSelf: "center",
    width: 160,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    overflow: "hidden",
    marginTop: 12,
  },
  progressFill: {
    height: 2,
    borderRadius: 999,
    backgroundColor: WHITE,
  },
  // logo splash (post-scan video — square 1080×1080)
  logoWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  // The blend goes on the wrapper view; iOS' AVPlayerLayer ignores
  // mixBlendMode applied directly to the VideoView.
  logoVideoBlend: {
    width: "100%",
    aspectRatio: 1,
    mixBlendMode: "lighten",
  },
  logoVideo: {
    width: "100%",
    height: "100%",
  },
  // analyzing interstitial — video + bubble centered as a group (Figma 1565-7668)
  analyzingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  analyzingVideoBlend: {
    width: 200,
    height: 200,
    marginBottom: 24,
    mixBlendMode: "lighten",
  },
  analyzingVideo: {
    width: "100%",
    height: "100%",
  },
  analyzingBubble: {
    alignSelf: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#7E6869",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 14,
    paddingLeft: 14,
    paddingRight: 16,
    gap: 8,
    alignItems: "flex-start",
  },
  analyzingText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: WHITE,
    letterSpacing: -0.16,
  },
  // chat scroll body
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  messageLine: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    color: WHITE,
    letterSpacing: -0.16,
  },
  question: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    color: WHITE,
    letterSpacing: -0.24,
  },
  options: {
    marginTop: 24,
    gap: 8,
    alignItems: "flex-end",
  },
  bubble: {
    backgroundColor: GHOST,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 4,
    maxWidth: "88%",
  },
  bubbleSelected: {
    backgroundColor: BONE,
  },
  bubbleText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 21,
    color: WHITE,
    letterSpacing: -0.16,
    textAlign: "left",
  },
  bubbleTextSelected: {
    color: MAROON,
  },
  // typing-dots bubble (left-tail, content-sized)
  typingBubble: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#7E6869",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WHITE,
  },
  // bottom continue
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    paddingBottom: 24,
  },
  continueRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: 4,
  },
  continuePill: {
    backgroundColor: WHITE,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  continueText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
  arrowBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowGlyph: {
    fontSize: 24,
    color: MAROON,
  },
});

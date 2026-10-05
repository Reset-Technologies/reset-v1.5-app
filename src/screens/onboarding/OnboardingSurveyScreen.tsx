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
  TextInput,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useVideoPlayer } from "expo-video";
import { PersonaIntroMedia } from "./PersonaIntroMedia";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { FastingInfoSheet } from "./FastingInfoSheet";
import { useIsFocused } from "@react-navigation/native";
import { logEvent } from "../../services/braze";
import {
  REFLECTIONS,
  getProvisionalLeader,
  type ProvisionalLeader,
} from "../../services/reflections";
import {
  SURVEY_STEPS,
  SurveyOption,
  resolveOptions,
} from "./onboardingSurvey";

type Props = NativeStackScreenProps<any, "Survey">;

const ESTER_BADGE = require("../../../assets/images/ester-avatar-silver.png");
// Plays on the post-scan splash (Figma 1553-17494) and again on the
// "Analyzing your responses" interstitial (Figma 1565-7668). The player drives
// the flow (its playToEnd advances the step). Rendering is platform-split in
// PersonaIntroMedia: iOS plays this HEVC-with-alpha .mov; Android renders a
// transparent animated WebP (its video stack can't composite HEVC alpha, so it
// would otherwise show a black box). The WebP is bundled only on Android.
const POST_SCAN_VIDEO = require("../../../assets/videos/post-scan-intro.mov");

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
  } = useApp();

  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  /**
   * The step-to-step crossfade, done HERE rather than by the navigator.
   *
   * 🔴 `animation: "fade"` on the native stack does not animate on Android
   * (react-native-screens 4.24.0) — it cuts in a single frame, measured at
   * 30fps on an S24, and measured the same on the pre-rebuild commit. It is
   * correct on iOS. Driving the fade in JS makes both platforms identical and
   * takes the native stack out of it entirely (the route is `animation:
   * "none"`).
   *
   * Everything except the page background rides this: the top bar, the body
   * and the Continue bar. The background stays solid so the content dissolves
   * over a steady maroon page instead of punching a hole through to whatever
   * is underneath.
   */
  const screenOpacity = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  /**
   * 🔴 The auto-advancing beats (logo, Ester intro, reflection, analyzing) are
   * driven by a timer in an effect keyed on the STEP. Navigating back to one
   * does not remount it and does not change the step, so the effect never
   * re-ran and its original timer was long spent — the screen simply sat
   * there, and the only way out was going back far enough to remount the
   * whole survey. Focus is the missing dependency.
   *
   * It also stops a BLURRED step's timer from firing underneath whatever is
   * on top of it.
   */
  const isFocused = useIsFocused();

  const introPlayer = useVideoPlayer(POST_SCAN_VIDEO, (player) => {
    player.muted = true;
    player.loop = false;
    if (step.kind === "logo" || step.kind === "analyzing") player.play();
  });

  /**
   * 🔴 Replay the intro clip when the step is focused, not just when the
   * player is created. `useVideoPlayer`'s initializer runs ONCE per screen
   * instance, so navigating back to the logo beat returned to a player sitting
   * paused on its last frame — the animation simply never played again.
   *
   * 🔑 `currentTime = 0` before `play()`: calling play() on a finished clip
   * does nothing. Same pattern as TypeRevealHero.
   *
   * Pausing on blur stops the clip decoding underneath whatever was pushed on
   * top of it — the survey keeps every step mounted.
   */
  useEffect(() => {
    if (step.kind !== "logo" && step.kind !== "analyzing") return;
    if (!isFocused) {
      introPlayer.pause();
      return;
    }
    introPlayer.currentTime = 0;
    introPlayer.play();
  }, [isFocused, stepIndex]);

  const isQuestion = step.kind === "question";

  const questionText = useMemo(() => {
    if (step.kind !== "question") return "";
    return step.question;
  }, [step]);

  const options: SurveyOption[] = useMemo(
    () => (step.kind === "question" ? resolveOptions(step) : []),
    [step]
  );

  const goNext = () => {
    // Guarded: the fade-out is ~180ms of live screen, and a second tap in that
    // window would push twice.
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      const next = stepIndex + 1;
      if (next < SURVEY_STEPS.length) navigation.push("Survey", { step: next });
      else navigation.replace("AccountGate");
    });
  };

  // undefined = still resolving · null = resolved to nothing (skip it) ·
  // string = ready to show. The three are distinct because "pending" must hold
  // the typing beat while "nothing" must advance, and collapsing them is what
  // produced a blank screen between the question and the reflection.
  const [reflection, setReflection] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    if (step.kind !== "reflection") return;
    let cancelled = false;
    (async () => {
      try {
        const leader: ProvisionalLeader = await getProvisionalLeader({
          U1: state.user.quizAnswers.U1 ?? null,
          U2: state.user.quizAnswers.U2 ?? null,
          U3: state.user.quizAnswers.U3 ?? null,
        });
        if (!cancelled) {
          setReflection(REFLECTIONS[leader] ?? null);
          logEvent("onboarding_survey_reflection", { leader });
        }
      } catch {
        // null, not undefined — "we tried and there is nothing", which lets the
        // advance timer move on instead of waiting forever.
        if (!cancelled) setReflection(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stepIndex]);

  // 🔑 A reflection step has nothing to show until its fetch lands, so it is
  // not "ready" the moment the typing beat ends like every other step is.
  // Revealing on the timer alone left the content area EMPTY until the network
  // returned — a blank flash between the question and the line.
  const contentReady = step.kind !== "reflection" || reflection !== undefined;

  // Fade the screen in on mount — this is the second half of the crossfade.
  useEffect(() => {
    leaving.current = false;
    screenOpacity.setValue(0);
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: ENTER_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [stepIndex]);

  /**
   * 🔴 AND ON FOCUS, not just on mount. `goNext` fades this screen to 0 before
   * pushing the next step — but the screen stays MOUNTED underneath. Coming
   * back to it (the ✕, or Android's hardware back) returned to a screen still
   * sitting at opacity 0: a blank page. Mount alone cannot cover this, because
   * returning does not remount.
   */
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      leaving.current = false;
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
    return unsub;
  }, [navigation]);

  // Reveal: brief "typing" beat, then fade the content in.
  useEffect(() => {
    setRevealed(false);
    setSelected([]);
    contentOpacity.setValue(0);
    if (step.kind === "logo") {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => setRevealed(true), 850);
    return () => clearTimeout(t);
  }, [stepIndex]);

  // The fade is its own effect so it waits for BOTH the typing beat and the
  // content. The typing dots simply stay up a little longer on a slow fetch,
  // which is what a typing indicator is for.
  useEffect(() => {
    if (!revealed || !contentReady) return;
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [revealed, contentReady]);

  // Auto-advance for the non-interactive beats.
  //
  // RES-121: the analyzing beat used to call `determineType(q1, q2)` and
  // set the metabolic type locally. The type is now computed by the
  // backend's TypingService once the user signs up and submits their
  // behavior answers; the analyzing beat just pauses for the animation
  // and hands off to AccountGate.
  useEffect(() => {
    // Interactive beats wait for the member. `goalWeight` (P2) is one of them —
    // without this it would fall through to the message timer and skip itself.
    if (step.kind === "question" || step.kind === "goalWeight") return;
    if (!isFocused) return;

    const advance =
      step.kind === "analyzing"
        ? () => navigation.replace("AccountGate")
        : goNext;

    // Video beats (logo / analyzing): advance the moment the intro video
    // finishes so it always plays through, regardless of how long it takes
    // to start. durationMs is only a fallback in case playToEnd never fires.
    if (step.kind === "logo" || step.kind === "analyzing") {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        advance();
      };
      const sub = introPlayer.addListener("playToEnd", finish);
      const fallback = setTimeout(finish, step.durationMs);
      return () => {
        sub.remove();
        clearTimeout(fallback);
      };
    }

    // 🔑 A reflection holds the step open until its text has landed, so the
    // member gets the full `durationMs` to READ it rather than however much is
    // left after the fetch. `undefined` is still resolving — wait. `null`
    // resolved to nothing (the call failed), so move on immediately rather
    // than sit on a typing indicator for three seconds.
    if (step.kind === "reflection") {
      if (reflection === undefined) return;
      if (reflection === null) {
        const skip = setTimeout(goNext, 0);
        return () => clearTimeout(skip);
      }
    }

    // message beat: no video, fixed timer.
    const t = setTimeout(goNext, (step as any).durationMs ?? 2000);
    return () => clearTimeout(t);
  }, [stepIndex, reflection, isFocused]);

  /**
   * Proof of listening (row 8). Resolved when the step is reached rather than
   * precomputed, because it depends on the answer the member gave moments ago.
   *
   * 🔑 Fails OPEN, not closed: if the call errors the reflection is skipped
   * rather than blocking the survey behind a network hop that exists purely to
   * show one sentence. `null` renders nothing and the timer still advances.
   */
  const [infoOpen, setInfoOpen] = useState(false);

  /**
   * P2 — goal weight. Non-scoring (ROUTING step 3), so it never reaches the
   * typing engine; it is profile data the meal side uses. Kept as a string
   * because an empty input is a real state and `0` is not the same as blank.
   */
  const [goalWeight, setGoalWeightInput] = useState("");
  const goalWeightValid = /^\d{2,3}$/.test(goalWeight.trim());

  const commitGoalWeight = (value: string | null) => {
    if (step.kind !== "goalWeight") return;
    logEvent(step.eventName, { value: value ?? "not_sure" });
    // "Not sure yet" is an answer, not an abandonment — record it as one so the
    // funnel can tell the two apart.
    if (value) setQuizAnswer("goalWeight", value);
    goNext();
  };

  const finalizeAnswer = (ids: string[]) => {
    if (step.kind !== "question" || ids.length === 0) return;
    logEvent(step.eventName, { value: ids.join(",") });
    switch (step.key) {
      case "goal":
        setGoal(ids[0]);
        break;
      case "restrict":
        setDietaryRestrictions(ids);
        break;
      // Window answers ride in quizAnswers: syncOnboardingToBackend forwards
      // only {q1,q2,q3}, so these stay client-side. The durable record of a
      // member's Window is the plan itself (window_assigned), not these.
      case "fastingInterest":
        setQuizAnswer(step.key, ids[0]);
        break;
      // 🔑 The six SCORED V1 questions. Stored under the workbook's own
      // question id, with the workbook's answer id as the value — both go to
      // the typing engine verbatim, so neither may be remapped on the way.
      default:
        setQuizAnswer(step.key, ids[0]);
        break;
    }
    goNext();
  };

  const commitAnswer = () => finalizeAnswer(selected);

  const toggleOption = (id: string) => {
    if (step.kind !== "question") return;
    // "Tell me more…" teaches and returns — it is not an answer, so the
    // question stays on screen and nothing is written.
    if (step.infoOptionId && id === step.infoOptionId) {
      logEvent(`${step.eventName}_moreInfo`);
      setInfoOpen(true);
      return;
    }
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
  // Derived, not hand-set: every step that shows the bar fills an equal share by
  // its position, so adding or removing a question can't skew the pacing again.
  // The denominator is one larger than the count so the last question reads just
  // short of full — "analyzing" follows it, and shows no bar.
  const barSteps = SURVEY_STEPS.filter((s) => s.kind !== "logo" && s.kind !== "analyzing");
  const progress = showProgress ? (barSteps.indexOf(step) + 1) / (barSteps.length + 1) : 0;

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

      {/* Everything but the background crossfades — see `screenOpacity`. */}
      <Animated.View style={[styles.fadeLayer, { opacity: screenOpacity }]} pointerEvents="box-none">

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
            <PersonaIntroMedia player={introPlayer} style={styles.logoVideo} />
          </View>
        </View>
      ) : step.kind === "analyzing" ? (
        <View style={styles.analyzingWrap} pointerEvents="none">
          <View style={styles.analyzingVideoBlend}>
            <PersonaIntroMedia player={introPlayer} style={styles.analyzingVideo} />
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
                /* 🔴 Keyed on BIOMETRICS, not `startingRead`. startingRead is
                   only set from the typing response, which lands AFTER account
                   creation — i.e. after this screen — so it is undefined here
                   and branching on it silently did nothing. A scan is the only
                   thing that populates `biometrics`, so its absence is what
                   "skipped" means at this point in the flow. (The reveal's
                   insight fallback DOES use startingRead, correctly: it runs
                   after typing.) */
                (state.biometrics === null && step.linesNoScan
                  ? step.linesNoScan
                  : step.lines
                ).map((l, i) => (
                  <Text key={i} style={[styles.messageLine, i > 0 && { marginTop: 12 }]}>
                    {l}
                  </Text>
                ))}
              {step.kind === "reflection" && reflection ? (
                <Text style={styles.messageLine}>{reflection}</Text>
              ) : null}

              {step.kind === "goalWeight" && (
                <>
                  <Text style={styles.question}>{step.question}</Text>
                  <View style={styles.options}>
                    <View style={styles.weightRow}>
                      <TextInput
                        style={styles.weightInput}
                        value={goalWeight}
                        onChangeText={(t) => setGoalWeightInput(t.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholder="—"
                        placeholderTextColor="rgba(250,253,254,0.4)"
                        accessibilityLabel="Goal weight in pounds"
                        returnKeyType="done"
                      />
                      <Text style={styles.weightUnit}>lbs</Text>
                    </View>
                    {/* QUESTIONS tab, P1/P2 note: "Include a 'Not sure yet' path." */}
                    <TouchableOpacity
                      onPress={() => commitGoalWeight(null)}
                      activeOpacity={0.85}
                      style={styles.bubble}
                    >
                      <Text style={styles.bubbleText}>{step.skipLabel}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

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
      {/* 🔑 Screen Copy row 7: "Continue appears only on P1 and P2." P1 is the
          dietary multi-select; P2 is the goal-weight entry. Every scored
          question is single-select and advances on tap. */}
      {((step.kind === "question" && step.multiSelect && selected.length > 0) ||
        (step.kind === "goalWeight" && goalWeightValid)) && (
        <SafeAreaView edges={["bottom"]} style={styles.bottomBar} pointerEvents="box-none">
          <View style={styles.continueRow}>
            {/* Screen Copy row 7 `Advance control`: the copy is "Continue",
                and the row's `Figma shows now` is "Continue + arrow (one
                frame)" — a labelled control, not a bare glyph. The styles for
                it were already here and unreferenced; this wires them up. The
                behaviour the row describes ("Continue appears only on P1 and
                P2"; single-select advances on tap) is what the surrounding
                guard already does. */}
            <TouchableOpacity
              onPress={step.kind === "goalWeight" ? () => commitGoalWeight(goalWeight.trim()) : commitAnswer}
              style={styles.continuePill}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={step.kind === "goalWeight" ? () => commitGoalWeight(goalWeight.trim()) : commitAnswer}
              style={styles.arrowBtn}
              activeOpacity={0.85}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12h14M13 5l7 7-7 7"
                  stroke={MAROON}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      </Animated.View>

      <FastingInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

// The step-to-step crossfade. Out is quicker than in: leaving should feel like
// a response to the tap, arriving should feel like Ester composing.
const EXIT_MS = 180;
const ENTER_MS = 240;

const BONE = K.bone;
const MAROON = K.brown;
const WHITE = "#FAFDFE";
const GHOST = "rgba(250,253,254,0.24)";

const styles = StyleSheet.create({
  // Sits above the page background and carries the crossfade.
  fadeLayer: { ...StyleSheet.absoluteFillObject },
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
  // RES-134: the video now ships with a real alpha channel (HEVC w/ alpha),
  // so no mixBlendMode hack is needed — it composites straight over the maroon.
  logoVideoBlend: {
    width: "175%",
    aspectRatio: 1,
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
    // Shift the centered group (video + bubble) up a touch.
    paddingBottom: 120,
  },
  analyzingVideoBlend: {
    width: 450,
    height: 450,
    // The video frame has ~22.7% transparent padding below the logo art
    // (~102px at this 450px size). Pull the bubble up with a negative margin
    // so it sits ~20px under the *visible* logo, not the box edge.
    marginBottom: -82,
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
  // P2's numeric entry. Deliberately the same surface treatment as an option
  // bubble so the step does not read as a different kind of screen.
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  weightInput: {
    fontFamily: fonts.catalogue,
    fontSize: 44,
    lineHeight: 52,
    color: K.white,
    letterSpacing: -0.44,
    textAlign: "center",
    minWidth: 120,
  },
  weightUnit: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.white,
    opacity: 0.7,
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
  // Row 7's Figma cell is "Continue + arrow (ONE frame)", so the label and the
  // round arrow butt together into a single continuous bar: no gap, and the
  // pill carries the left half of the arrow's 28 radius. Centred rather than
  // bottom-aligned, or the 56 circle and the shorter label sit on different
  // baselines and the seam shows.
  continueRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 0,
  },
  // 🔑 The pill runs 28 UNDER the arrow (negative margin + matching padding)
  // instead of butting against it. Abutting leaves a crescent of background
  // above and below the single point where a square edge touches a circle;
  // overlapping fuses the two whites into one capsule, which is what "one
  // frame" means here.
  continuePill: {
    backgroundColor: WHITE,
    height: 56,
    justifyContent: "center",
    paddingLeft: 24,
    paddingRight: 44,
    marginRight: -28,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
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

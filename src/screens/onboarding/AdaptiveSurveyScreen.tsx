import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  TextInput,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../../navigation/OnboardingNavigator";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { DIETARY_RESTRICTIONS } from "../../constants/types";
import { useApp } from "../../context/AppContext";
import { nextSetupDue, useTypingTree } from "../../hooks/useTypingTree";
import { logEvent } from "../../services/braze";
import { EsterTypingDots } from "../../components/EsterTypingDots";

/**
 * 🔑 LANG'S LAYOUT IS CANONICAL, and this screen must be indistinguishable
 * from `OnboardingSurveyScreen` to a member — the two engines differ in how
 * questions are CHOSEN, never in how they look. Every value below is taken
 * from that screen rather than re-invented: the maroon surface with its
 * dark-bottom gradient, the Ester badge, the 160pt progress rail, the
 * right-tailed answer bubbles, and the Continue pill + arrow.
 */
const ESTER_BADGE = require("../../../assets/images/ester-avatar-silver.png");

/**
 * 🔑 A UNION of both route names, because this component is registered TWICE:
 * on `Survey` when ADAPTIVE_SURVEY_ENABLED is on, and on `AdaptiveSurvey`
 * under __DEV__. Typing it to either one alone makes the other registration a
 * compile error — which is exactly what happened, and is how the double
 * registration surfaced.
 */
type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  "Survey" | "AdaptiveSurvey"
>;

const MAROON = K.brown;
const BONE = K.bone;
const WHITE = "#FAFDFE";
// 🔴 0.24, matching the fixed survey. This screen shipped 0.12, which read as a
// visibly fainter answer bubble side by side with the engine it replaces.
const GHOST = "rgba(250,253,254,0.24)";

/** How long a reflection or bridge holds the screen before the question. */
const BEAT_MS = 3200;

/**
 * The adaptive onboarding survey — the server-driven counterpart to
 * `OnboardingSurveyScreen`.
 *
 * ⚠️ Which survey members walk is decided by `ADAPTIVE_SURVEY_ENABLED` in
 * `constants/flags.ts`, which points the single `Survey` route at this screen
 * or at `OnboardingSurveyScreen`. The flag is currently OFF: `SURVEY_STEPS` is
 * what members walk, and this screen is reached only by flipping it locally.
 * 🔑 Exercising it on a device against a real backend is the only way to test
 * anything in this repo — there is no test runner.
 *
 * 🔑 This screen RENDERS; it does not decide. Question order, scoring, the
 * confidence gate and when the flow ends all live on the server. The one piece
 * of sequencing it owns is holding a reflection on screen before revealing the
 * question that came back with it.
 *
 * 🔑 THE SETUP WEAVE IS SPECIFIED, not invented. Adaptive ROUTING section A:
 *   step 1 — "Ask U1, U2, U3. P1 is inserted after U2. It does not count
 *             toward diagnostic length or scores."
 *   step 3 — "Ask P2. Use the existing goal-weight control. It does not count
 *             toward diagnostic length or scores."
 *   step 14 — "Setup questions, reflections, and bridges never count toward
 *              the 6-10."
 * The router deliberately never EMITS them, because letting them into the
 * reducer would perturb the diagnostic count the confidence gate keys on. That
 * makes the placement this screen's job, and the spec says where.
 *
 * 🔴 A SETUP ANSWER MUST NEVER REACH /answer. It would land in the server's
 * replayed answer log and move the scores the gate reads. They go to app state,
 * exactly as the fixed flow does, and the tree never hears about them.
 */
export function AdaptiveSurveyScreen({ navigation }: Props) {
  const { step, loading, error, progress, start, answer } = useTypingTree();
  const { state, setDietaryRestrictions, setQuizAnswer } = useApp();
  // 🔴 The id of the beat whose moment has already been spent — NOT a
  // "beatDone" boolean. A boolean set by an effect is one render stale on the
  // render where a new beat arrives, and that is long enough: `nextSetupDue`
  // ran with the PREVIOUS step's `beatDone === true`, scheduled P2, and the
  // reflection then rendered alongside it. Caught on the S24. Deriving
  // `beatPlaying` from this id during render cannot race, because the new
  // beat's id is already different on the very first render that shows it.
  const [playedBeatId, setPlayedBeatId] = useState<string | null>(null);
  const started = useRef(false);

  // Which setup questions have been shown. Each appears exactly once.
  const [setupDone, setSetupDone] = useState<Record<"P1" | "P2", boolean>>({
    P1: false,
    P2: false,
  });
  const [pendingSetup, setPendingSetup] = useState<"P1" | "P2" | null>(null);
  const [dietary, setDietary] = useState<string[]>([]);
  const [goalWeight, setGoalWeight] = useState("");
  const goalWeightValid = /^\d{2,3}$/.test(goalWeight.trim());

  // Open the session once. 🔴 A ref, not a dependency array: this screen can
  // re-render before the first response lands, and starting twice would orphan
  // a session row and reset the answer log.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // 🔴 The scan state must come from what actually happened, not a constant.
    // Three of the four routes into `Survey` arrive from a scan —
    // ScanScreen's two `replace("Survey")` calls and CameraPerm — and only
    // PreScan's "Continue without scanning" does not. This screen briefly
    // hardcoded `hasScan: false`, which was right while it lived on a
    // __DEV__-only route reachable solely from the skip, and wrong the moment
    // it became the real Survey route: every scanning member was typed as a
    // non-scanner and `deriveScanState` collapsed to NO_SCAN, leaving the
    // tree's whole scan branch unreachable.
    //
    // 🔑 `state.biometrics` is the signal, for the reason AiConsentScreen
    // documents: it is local, is populated only by a scan that actually ran,
    // and cannot be lost to a network failure the way a synced profile flag
    // can. A scan that RAN but produced no usable signal is a different state
    // (NO_TYPING_SCAN_SIGNAL) from a scan that never happened (NO_SCAN), so
    // `hasScan` says whether it ran and the biomarkers go through untouched —
    // the server owns every threshold.
    const scan = state.biometrics;
    void start({
      hasScan: scan !== null,
      stressIndex: scan?.stressIndex ?? null,
      wellnessScore: scan?.wellness ?? null,
    });
  }, [start]);

  // A reflection or bridge is "proof of listening" and arrives attached to the
  // next question. Hold it alone for a beat, the way the fixed flow does, so it
  // reads as Ester responding rather than as a label above a question.
  const beat = step?.reflection ?? step?.bridge ?? null;
  /** True while this beat still owns the screen. Derived, never stale. */
  const beatPlaying = !!beat && playedBeatId !== beat.id;

  // 🔑 P1 after U2, P2 after the reflection — ROUTING section A, steps 1 and 3.
  // Keyed off what the SERVER says has been asked, not off a local counter, so
  // a resumed session cannot re-show a setup question or skip one.
  useEffect(() => {
    const due = nextSetupDue(step, setupDone, !beatPlaying);
    if (due) setPendingSetup(due);
  }, [step, setupDone.P1, setupDone.P2, beatPlaying]);

  const finishSetup = (which: "P1" | "P2") => {
    if (which === "P1") setDietaryRestrictions(dietary);
    else if (goalWeightValid) setQuizAnswer("goalWeight", goalWeight.trim());
    setSetupDone((d) => ({ ...d, [which]: true }));
    setPendingSetup(null);
  };
  useEffect(() => {
    if (!beat || playedBeatId === beat.id) return;
    const t = setTimeout(() => setPlayedBeatId(beat.id), BEAT_MS);
    return () => clearTimeout(t);
  }, [beat?.id, playedBeatId]);

  // 🔑 The same handoff the fixed survey makes: Survey -> AccountGate. Held
  // briefly so the closing line is readable rather than a flash.
  //
  // 🔴 `replace`, not `push`. The member must not be able to swipe back into a
  // completed typing session — the server would reject the answer and they
  // would be stuck on a dead screen.
  useEffect(() => {
    if (!step?.complete) return;
    logEvent("onboarding_survey_complete", {
      engine: "adaptive",
      diagnostic_count: step.diagnosticCount,
    });
    const t = setTimeout(() => navigation.replace("AccountGate"), 1400);
    return () => clearTimeout(t);
  }, [step?.complete]);

  const question = step?.question;
  const showQuestion = !!question && !beatPlaying && !pendingSetup;

  return (
    <View style={styles.container}>
      {/* Dark-bottom gradient over the maroon page surface — the same Defs the
          fixed survey draws, so the two engines share one background. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="adaptiveSurveyBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#adaptiveSurveyBg)" />
        </Svg>
      </View>

      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={14} style={styles.iconBtn}>
            <Text style={styles.closeGlyph}>×</Text>
          </TouchableOpacity>
          {/* Ester's mark centres the bar; the fixed survey's third slot is a
              spacer, so this keeps the badge optically centred. */}
          <Image source={ESTER_BADGE} style={styles.badge} resizeMode="contain" />
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          // Surfaced rather than swallowed: a dead session must never render as
          // a question with no answers.
          <Text style={styles.error}>
            Could not reach the typing tree.{"\n"}
            {String((error as any)?.message ?? error)}
          </Text>
        ) : null}

        {/* 🔑 ONLY while the beat is playing. The reflection is a solo moment —
            Ester responding — and the fixed flow moves on from it rather than
            leaving it stacked above the next question. Rendering it whenever
            `beat` was non-null kept it on screen alongside P2 and the next
            question, which is the one way a member could tell the two engines
            apart. `beatPlaying` is what ends the moment, and `nextSetupDue`
            is handed the same derived value, so the hand-off is atomic. */}
        {beatPlaying ? <Text style={styles.beat}>{beat!.text}</Text> : null}

        {step?.complete ? (
          <Text style={styles.prompt}>Got it. That's everything I need for now.</Text>
        ) : null}

        {/* 🔴 SETUP QUESTIONS — rendered here, never sent to /answer. They do
            not score and do not count toward the 6-10, so the tree must never
            hear about them; they go to app state like the fixed flow. */}
        {pendingSetup === "P1" ? (
          <>
            <Text style={styles.prompt}>Anything I should keep out of your meals?</Text>
            <View style={styles.answers}>
              {DIETARY_RESTRICTIONS.map((o) => {
                const sel = dietary.includes(o.id);
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() =>
                      setDietary((d) =>
                        // "None" is exclusive — it is the absence of the others.
                        o.id === "none"
                          ? sel ? [] : ["none"]
                          : sel
                            ? d.filter((x) => x !== o.id)
                            : [...d.filter((x) => x !== "none"), o.id],
                      )
                    }
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
            {__DEV__ ? <Text style={styles.meta}>P1 · setup · does not count</Text> : null}
          </>
        ) : null}

        {pendingSetup === "P2" ? (
          <>
            <Text style={styles.prompt}>Where do you want your weight to land?</Text>
            {/* 🔴 maxLength + the digit strip are NOT cosmetic. Without them a
                member can type six digits; `goalWeightValid` (2-3 digits) then
                stays false and the Continue bar simply never appears, with
                nothing on screen explaining why. Walked into exactly that on
                the sim. Both guards are copied from the fixed survey, which has
                always had them. */}
            <View style={styles.weightRow}>
              <TextInput
                value={goalWeight}
                onChangeText={(t) => setGoalWeight(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="—"
                placeholderTextColor="rgba(250,253,254,0.4)"
                accessibilityLabel="Goal weight in pounds"
                returnKeyType="done"
                style={styles.weightInput}
              />
              <Text style={styles.weightUnit}>lbs</Text>
            </View>
            {/* "Include a 'Not sure yet' path" is explicit in the QUESTIONS tab.
                It stays a bubble rather than joining the Continue bar, because
                skipping is an answer, not the same affordance as advancing. */}
            <TouchableOpacity onPress={() => finishSetup("P2")} style={styles.skip}>
              <Text style={styles.skipText}>Not sure yet</Text>
            </TouchableOpacity>
            {__DEV__ ? <Text style={styles.meta}>P2 · setup · does not count</Text> : null}
          </>
        ) : null}

        {showQuestion ? (
          <>
            <Text style={styles.prompt}>{question.text}</Text>
            <View style={styles.answers}>
              {[...question.answers]
                .sort((a, b) => a.order - b.order)
                .map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    // 🔑 Disabled while a request is in flight. The hook also
                    // guards this with a ref, because a second tap can land
                    // before `loading` has re-rendered the button.
                    disabled={loading}
                    onPress={() => {
                      // Mirrors the fixed survey's `onboarding_survey_<id>`
                      // events so the funnel stays comparable across engines.
                      logEvent(`onboarding_survey_${question.id.toLowerCase()}`, {
                        value: a.id,
                        engine: "adaptive",
                      });
                      void answer(question.id, a.id);
                    }}
                    activeOpacity={0.85}
                    style={[styles.bubble, loading && styles.bubbleDisabled]}
                  >
                    <Text style={styles.bubbleText}>{a.text}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            {/* 🔴 DEV ONLY. These labels are how the tree is walked on a
                device — which question the server chose and how many of the
                6-10 diagnostics are banked. A member must never see them. */}
            {__DEV__ ? (
              <Text style={styles.meta}>
                {question.id} · {step?.diagnosticCount ?? 0} answered
              </Text>
            ) : null}
          </>
        ) : null}

        {/* 🔑 Ester "composing", not a spinner. The fixed survey never shows a
            loading indicator — it shows the typing bubble — and a member must
            not be able to tell which engine they are on. */}
        {loading && !question ? (
          <View style={styles.typingBubble}>
            <EsterTypingDots />
          </View>
        ) : null}
      </ScrollView>

      {/* Continue + arrow. 🔑 Screen Copy row 7: "Continue appears only on P1
          (multi-select) and P2 (goal weight)" — every scored question is
          single-select and advances on tap, which is why no diagnostic question
          renders this bar. */}
      {((pendingSetup === "P1" && dietary.length > 0) ||
        (pendingSetup === "P2" && goalWeightValid)) && (
        <SafeAreaView edges={["bottom"]} style={styles.bottomBar} pointerEvents="box-none">
          <View style={styles.continueRow}>
            <TouchableOpacity
              onPress={() => finishSetup(pendingSetup)}
              style={styles.continuePill}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => finishSetup(pendingSetup)}
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
    </View>
  );
}

// 🔴 Every value here is lifted from `OnboardingSurveyScreen`, deliberately.
// Where the two disagreed before, the fixed survey won — it is the one Lang
// signed off and the one members are walking today.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, zIndex: 2 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: WHITE, fontSize: 28, lineHeight: 30 },
  badge: { width: 40, height: 40 },
  progressTrack: {
    alignSelf: "center",
    width: 160,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    marginTop: 4,
  },
  progressFill: { height: 2, borderRadius: 999, backgroundColor: WHITE },
  // 🔑 paddingTop clears the absolutely-positioned top bar; paddingBottom
  // clears the Continue bar, exactly as the fixed survey's scrollContent does.
  content: { paddingHorizontal: 24, paddingTop: 140, paddingBottom: 220 },
  // A reflection or bridge is Ester speaking. It is set at the QUESTION size,
  // not the fixed survey's 16pt `messageLine`: a beat holds the screen on its
  // own here, so at 16pt it read as a caption floating in an empty screen
  // rather than as Ester's half of the conversation. Cole's call, 2026-10-13,
  // off the solo-beat screenshot. The fixed survey's reflection step is still
  // 16pt — that one is in the live funnel, so it is a separate decision.
  beat: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    color: WHITE,
    letterSpacing: -0.24,
    marginBottom: 28,
  },
  prompt: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    color: WHITE,
    letterSpacing: -0.24,
  },
  answers: { marginTop: 24, gap: 8, alignItems: "flex-end" },
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
  bubbleDisabled: { opacity: 0.4 },
  bubbleSelected: { backgroundColor: BONE },
  bubbleText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 21,
    color: WHITE,
    letterSpacing: -0.16,
  },
  bubbleTextSelected: { color: MAROON },
  // Ester composing — left-tailed outline bubble, content-sized.
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
  skip: { marginTop: 16, alignSelf: "flex-end" },
  skipText: {
    fontFamily: fonts.dmSans,
    color: "rgba(250,253,254,0.6)",
    fontSize: 14,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
    marginTop: 24,
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
  bottomBar: { position: "absolute", left: 16, right: 16, bottom: 0, paddingBottom: 24 },
  continueRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 0,
  },
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
  meta: { color: "rgba(250,253,254,0.4)", fontSize: 12, marginTop: 24 },
  error: { color: "#FFB4A8", fontSize: 14, marginBottom: 20 },
});

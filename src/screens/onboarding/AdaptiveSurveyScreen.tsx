import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { useTypingTree } from "../../hooks/useTypingTree";

type Props = NativeStackScreenProps<any, "AdaptiveSurvey">;

const MAROON = K.brown;
const WHITE = "#FAFDFE";
const GHOST = "rgba(250,253,254,0.12)";

/** How long a reflection or bridge holds the screen before the question. */
const BEAT_MS = 3200;

/**
 * The adaptive onboarding survey — the server-driven counterpart to
 * `OnboardingSurveyScreen`.
 *
 * ⚠️ NOT in the live flow. `SURVEY_STEPS` is still what members walk. This is
 * reachable only through the __DEV__ route so the loop can be exercised on a
 * device against a real backend, which is the only way to test anything in this
 * repo — there is no test runner.
 *
 * 🔑 This screen RENDERS; it does not decide. Question order, scoring, the
 * confidence gate and when the flow ends all live on the server. The one piece
 * of sequencing it owns is holding a reflection on screen before revealing the
 * question that came back with it.
 *
 * 🔴 STILL TO RESOLVE BEFORE THIS CAN GO LIVE: the non-scoring setup questions.
 * The router deliberately does NOT emit P1 (dietary restrictions) or P2 (goal
 * weight) — they never score, so letting them into the reducer would perturb
 * the diagnostic count the confidence gate keys on, which makes their placement
 * a presentation concern this screen has to own. The fixed flow puts P1 after
 * the second question and P2 after the reflection. Mirroring that is the
 * obvious default, but it is a product decision and it is not made here.
 */
export function AdaptiveSurveyScreen({ navigation }: Props) {
  const { step, loading, error, progress, start, answer } = useTypingTree();
  const [beatDone, setBeatDone] = useState(true);
  const started = useRef(false);

  // Open the session once. 🔴 A ref, not a dependency array: this screen can
  // re-render before the first response lands, and starting twice would orphan
  // a session row and reset the answer log.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // hasScan false for the dev walk — the skipped-scan route is the one worth
    // exercising, since it is the path the fixed flow historically got wrong.
    void start({ hasScan: false });
  }, [start]);

  // A reflection or bridge is "proof of listening" and arrives attached to the
  // next question. Hold it alone for a beat, the way the fixed flow does, so it
  // reads as Ester responding rather than as a label above a question.
  const beat = step?.reflection ?? step?.bridge ?? null;
  useEffect(() => {
    if (!beat) {
      setBeatDone(true);
      return;
    }
    setBeatDone(false);
    const t = setTimeout(() => setBeatDone(true), BEAT_MS);
    return () => clearTimeout(t);
  }, [beat?.id]);

  const question = step?.question;
  const showQuestion = !!question && beatDone;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={14} style={styles.iconBtn}>
            <Text style={styles.closeGlyph}>×</Text>
          </TouchableOpacity>
          <Text style={styles.devTag}>adaptive · dev</Text>
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

        {beat ? <Text style={styles.beat}>{beat.text}</Text> : null}

        {step?.complete ? (
          <View>
            <Text style={styles.prompt}>That's everything I need.</Text>
            <Text style={styles.outcome}>
              {JSON.stringify(step.outcome, null, 2)}
            </Text>
          </View>
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
                    onPress={() => void answer(question.id, a.id)}
                    activeOpacity={0.85}
                    style={[styles.bubble, loading && styles.bubbleDisabled]}
                  >
                    <Text style={styles.bubbleText}>{a.text}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            <Text style={styles.meta}>
              {question.id} · {step?.diagnosticCount ?? 0} answered
            </Text>
          </>
        ) : null}

        {loading && !question ? <ActivityIndicator color={WHITE} style={styles.spinner} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  topBar: { paddingHorizontal: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: WHITE, fontSize: 28, lineHeight: 30 },
  devTag: { color: "rgba(250,253,254,0.5)", fontSize: 12 },
  progressTrack: {
    alignSelf: "center",
    width: 160,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    marginTop: 4,
  },
  progressFill: { height: 2, borderRadius: 999, backgroundColor: WHITE },
  content: { padding: 24, paddingTop: 48 },
  beat: { color: WHITE, fontSize: 20, lineHeight: 28, marginBottom: 28, opacity: 0.9 },
  prompt: { color: WHITE, fontSize: 24, lineHeight: 32, marginBottom: 24 },
  answers: { gap: 12, alignItems: "flex-end" },
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
  bubbleDisabled: { opacity: 0.5 },
  bubbleText: { color: WHITE, fontSize: 16, lineHeight: 22 },
  meta: { color: "rgba(250,253,254,0.4)", fontSize: 12, marginTop: 24 },
  outcome: { color: "rgba(250,253,254,0.7)", fontSize: 12, fontFamily: "Menlo" },
  error: { color: "#FFB4A8", fontSize: 14, marginBottom: 20 },
  spinner: { marginTop: 40 },
});

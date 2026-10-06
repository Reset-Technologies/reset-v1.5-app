// Config-driven definition of the post-scan onboarding "chat" survey.
//
// RES-121: the survey now collects 3 typing answers (no more branching).
// Flow:
//   Scan → [logo splash] → [Ester intro message] → goal Q → q1 Q → q2 Q
//        → q3 Q → dietary Q → [analyzing → backend typing] → Account → ...
//
// The analyzing step submits {q1, q2, q3} to the backend via
// syncOnboardingToBackend; the backend's TypingService returns the
// archetype. The FE no longer computes the type locally.

import { V1_QUESTIONS, V1QuestionId } from "../../constants/v1Questions";
import {
  QUIZ_Q1,
  QUIZ_Q2,
  QUIZ_Q3,
  DIETARY_RESTRICTIONS,
} from "../../constants/types";

export type SurveyOption = { id: string; label: string };

export type SurveyStep =
  | { kind: "logo"; durationMs: number }
  | {
      kind: "message";
      lines: string[];
      /**
       * Lines to use when the member SKIPPED the scan. Optional: only the
       * steps that actually assert something about a scan need it.
       */
      linesNoScan?: string[];
      durationMs: number;
    }
  /**
   * Proof of listening — Screen Copy row 8, Flow row 8 (`v1_reflection`).
   * One of R1–R5, chosen from the provisional archetype leader after the three
   * scored questions. The text is not held here because it depends on answers
   * the member has only just given; the screen resolves it at render time.
   */
  | { kind: "reflection"; durationMs: number }
  | {
      kind: "question";
      /**
       * AppContext key this answer writes to.
       *
       * 🔑 For the six SCORED V1 questions the key is the workbook's question
       * id (U1 … M11) and the selected option id is the workbook's answer id
       * (U1_A2 …). Both go to the backend verbatim — they are the scoring keys
       * the ANSWER WEIGHTS table is indexed by, not display details.
       */
      key:
        | V1QuestionId
        | "goal"
        | "restrict"
        | "fastingInterest";
      question: string;
      options: SurveyOption[] | "_dietary";
      multiSelect?: boolean;
      /**
       * Option that opens the explainer sheet instead of answering, so
       * "Tell me more…" can teach without forcing a choice (Figma 4328:13197).
       * The question stays put until a real answer is picked.
       */
      infoOptionId?: string;
      eventName: string;
    }
  /**
   * P2 — "Where do you want your weight to land?" (ROUTING step 3).
   * Non-scoring: it never reaches the typing engine. The handoff says to reuse
   * the existing goal-weight control, but there isn't one in this app, so this
   * is its own step kind.
   * 🔑 "Include a 'Not sure yet' path" is explicit in the QUESTIONS tab.
   */
  | {
      kind: "goalWeight";
      question: string;
      skipLabel: string;
      eventName: string;
    }
  | { kind: "analyzing"; text: string; durationMs: number };

// No per-step `progress` here: OnboardingSurveyScreen derives the bar from
// each step's position. It used to be hand-set, and adding the two Reset Window
// questions made it crawl +2%/+3% after allergies while earlier questions
// jumped +14% — the bar looked stuck just before the finish.
/**
 * 🔑 Helper so the six scored questions are built FROM the workbook constant
 * rather than retyped here. Nothing about their copy lives in this file.
 */
const scored = (id: V1QuestionId): SurveyStep => {
  const q = V1_QUESTIONS.find((x) => x.id === id)!;
  return {
    kind: "question",
    key: id,
    question: q.prompt,
    options: q.options,
    eventName: `onboarding_survey_${id.toLowerCase()}`,
  };
};

/**
 * The fixed V1 sequence — ROUTING section A, steps 1–4:
 *
 *   U1 → U2 → P1 → U3 → reflection → P2 → M1 → M6 → M11
 *
 * 🔴 SIX scored questions, and the order is fixed: "Questions never change
 * based on answers in V1." P1, P2 and the reflection never score and never
 * count toward the six (Implementation rule 5).
 *
 * 🔴 The two steps at the end — the goals question and the Reset Window
 * question — are NOT in Bryan's sequence. They are ours: the goals question is
 * his Open Check #11 against Lang ("confirm it's placeholder only") and the
 * Window question is the feature's onboarding introduction. They sit AFTER M11
 * deliberately, so the six-question diagnostic run stays contiguous and
 * unpolluted, and so either can be deleted in one line once he answers.
 */
export const SURVEY_STEPS: SurveyStep[] = [
  { kind: "logo", durationMs: 9500 },
  {
    kind: "message",
    lines: [
      "Hi, I'm Ester.",
      "I'll ask a few quick questions about what usually happens in your day, then I'll put the pieces together.",
    ],
    // 🔴 Ester's FIRST words cannot assert a scan the member declined. Until the
    // skip fix (2026-09-29) scanners were the only people who reached this
    // screen; skippers land on it now. Chosen on `state.biometrics === null`,
    // not `startingRead` — V1 types everyone from answers, so startingRead is
    // always false. Copy here is the LOCKED Screen Copy, not the carousel-era
    // wording that the 2026-10-05 cherry-pick carried onto main.
    linesNoScan: [
      "Hi, I'm Ester.",
      "I'll ask a few quick questions about what usually happens in your day. That's enough to find your starting Type.",
    ],
    durationMs: 2800,
  },

  // ── Q1, Q2 ────────────────────────────────────────────────────────────────
  scored("U1"),
  scored("U2"),

  // ── P1 — dietary restrictions. Non-scoring; reuses the existing control. ──
  {
    kind: "question",
    key: "restrict",
    question: "Anything I should keep out of your meals?",
    options: "_dietary",
    multiSelect: true,
    eventName: "onboarding_survey_restrict",
  },

  // ── Q3, then the one reflection ───────────────────────────────────────────
  scored("U3"),
  // ROUTING step 2: "After U3, choose R1–R5 using the provisional answer leader
  // across U1–U3. Reflection never changes scores."
  { kind: "reflection", durationMs: 3200 },

  // ── P2 — goal weight. Non-scoring. ROUTING step 3 puts it here. ───────────
  {
    kind: "goalWeight",
    question: "Where do you want your weight to land?",
    skipLabel: "Not sure yet",
    eventName: "onboarding_survey_goal_weight",
  },

  // ── Q4, Q5, Q6 ────────────────────────────────────────────────────────────
  scored("M1"),
  scored("M6"),
  scored("M11"),

  // ── Ours, not Bryan's, and the one he kept. ───────────────────────────────
  // 🔴 The general goals question was CUT here (Bryan, 2026-10-04): "For goals,
  // keep the goal-weight question... If there's also a separate general goals
  // question in the current flow, we can drop that one." P2 above is the goal
  // we collect now. This also closes his Open Check #11 against Lang, which
  // asked whether that question was placeholder only.
  //
  // The Reset Window question he explicitly kept. It stays AFTER M11 so the
  // six-question diagnostic run remains contiguous.
  {
    kind: "question",
    key: "fastingInterest",
    question: "Would you like Reset to help with when you eat?",
    options: [
      { id: "yes", label: "Yes, set up my Window" },
      { id: "maybe_later", label: "Maybe later" },
    ],
    eventName: "onboarding_survey_fastingInterest",
  },

  {
    kind: "analyzing",
    text: "Putting it together\u2026",
    durationMs: 9500,
  },
];

/** Resolve the runtime option list for a "question" step. */
export function resolveOptions(
  step: Extract<SurveyStep, { kind: "question" }>,
): SurveyOption[] {
  if (Array.isArray(step.options)) return step.options;
  // "_dietary"
  return DIETARY_RESTRICTIONS.map((o) => ({ id: o.id, label: o.label }));
}

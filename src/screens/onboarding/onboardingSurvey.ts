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
      /** AppContext key this answer writes to. */
      key: "goal" | "q1" | "q2" | "q3" | "restrict" | "fastingInterest";
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
  | { kind: "analyzing"; text: string; durationMs: number };

// No per-step `progress` here: OnboardingSurveyScreen derives the bar from
// each step's position. It used to be hand-set, and adding the two Reset Window
// questions made it crawl +2%/+3% after allergies while earlier questions
// jumped +14% — the bar looked stuck just before the finish.
export const SURVEY_STEPS: SurveyStep[] = [
  // Post-scan intro video is ~8.9s (the full-length Burner reveal clip). The
  // screen advances when the video actually finishes (playToEnd); durationMs is
  // only a fallback cap, so it must sit comfortably above the video length to
  // avoid cutting it off.
  { kind: "logo", durationMs: 9500 },
  {
    kind: "message",
    // Screen Copy row 6 `Ester intro`. Bryan wrote BOTH variants as Final, so
    // the skip branch is no longer the shipped line with the thanks removed —
    // each path has its own authored ending. The scanned one hands off to row
    // 12's loading line on purpose ("put the pieces together" → "Putting it
    // together…"), and the skipped one promises a "starting Type" rather than
    // "the most accurate type", which is the same softening the reveal card
    // already makes with STARTING_READ_TAGLINE.
    lines: [
      "Hi, I'm Ester.",
      "I'll ask a few quick questions about what usually happens in your day, then I'll put the pieces together.",
    ],
    linesNoScan: [
      "Hi, I'm Ester.",
      "I'll ask a few quick questions about what usually happens in your day. That's enough to find your starting Type.",
    ],
    durationMs: 2800,
  },
  {
    kind: "question",
    key: "goal",
    question: "Do you have any goals I can help you try and achieve?",
    options: [
      { id: "weight_loss", label: "Weight loss" },
      { id: "training", label: "Training for something" },
      { id: "maintain_weight", label: "Maintain weight" },
      {
        id: "understand_food_impact",
        label:
          "Be healthy and better understand the impact of different food on my body",
      },
    ],
    eventName: "onboarding_survey_goal",
  },
  {
    kind: "question",
    key: "q1",
    question: QUIZ_Q1.esterPrompt,
    options: QUIZ_Q1.options.map((o) => ({ id: o.value, label: o.label })),
    eventName: "onboarding_survey_q1",
  },
  {
    kind: "question",
    key: "q2",
    question: QUIZ_Q2.esterPrompt,
    options: QUIZ_Q2.options.map((o) => ({ id: o.value, label: o.label })),
    eventName: "onboarding_survey_q2",
  },
  {
    kind: "question",
    key: "q3",
    question: QUIZ_Q3.esterPrompt,
    options: QUIZ_Q3.options.map((o) => ({ id: o.value, label: o.label })),
    eventName: "onboarding_survey_q3",
  },
  // 🔑 Here, and only here. Row 8: "Exactly one R1–R5 after U3." Our q3 IS the
  // third scored question — the wording differs from the Sheet's U1–U3 until
  // the V1 question set is rebuilt, but it feeds the same scorer, and the
  // lines describe the pattern rather than quoting the answer.
  // ⚠️ Row 8 also says "then P2 on the same screen". We have no goal-weight
  // step yet (it ships with the V1 questions), so the reflection stands alone
  // for now — raised with Bryan 2026-10-01.
  { kind: "reflection", durationMs: 3200 },
  {
    kind: "question",
    key: "restrict",
    question: "Any foods you can't eat? Pick all that apply.",
    options: "_dietary",
    multiSelect: true,
    eventName: "onboarding_survey_restrict",
  },
  // Reset Window. Sits after the typing questions so Ester has something to
  // react to, and before "analyzing" so the recommendation can land on the
  // first-reset-score card.
  //
  // Copy is Bryan's (13 Sep): ONE question, two answers. It replaces Lang's two
  // questions ("Are you interested in intermittent fasting?" and "Most people
  // start off with a 12:8 fast…") — the starting ratio now lives on the
  // recommendation card, and "Tell me more" is gone, so FastingInfoSheet has no
  // entry point (the `infoOptionId` plumbing stays, should it come back).
  //
  // Keep the `maybe_later` id: WindowRecCard reads it to soften its framing, and
  // PaywallScreen reads this key to consume the existing-member intro gate.
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
    // Screen Copy row 12 (`type_processing.line`, Final). Brief, and it names
    // no Type — the Type is not revealed until after the paywall.
    text: "Putting it together\u2026",
    // Same video as the post-scan intro (~8.9s). Advances on playToEnd;
    // durationMs is only the fallback cap (see the "logo" step above).
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

// Config-driven definition of the post-scan onboarding "chat" survey.
//
// Flow (per RES-119 / Figma "Onboarding" section, left-to-right):
//   Scan → [logo splash] → [Ester intro message] → goal Q → q1 Q → q2 Q
//        → dietary Q → [analyzing] → Account → TypeReveal → ...
//
// Each entry is one "step" in a single `Survey` route; the route param `step`
// is the index into SURVEY_STEPS. Questions are intentionally data so the
// screen stays a thin renderer. Branching questions (q2 depends on q1) and the
// answer plumbing into AppContext are resolved in OnboardingSurveyScreen.

import { QUIZ_Q1, DIETARY_RESTRICTIONS } from "../../constants/types";

export type SurveyOption = { id: string; label: string };

export type SurveyStep =
  | { kind: "logo"; durationMs: number }
  | { kind: "message"; lines: string[]; progress: number; durationMs: number }
  | {
      kind: "question";
      /** AppContext key this answer writes to. */
      key: "goal" | "q1" | "q2" | "restrict";
      /** Static question text, or "_dynamic" when it depends on a prior answer. */
      question: string | "_dynamic";
      /** Static options, or a sentinel resolved at render time. */
      options: SurveyOption[] | "_q2" | "_dietary";
      multiSelect?: boolean;
      progress: number;
      eventName: string;
    }
  | { kind: "analyzing"; text: string; progress: number; durationMs: number };

export const SURVEY_STEPS: SurveyStep[] = [
  // Post-scan intro video is ~4.7s; advance when it finishes.
  { kind: "logo", durationMs: 4800 },
  {
    kind: "message",
    lines: [
      "Hello, I'm Ester!",
      "Your personal nutritionist. Thanks for completing the scan!",
      "I have just a few more questions, so I can give you the most accurate type.",
    ],
    progress: 0.06,
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
    progress: 0.39,
    eventName: "onboarding_survey_goal",
  },
  {
    kind: "question",
    key: "q1",
    question: QUIZ_Q1.esterPrompt,
    options: QUIZ_Q1.options.map((o) => ({ id: o.value, label: o.label })),
    progress: 0.55,
    eventName: "onboarding_survey_q1",
  },
  {
    kind: "question",
    key: "q2",
    question: "_dynamic",
    options: "_q2",
    progress: 0.72,
    eventName: "onboarding_survey_q2",
  },
  {
    kind: "question",
    key: "restrict",
    question: "Any foods you can't eat? Pick all that apply.",
    options: "_dietary",
    multiSelect: true,
    progress: 0.86,
    eventName: "onboarding_survey_restrict",
  },
  {
    kind: "analyzing",
    text: "Analyzing your responses",
    progress: 0.96,
    // Match the analyzing-video length (same MP4 as the post-scan intro).
    durationMs: 4800,
  },
];

/** Resolve the runtime option list for a "question" step. */
export function resolveOptions(
  step: Extract<SurveyStep, { kind: "question" }>,
  q1Answer: string | null
): SurveyOption[] {
  if (Array.isArray(step.options)) return step.options;
  if (step.options === "_dietary")
    return DIETARY_RESTRICTIONS.map((o) => ({ id: o.id, label: o.label }));
  // "_q2" — depends on q1.
  const a = (q1Answer as "afternoon_evening" | "random") || "afternoon_evening";
  // Re-derive without importing getQuizQ2 to keep this file dependency-light.
  return a === "afternoon_evening"
    ? [
        { id: "crash", label: "I crash hard" },
        { id: "drift", label: "I drift into it" },
      ]
    : [
        { id: "crash", label: "Hits suddenly" },
        { id: "drift", label: "More gradual" },
      ];
}

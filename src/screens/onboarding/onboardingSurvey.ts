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
  | { kind: "message"; lines: string[]; progress: number; durationMs: number }
  | {
      kind: "question";
      /** AppContext key this answer writes to. */
      key: "goal" | "q1" | "q2" | "q3" | "restrict";
      question: string;
      options: SurveyOption[] | "_dietary";
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
    progress: 0.32,
    eventName: "onboarding_survey_goal",
  },
  {
    kind: "question",
    key: "q1",
    question: QUIZ_Q1.esterPrompt,
    options: QUIZ_Q1.options.map((o) => ({ id: o.value, label: o.label })),
    progress: 0.48,
    eventName: "onboarding_survey_q1",
  },
  {
    kind: "question",
    key: "q2",
    question: QUIZ_Q2.esterPrompt,
    options: QUIZ_Q2.options.map((o) => ({ id: o.value, label: o.label })),
    progress: 0.62,
    eventName: "onboarding_survey_q2",
  },
  {
    kind: "question",
    key: "q3",
    question: QUIZ_Q3.esterPrompt,
    options: QUIZ_Q3.options.map((o) => ({ id: o.value, label: o.label })),
    progress: 0.76,
    eventName: "onboarding_survey_q3",
  },
  {
    kind: "question",
    key: "restrict",
    question: "Any foods you can't eat? Pick all that apply.",
    options: "_dietary",
    multiSelect: true,
    progress: 0.88,
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
): SurveyOption[] {
  if (Array.isArray(step.options)) return step.options;
  // "_dietary"
  return DIETARY_RESTRICTIONS.map((o) => ({ id: o.id, label: o.label }));
}

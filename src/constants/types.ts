import { MetabolicType } from "./colors";

export interface TypeConfig {
  name: MetabolicType;
  internalBucket: string;
  title: string;
  tagline: string;
  description: string;
  corePhilosophy: string;
  whyLineSeed: string;
  traits: string[];
  signals: {
    stress: "high" | "moderate" | "low";
    energy: "fluctuating" | "stable" | "building";
    recovery: "fast" | "moderate" | "slow";
  };
}

export const TYPE_CONFIGS: Record<MetabolicType, TypeConfig> = {
  Burner: {
    name: "Burner",
    internalBucket: "Stress-Driven",
    title: "The Burner",
    tagline: "Your metabolism runs hot under stress.",
    description: "Your body burns energy fast when stressed. Protein-forward meals stabilize your afternoon and prevent the crash that shapes your hunger.",
    corePhilosophy: "Protein-forward, anti-cortisol, never skip meals",
    whyLineSeed: "Protein-forward to stabilize your afternoon.",
    traits: ["Fast metabolism", "Afternoon energy dips", "Stress-driven eating"],
    signals: {
      stress: "high",
      energy: "fluctuating",
      recovery: "fast",
    },
  },
  Rebounder: {
    name: "Rebounder",
    internalBucket: "Rebounder",
    title: "The Rebounder",
    tagline: "Your body learned to fight back against restriction.",
    description: "Your metabolism has adapted to protect itself. Calorie-sufficient meals help your metabolism find its rhythm again — never deficit-framed.",
    corePhilosophy: "Calorie-sufficient, NEVER deficit-framed",
    whyLineSeed: "Calorie-sufficient — your body needs fuel, not restriction.",
    traits: ["Protective metabolism", "Steady energy needs", "Recovery-focused"],
    signals: {
      stress: "moderate",
      energy: "stable",
      recovery: "moderate",
    },
  },
  Ember: {
    name: "Ember",
    internalBucket: "Depleted",
    title: "The Ember",
    tagline: "Your body needs to rebuild what's been missing.",
    description: "Your system's been stretched thin. It needs consistent micronutrient support — never suggest eating less.",
    corePhilosophy: "Micronutrient restoration, never suggest eating less",
    whyLineSeed: "Iron and magnesium to rebuild what's been missing.",
    traits: ["Nutrient-depleted", "Low baseline energy", "Recovery-focused"],
    signals: {
      stress: "low",
      energy: "building",
      recovery: "slow",
    },
  },
  Chameleon: {
    name: "Chameleon",
    internalBucket: "Cycler",
    title: "The Chameleon",
    tagline: "Your metabolism follows its own rhythm.",
    description: "Your body responds to natural cycles. Phase-aware, rhythm-based meal timing works with your biology, not against it.",
    corePhilosophy: "Phase-aware, rhythm-based meal timing",
    whyLineSeed: "Timed to your cycle. Heavier now, lighter next week.",
    traits: ["Cyclical patterns", "Variable hunger", "Rhythm-sensitive"],
    signals: {
      stress: "moderate",
      energy: "fluctuating",
      recovery: "moderate",
    },
  },
  Explorer: {
    name: "Explorer",
    internalBucket: "Unstructured",
    title: "The Explorer",
    tagline: "Your signals are quiet — easier for me to read.",
    description: "Your metabolic signals aren't loud yet. A balanced baseline lets me learn your pattern fast from your feedback.",
    corePhilosophy: "Balanced baseline, learn fast from feedback",
    whyLineSeed: "Balanced baseline. I'll learn your pattern from here.",
    traits: ["Quiet signals", "Adaptable metabolism", "Feedback-responsive"],
    signals: {
      stress: "low",
      energy: "stable",
      recovery: "fast",
    },
  },
};

// RES-121 typing-survey answer value IDs. These must stay in sync with
// the backend `update-profile.dto.ts` enums and `typing.types.ts`.
export type Q1AnswerId =
  | "sharp_morning"
  | "steady_flat"
  | "variable_days"
  | "all_over_place";
export type Q2AnswerId =
  | "after_dinner"
  | "not_hungry"
  | "depends_on_week"
  | "falls_apart_at_once";
export type Q3AnswerId =
  | "first_attempt"
  | "few_times"
  | "many_times"
  | "glp1";

export interface QuizState {
  q1: Q1AnswerId | null;
  q2: Q2AnswerId | null;
  q3: Q3AnswerId | null;
}

// Q1: When does your energy usually drop?
export const QUIZ_Q1 = {
  id: "q1",
  esterPrompt: "When does your energy usually drop?",
  options: [
    {
      id: "sharp_morning",
      label: "Sharp in the morning, then I binge later",
      value: "sharp_morning" as Q1AnswerId,
    },
    { id: "steady_flat", label: "Steady but flat", value: "steady_flat" as Q1AnswerId },
    {
      id: "variable_days",
      label: "Some days great, some exhausted",
      value: "variable_days" as Q1AnswerId,
    },
    {
      id: "all_over_place",
      label: "All over the place",
      value: "all_over_place" as Q1AnswerId,
    },
  ],
};

// Q2: When are you most likely to lose control around food?
export const QUIZ_Q2 = {
  id: "q2",
  esterPrompt: "When are you most likely to lose control around food?",
  options: [
    {
      id: "after_dinner",
      label: "After dinner, the day unravels",
      value: "after_dinner" as Q2AnswerId,
    },
    {
      id: "not_hungry",
      label: "Not really hungry but I eat anyway",
      value: "not_hungry" as Q2AnswerId,
    },
    {
      id: "depends_on_week",
      label: "Depends on the week",
      value: "depends_on_week" as Q2AnswerId,
    },
    {
      id: "falls_apart_at_once",
      label: "Hold it together, then it falls apart at once",
      value: "falls_apart_at_once" as Q2AnswerId,
    },
  ],
};

// Q3: How many times have you tried to lose this weight before?
export const QUIZ_Q3 = {
  id: "q3",
  esterPrompt: "How many times have you tried to lose this weight before?",
  options: [
    {
      id: "first_attempt",
      label: "First real attempt",
      value: "first_attempt" as Q3AnswerId,
    },
    {
      id: "few_times",
      label: "A few times, lost it and came back",
      value: "few_times" as Q3AnswerId,
    },
    {
      id: "many_times",
      label: "Many times, dieting on and off for years",
      value: "many_times" as Q3AnswerId,
    },
    {
      id: "glp1",
      label: "Currently on a GLP-1 or recently came off",
      value: "glp1" as Q3AnswerId,
    },
  ],
};

// NOTE: `determineType` was removed in RES-121. The backend's TypingService
// is the authoritative source of the metabolic-type assignment — the FE
// now submits all 3 behavior answers via the profile-update endpoint and
// reads `primaryBucket` from the response. See `src/services/onboarding.ts`
// for the submission and `src/screens/onboarding/OnboardingSurveyScreen.tsx`
// for the analyzing-step handoff.

// Backward-compat stubs — kept so the V0 orphan screens (QuizScreen,
// ScanRevealScreen) still compile. They are no longer in the active
// onboarding flow.
export function determineType(_q1?: string, _q2?: string): MetabolicType {
  return "Explorer";
}
export function getQuizQ2(_q1Answer?: string) {
  return {
    id: "q2",
    esterPrompt: QUIZ_Q2.esterPrompt,
    options: QUIZ_Q2.options,
  };
}
export function getQuizQ3Setup(_q1?: string, _q2?: string): string {
  return "";
}
export function getTypeRevealText(
  _q1?: string,
  _q2?: string,
  _hasScan?: boolean,
): string {
  return "";
}

// Taste clusters (4 options in 2x2 grid)
import type { ImageSourcePropType } from "react-native";

export interface TasteCluster {
  id: string;
  name: string;
  characteristics: string;
  image: ImageSourcePropType;
}

export const TASTE_CLUSTERS: TasteCluster[] = [
  {
    id: "comfort",
    name: "Chicken Pesto Pasta",
    characteristics: "Higher density, carb-inclusive, warm, familiar",
    image: require("../../assets/taste-clusters/comfort.jpg"),
  },
  {
    id: "fresh",
    name: "Grilled Salmon Bowl",
    characteristics: "Lower density, vegetable-led, light preparations",
    image: require("../../assets/taste-clusters/fresh.jpg"),
  },
  {
    id: "simple",
    name: "Chicken + Sweet Potato",
    characteristics: "Minimal ingredients (≤5), common proteins",
    image: require("../../assets/taste-clusters/simple.jpg"),
  },
  {
    id: "adventurous",
    name: "Miso Chicken Wraps",
    characteristics: "Complex flavors, international, unusual ingredients",
    image: require("../../assets/taste-clusters/adventurous.jpg"),
  },
];

// Dietary restrictions (inline pills)
export const DIETARY_RESTRICTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten_free", label: "Gluten-free" },
  { id: "dairy_free", label: "Dairy-free" },
  { id: "nut_allergy", label: "Nut allergy" },
  { id: "shellfish", label: "Shellfish" },
  { id: "none", label: "None" },
];

// Confidence tiers
export const CONFIDENCE_TIERS = {
  PATTERN_ACK: { min: 35, max: 45, name: "Pattern Acknowledgment" },
  OBSERVATION: { min: 46, max: 65, name: "Observation" },
  INTERPRETATION: { min: 66, max: 80, name: "Interpretation" },
  PREDICTION: { min: 81, max: 100, name: "Prediction" },
};

export function getConfidenceTier(confidence: number) {
  if (confidence <= 45) return CONFIDENCE_TIERS.PATTERN_ACK;
  if (confidence <= 65) return CONFIDENCE_TIERS.OBSERVATION;
  if (confidence <= 80) return CONFIDENCE_TIERS.INTERPRETATION;
  return CONFIDENCE_TIERS.PREDICTION;
}

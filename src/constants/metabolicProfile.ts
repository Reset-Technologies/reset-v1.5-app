import { MetabolicType } from "./colors";

// Per-type profile visuals + copy, shared by the Profile screen and the
// onboarding type-summary slide (RES-146) so they stay in sync. This is the
// single place to edit the per-type goal/strength/weakness wording (RES-139).

// Per-type R-block logos. "Ember" alias = the Figma "Restorer" art.
export const TYPE_LOGO = {
  Burner: require("../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../assets/images/type-logos/Explorer.png"),
} as const;

// Per-type radial gradient stops, approximating the Figma .Gradient assets.
// All five share the dark anchor at center-bottom; the outer ring picks up the
// type's accent. "Ember" alias here = the "Restorer" gradient in Figma.
export const TYPE_GRADIENT_STOPS: Record<
  MetabolicType,
  { anchor: string; mid: string; outer: string }
> = {
  Burner: { anchor: "#361416", mid: "#A45937", outer: "#D6B5A5" },
  Rebounder: { anchor: "#2D2435", mid: "#5D5470", outer: "#A89DC0" },
  Ember: { anchor: "#3A1A1F", mid: "#4F5760", outer: "#A8B8BE" },
  Chameleon: { anchor: "#4A1E2D", mid: "#6B5A4A", outer: "#A8B585" },
  Explorer: { anchor: "#4A2A4F", mid: "#8A7060", outer: "#D8B247" },
};

// Primary accent color per type, sampled from each logo's dominant hue. Used
// for the headline type word, section-title dots, and confidence accents.
export const TYPE_PRIMARY: Record<MetabolicType, string> = {
  Burner: "#C2774A", // terracotta / copper-orange
  Rebounder: "#9479A6", // muted mauve-purple
  Ember: "#6F949D", // slate blue (Restorer)
  Chameleon: "#7E8C63", // sage / olive green
  Explorer: "#BF9B33", // warm gold / amber
};

// Light tint of each primary — confidence card background.
export const TYPE_TINT: Record<MetabolicType, string> = {
  Burner: "#F5E9E1",
  Rebounder: "#F0EBF3",
  Ember: "#E9F0F2",
  Chameleon: "#EDEFE6",
  Explorer: "#F4EFDE",
};

// Display names (Ember's Kiln-facing name is "Restorer").
export const TYPE_DISPLAY: Record<MetabolicType, string> = {
  Burner: "Burner",
  Rebounder: "Rebounder",
  Ember: "Restorer",
  Chameleon: "Chameleon",
  Explorer: "Explorer",
};

// RES-139: interim goal / strength / weakness copy per type. Confirm final
// wording with Alex before launch — this is the single place to edit it.
export const PROFILE_COPY: Record<
  MetabolicType,
  { goal: string; strength: string; weakness: string }
> = {
  Burner: {
    goal: "Keep your afternoons steady — protein-forward meals head off the stress crash.",
    strength: "Drive",
    weakness: "Crashes",
  },
  Rebounder: {
    goal: "Eat enough, consistently. Your metabolism rebuilds when it feels safe.",
    strength: "Resilience",
    weakness: "Restriction",
  },
  Ember: {
    goal: "Focus on consistent eating habits — your body does best when it's nourished, not restricted.",
    strength: "Consistency",
    weakness: "Recovery",
  },
  Chameleon: {
    goal: "Time meals to your rhythm — work with your cycle, not against it.",
    strength: "Adaptability",
    weakness: "Consistency",
  },
  Explorer: {
    goal: "Keep a balanced baseline and check in daily so I can learn your pattern fast.",
    strength: "Adaptability",
    weakness: "Quiet signals",
  },
};

// RES-139: the "Your goal" card reflects the user's actual onboarding goal
// answer (layer1.goal slug from onboardingSurvey.ts), in Ester's voice. Falls
// back to the per-type PROFILE_COPY.goal when no goal is stored. Single place to
// edit this wording.
export const GOAL_COPY: Record<string, string> = {
  weight_loss:
    "Lose weight in a way that lasts — I'll keep your meals satisfying so the change actually sticks.",
  training:
    "Train with purpose — I'll time your meals to fuel the work and sharpen your recovery.",
  maintain_weight:
    "Hold your steady state — balanced, consistent meals to keep you right where you want to be.",
  understand_food_impact:
    "Tune into your body — I'll help you see how different foods really move your energy and recovery.",
};

// Concise, title-case display label for the user's stored goal — used as the
// "Your goal" sheet title. The onboarding labels are too long for a heading
// (e.g. understand_food_impact's full sentence), so these are the short forms.
export const GOAL_LABEL: Record<string, string> = {
  weight_loss: "Weight loss",
  training: "Training",
  maintain_weight: "Maintain weight",
  understand_food_impact: "Understanding food",
};

// "a" vs "an" for the "As a/an {Type}" headline.
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

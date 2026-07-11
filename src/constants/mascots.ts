import type { MetabolicType } from "./colors";

// Per-type mascot hero art (the gradient logo that bleeds off a screen's
// top-left). Shared across the app-open greeting and the pre-scan weight screen.
// Ember's asset uses the "Restorer" name.
export const TYPE_MASCOT: Record<MetabolicType, ReturnType<typeof require>> = {
  Burner: require("../../assets/images/type-mascots/Burner.png"),
  Rebounder: require("../../assets/images/type-mascots/Rebounder.png"),
  Ember: require("../../assets/images/type-mascots/Restorer.png"),
  Chameleon: require("../../assets/images/type-mascots/Chameleon.png"),
  Explorer: require("../../assets/images/type-mascots/Explorer.png"),
};

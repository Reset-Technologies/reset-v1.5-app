// Studio Kiln Color Palette
export const K = {
  // Primary colors
  brown: "#361416",      // Primary dark. Text on light backgrounds. Buttons, headers.
  bone: "#F3EFE3",       // Warm neutral background. Card surfaces, inputs.
  white: "#FAFDFE",      // Clean background. Primary app background, card interiors.
  blue: "#92B4BD",       // Accent. Muted slate-blue. Secondary surfaces, signal cards.
  ochre: "#C8A128",      // Accent. Warm gold. CTAs, highlights, active states.

  // Semantic aliases for convenience
  text: "#361416",       // Primary text color (brown)
  textLight: "#F3EFE3",  // Text on dark backgrounds (bone)
  textMuted: "#6B5E5F",  // Muted text (derived from brown)
  background: "#FAFDFE", // Primary background (white)
  backgroundWarm: "#F3EFE3", // Secondary background (bone)
  border: "#E8E2D8",     // Border color (derived from bone)

  // Legacy mappings for backward compatibility during migration
  maroon: "#361416",     // → brown
  burgundy: "#4A1E20",   // → brown variant
  warmBlack: "#361416",  // → brown
  mustard: "#C8A128",    // → ochre
  mustardLight: "#D4B84A", // → ochre variant
  cream: "#F3EFE3",      // → bone
  warmGray: "#E8E2D8",   // → bone variant
  sub: "#6B5E5F",        // → textMuted
  faded: "#9E9490",      // → lighter muted
  ok: "#5A8A5E",         // Success green (keep for feedback)
  err: "#C45B5B",        // Error red (keep for feedback)
};

// Metabolic Type Colors - Studio Kiln palette applied
export type MetabolicType = "Burner" | "Rebounder" | "Ember" | "Chameleon" | "Explorer";

const METABOLIC_TYPES: readonly MetabolicType[] = [
  "Burner",
  "Rebounder",
  "Ember",
  "Chameleon",
  "Explorer",
];

// Coerce an unknown string (e.g. cached onboarding state or server response)
// into a valid MetabolicType, or null if it's missing/stale. Used by screens
// that render type-specific UI so a legacy value like "Defender" doesn't crash
// a TYPE_CONFIGS[metabolicType].title lookup.
export function toMetabolicType(s: string | null | undefined): MetabolicType | null {
  if (!s) return null;
  return (METABOLIC_TYPES as readonly string[]).includes(s) ? (s as MetabolicType) : null;
}

export const TC: Record<MetabolicType, { bg: string; text: string }> = {
  Burner: {
    bg: "#ce8751", // Terracotta — stress-driven, high energy
    text: K.brown,
  },
  Rebounder: {
    bg: "#a991b6", // Muted lavender — protective, steady
    text: K.brown,
  },
  Ember: {
    bg: K.blue,    // Slate blue (Restorer) — rebuilding, calm
    text: K.brown,
  },
  Chameleon: {
    bg: "#9DBC92", // Sage green — matches the Chameleon logo/mascot (was an
                   // earthy brown #8B7355 that clashed with the green logo)
    text: K.brown,
  },
  Explorer: {
    bg: "#ccbc60", // Saturated gold — adaptable, quiet signals
    text: K.brown,
  },
};

// Button color combinations per Full Nelson + Studio Kiln
export const ButtonColors = {
  primary: {
    background: K.brown,
    text: K.bone,
    border: K.brown,
  },
  secondary: {
    background: K.ochre,
    text: K.brown,
    border: K.ochre,
  },
  ghost: {
    background: "transparent",
    text: K.brown,
    border: K.brown,
  },
  disabled: {
    background: K.border,
    text: K.faded,
    border: K.border,
  },
};

// Card color combinations
export const CardColors = {
  default: {
    background: K.white,
    text: K.brown,
    border: K.border,
  },
  warm: {
    background: K.bone,
    text: K.brown,
    border: K.border,
  },
  accent: {
    background: K.blue,
    text: K.brown,
    border: K.blue,
  },
  highlight: {
    background: K.ochre,
    text: K.brown,
    border: K.ochre,
  },
  dark: {
    background: K.brown,
    text: K.bone,
    border: K.brown,
  },
};

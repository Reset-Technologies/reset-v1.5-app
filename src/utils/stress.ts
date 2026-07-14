// Stress is presented as a wellness signal, never as a diagnostic reading.
//
// ShenAI's `stressIndex` is a Baevsky-style index that runs ~0.5–4+ on phone
// scans (NOT a 0–10 or 0–100 scale — see reference notes + the RES-121
// reset-score normalizeSignal comment: "3 isn't the max, just elevated").
// Showing the raw number to users is both meaningless (we round 0.5–4 to a
// tiny integer) and reads as a medical measurement, which Apple flags under
// Guideline 1.4.1. Instead we bucket it into a qualitative wellness band.
//
// The label users see is "Stress Balance" — it keeps the user's mental model
// while staying in the general-wellness framing (no "Index", no diagnostic
// terminology). The underlying stressIndex is still stored/scored; we simply
// never surface the raw value.

export const STRESS_LABEL = "Stress Balance";

export type StressBand = "Calm" | "Balanced" | "Elevated";

// Anchored to the real ~0.5–4+ phone-scan range. `>= 3` is elevated (not the
// ceiling); below ~1.5 reads as calm.
const STRESS_BALANCED_MIN = 1.5;
const STRESS_ELEVATED_MIN = 3;

/**
 * Bucket a raw Baevsky stressIndex into a wellness band word.
 * Pass the UN-rounded value when available for accurate bucketing.
 * Returns null when there's no value yet.
 */
export function stressBand(stressIndex: number | null | undefined): StressBand | null {
  if (stressIndex == null || !Number.isFinite(stressIndex)) return null;
  if (stressIndex >= STRESS_ELEVATED_MIN) return "Elevated";
  if (stressIndex >= STRESS_BALANCED_MIN) return "Balanced";
  return "Calm";
}

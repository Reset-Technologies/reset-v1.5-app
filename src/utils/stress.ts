// Stress is presented as a wellness signal, never as a diagnostic reading.
//
// 🔴 ShenAI's `stressIndex` runs 0–10 on phone scans. This file said ~0.5–4+
// for months and the bands were built on that, which is why `>= 3 = Elevated`
// was showing "Elevated" to about two thirds of everyone who scanned.
// Settled from production on 2026-10-07 — 159 scans, integer values:
//   0:1  1:16  2:36  3:48  4:29  5:16  6:8  7:4  10:1     median 3
// Showing the raw number to users is both meaningless and reads as a medical
// measurement, which Apple flags under
// Guideline 1.4.1. Instead we bucket it into a qualitative wellness band.
//
// The label users see is "Stress Balance" — it keeps the user's mental model
// while staying in the general-wellness framing (no "Index", no diagnostic
// terminology). The underlying stressIndex is still stored/scored; we simply
// never surface the raw value.

export const STRESS_LABEL = "Stress Balance";

export type StressBand = "Calm" | "Balanced" | "Elevated";

// Anchored to the real 0–10 range and to the production distribution above,
// not to a remembered scale.
//
// 🔑 `Elevated` starts above 5, which is deliberately the SAME cutoff the
// backend uses for "high" (`labelStress`, deployed 2026-10-07) and the SAME one
// Bryan's SCAN RULES uses to let a scan corroborate Burner. All three had
// drifted onto different scales; that disagreement is what produced the 67%.
// Keep them equal — if one moves, move the others in the same change.
//
// Share of real scans: Calm 33% · Balanced 58% · Elevated 8%.
const STRESS_BALANCED_MIN = 3;
const STRESS_ELEVATED_MIN = 6;

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

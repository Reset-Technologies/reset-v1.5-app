import { apiClient } from "./apiClient";

/**
 * Proof-of-listening reflections — Screen Copy row 8 (`reflection.R1-R5`),
 * status LOCKED, "Use the Reflections tab verbatim."
 *
 * Source: Bryan's fixed-V1 handoff workbook
 * `15Am9duM425lSR_S99lzHZCMCTylKztZEFhYo206iKbY`, tab gid 1728784243,
 * supplied 2026-10-01. Ship verbatim; these are not ours to reword.
 *
 * 🔴 The same tab carries R6–R8 and A1–A3 directly beneath these, every one
 * marked "V2 ONLY. Do not show in fixed V1" / "Fixed V1 never extends".
 * They are deliberately NOT here. Do not add them.
 *
 * 🔑 None of these lines changes scores.
 */
export type ProvisionalLeader =
  | "Burner"
  | "Rebounder"
  | "Ember"
  | "Chameleon"
  | "Explorer";

export const REFLECTIONS: Record<ProvisionalLeader, string> = {
  // R1
  Burner: "Got it. Your day isn't hard from the start; it gets harder as it goes.",
  // R2
  Rebounder:
    "Okay. You can get results. The hard part is what happens once you've been doing it for a while.",
  // R3 — keyed by the INTERNAL archetype; Ember is displayed as Restorer.
  Ember: "Got it. You're running out of gas before the day is done.",
  // R4
  Chameleon: "Okay. The same plan can feel different in a pattern you recognize.",
  // R5
  Explorer:
    "Got it. Nothing is blowing up; it just never seems to settle into a rhythm.",
};

/**
 * Which reflection to show, from the "provisional answer leader" after the
 * three scored behaviour questions.
 *
 * 🔑 Scored on the BACKEND on purpose. `computeBehaviorScores` is not a lookup
 * table — q1 `variable_days` branches on q3, and q3 `first_attempt` zeroes
 * Rebounder — so a second copy here would drift silently the moment the
 * weights are retuned and pick a line that disagrees with the Type the member
 * is later told they are.
 *
 * Runs BEFORE the account exists, hence an unauthenticated route.
 */
export async function getProvisionalLeader(answers: {
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
}): Promise<ProvisionalLeader> {
  const res = await apiClient<{ leader: ProvisionalLeader }>(
    "/api/typing/provisional-leader",
    { method: "POST", body: JSON.stringify(answers) },
  );
  return res.leader;
}

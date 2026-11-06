// The one place that decides what a member's metabolic type is ON THE WIRE.
//
// Deliberately NOT in `services/braze.ts`: that module pulls in the Braze
// native SDK and the Expo bootstrap behind it, so nothing there can be
// executed outside a device. This file imports a single leaf constants module,
// which is what lets the branching below actually be run and checked.

import { toMetabolicType } from "../constants/colors";

/** The sentinel the typing function returns for the non-scanner path. */
export const STARTING_READ = "starting_read";

/**
 * The type properties every type-aware event carries, built once so the
 * paywall, the reveal and Home cannot drift apart.
 *
 * 🔴 WHY THIS IS NOT JUST `{ metabolic_type: x }`:
 * `state.user.metabolicType` is the RAW backend value, and one of the values
 * it holds is not a type at all — RES-121 stores the sentinel `starting_read`
 * for anyone who typed without a scan. Every SCREEN normalises that to
 * "Explorer" for display (TypeRevealScreen, HomeScreenV2), which is right for
 * copy and wrong for analytics: measured in production 2026-11-04,
 * `onboarding_type_reveal` reported Explorer for 293 of 387 reveals (76%),
 * and most of those members were never actually typed. A lifecycle campaign
 * segmenting on "Explorer" would be writing to a bucket that is three-
 * quarters people with no type.
 *
 * So: send the archetype only when there IS one, and always say whether this
 * is only a starting read.
 *
 * 🔑 `metabolic_type` is OMITTED rather than sent as null — `logEvent` only
 * accepts string/number/boolean, and Braze reads an explicit null as "unset",
 * which would wipe a type a later scan had already earned.
 *
 * Returns `{}` when the profile has not loaded yet: an unknown type is not the
 * same fact as a starting read, and guessing would poison the segment it is
 * meant to clean up.
 */
export function metabolicTypeProps(
  rawType: string | null | undefined,
  startingRead: boolean | null | undefined,
): { metabolic_type?: string; starting_read?: boolean } {
  // Checked FIRST, and via the canonical coercion, so a real archetype always
  // wins over a stale flag — and a legacy value like "Defender" is rejected
  // here exactly as it is in the screens.
  const archetype = toMetabolicType(rawType);
  if (archetype) return { metabolic_type: archetype, starting_read: false };
  if (startingRead === true || rawType === STARTING_READ) {
    return { starting_read: true };
  }
  return {};
}

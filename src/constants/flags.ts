/**
 * Build-time feature flags.
 *
 * 🔑 Constants, not remote config: this app has NO OTA channel, so a flag here
 * is flipped by a release either way. Its value is being a one-line kill switch
 * in a diff, not a runtime toggle.
 */

/**
 * Serve the adaptive question tree instead of the fixed six-question survey.
 *
 * The adaptive flow asks follow-ups based on what the member has already said —
 * Bryan's reason for wanting it is that Reset should feel like it is listening,
 * not that it reaches a confident Type faster.
 *
 * 🔴 Flipping this changes which component the `Survey` ROUTE renders. Every
 * `navigate("Survey")` call site is untouched, so turning it off is this one
 * line rather than four reverts.
 *
 * Requires reset-api `6ff216a` or later, which writes the Type from the
 * adaptive session and lets the Day 1 Deep Read quote adaptive answers. Against
 * an older backend a member would finish the flow untyped.
 */
export const ADAPTIVE_SURVEY_ENABLED = true;

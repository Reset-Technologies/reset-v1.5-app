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
 *
 * 🔴 OFF deliberately. Turning it on is a product decision, not a cleanup:
 *   1. The fixed V1 engine reached members on 2026-10-07. `typingDiagnostics`
 *      exists to compare the two on real signups and has barely any data yet;
 *      flipping this now replaces a days-old engine on no evidence and destroys
 *      the comparison that column was added for.
 *   2. There is NO OTA channel and no remote config, so turning it back off is
 *      another full release on both stores. There is no percentage rollout —
 *      this is 0% or 100%.
 *   3. Still unwalked on a device: the scan-present branch, the 9-question
 *      ambiguity-bridge path (reachable by a perfectly consistent member — only
 *      the 6-question path has ever been walked), and iOS entirely.
 *   4. Styling parity with `OnboardingSurveyScreen` is not done, and Lang's
 *      layout is canonical.
 * ▶ Revisit once real V1 signups have accrued diagnostics and 3 is closed.
 */
export const ADAPTIVE_SURVEY_ENABLED = false;

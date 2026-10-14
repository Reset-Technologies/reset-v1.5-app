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
 * ✅ ON. Bryan's call, Slack 2026-10-07, when Cole asked whether to wait for
 * the fixed engine's confidence data or just ship:
 *
 *   "The main reason I wanted it wasn't to get to a confident Type faster. It
 *    was to make the experience feel responsive to the person. If two people
 *    answer differently, I want Reset to ask them different follow-ups so it
 *    feels like we're actually listening. So even if the fixed six questions
 *    are enough technically, that doesn't really answer whether adaptive is
 *    worth it from a product experience standpoint. Since it's built, I'd lean
 *    toward shipping it unless you're seeing a meaningful downside."
 *
 * 🔑 THAT SETS THE ACCEPTANCE CRITERION, and it is NOT the confidence gate.
 * It is whether two members who answer differently get asked different things.
 * Measured on a device: the server asks M7 where the fixed engine asks
 * M1/M6/M11, and a member whose answers stay ambiguous gets the bridge —
 * "I've got most of it. Two patterns are still close, so let me check one
 * thing." — then extra questions. That is the feature, and it works.
 *
 * The downside we owed him was named and then closed on 2026-10-15:
 *   - 600 scripted walks of the live tree showed the route depends almost
 *     entirely on ANSWER PATTERN: a perfectly consistent member clears at six
 *     100% of the time, while middle/last answers reach the extended path 100%
 *     of the time. The three device walks that "all cleared at six" were the
 *     one pattern that does.
 *   - The extended path was then WALKED on a device for the first time:
 *     U1 U2 P1 U3 reflection P2 M10 M5 D12 BRIDGE D13 M13 S5, nine diagnostic
 *     questions, and the progress rail's tail matched a formula that until then
 *     had never been seen on a screen.
 *   - The 10-QUESTION MAXIMUM was then walked too, by finding an answer pattern
 *     against the API and replaying it on the device by answer index: route
 *     U1 U2 U3 M5 S5 D12 D13 M13 M8 M6, no deviation, session completing at the
 *     cap rather than running on. The whole rail is now observed and matches —
 *     12.9 / 24.9 / 37.8 / 49.9 / 62.8 / 74.8 / 80.7 / 85.7 / 91.7 / 97.7
 *     against 12.5 / 25 / 37.5 / 50 / 62.5 / 75 / 80.6 / 86.3 / 91.9 / 97.5.
 *     That replay also proved the UI renders answers in the API's exact order.
 *
 * 🔴 STILL NOT WALKED, and worth knowing when something looks wrong in the
 * wild: the extended path on ANDROID (every extended walk has been the iOS
 * simulator), and scan-present variety — STRESS_HIGH and LOW_WELLNESS exist
 * only as backend fixtures, so only NO_TYPING_SCAN_SIGNAL has had a real scan.
 *
 * 🔴 NO OTA, NO REMOTE CONFIG, NO PERCENTAGE ROLLOUT. This is 0% or 100% and
 * turning it back off is another full release on both stores. That has not
 * changed and is the reason this stays one line.
 */
export const ADAPTIVE_SURVEY_ENABLED = true;

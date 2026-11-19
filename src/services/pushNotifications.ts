let Braze: any;
try {
  Braze = require("@braze/react-native-sdk").default;
} catch {
  Braze = null;
}

/**
 * Request push notification permission via Braze SDK.
 * Braze handles the iOS permission prompt, token registration,
 * and foreground display natively via enableBrazeIosPush.
 * Do NOT use expo-notifications for push — it conflicts with Braze's native handling.
 * Gracefully no-ops when native module is unavailable.
 *
 * 🔴 NOTHING IN THE APP CALLS THIS ANY MORE, ON PURPOSE (2026-11-19). The ask
 * belongs to Grafted's Braze push primer now — see the note below. Kept
 * exported because it is the hook a custom primer button would need if we ever
 * stop letting Braze's native in-app message handle it.
 */
export function requestPushPermission(): void {
  if (!Braze) return;
  Braze.requestPushPermission({
    alert: true,
    badge: true,
    sound: true,
  });
}

/**
 * 🔴 `maybePrimePushOnce()` WAS REMOVED HERE ON 2026-11-19, along with the
 * `@reset_push_primed` flag and the `requestPushPermission()` call that ran on
 * every session restore in AppContext.
 *
 * Why: we were firing the OS permission dialog cold, with no explanation, and
 * iOS only ever shows it ONCE — so a member who declined a prompt they did not
 * understand could never be asked again. Grafted's Braze **push primer** is the
 * soft ask that now precedes it; its button triggers the OS prompt natively,
 * which is why no JS call is needed (there is no custom in-app message handler
 * in this app, so Braze's native SDK renders and handles the primer).
 *
 * ⚠️⚠️ SEQUENCING, AND IT IS NOT OPTIONAL: with this removed, **nothing in the
 * app asks for push permission at all.** If the primer campaign is not LIVE in
 * Braze when this build ships, push opt-ins go to zero for every new member and
 * nothing surfaces it. Confirm the campaign is live — not drafted — before
 * releasing.
 *
 * 🔑 Token registration is unaffected: `plugins/withRegisterPush.js` calls
 * `UIApplication.shared.registerForRemoteNotifications()` in AppDelegate at
 * launch, and Braze's FCM registration on Android is independent of
 * POST_NOTIFICATIONS. Removing the prompt does not cost us tokens for members
 * who already granted.
 */

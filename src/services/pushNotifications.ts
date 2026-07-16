import AsyncStorage from "@react-native-async-storage/async-storage";

let Braze: any;
try {
  Braze = require("@braze/react-native-sdk").default;
} catch {
  Braze = null;
}

// RES-188 — we no longer fire the push prompt at signup (it stacked with the
// AI-consent screen). Instead we prime it once, after the user has reached the
// home experience and seen their first meal card. This flag ensures it only
// ever fires once.
const PUSH_PRIMED_KEY = "@reset_push_primed";

/**
 * Request push notification permission via Braze SDK.
 * Braze handles the iOS permission prompt, token registration,
 * and foreground display natively via enableBrazeIosPush.
 * Do NOT use expo-notifications for push — it conflicts with Braze's native handling.
 * Gracefully no-ops when native module is unavailable.
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
 * RES-188 — request push permission at most once, ever. Called when the user
 * first lands on the home experience (after their first meal card) so we don't
 * stack the OS prompt on top of the AI-consent screen at signup. A no-op after
 * the first call, and if the native module is unavailable.
 */
export async function maybePrimePushOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(PUSH_PRIMED_KEY)) return;
    await AsyncStorage.setItem(PUSH_PRIMED_KEY, "1");
    requestPushPermission();
  } catch {
    // Best-effort; a storage failure just means we may prompt again later.
  }
}

import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * One place that decides whether Google Sign-In is usable, and configures it.
 *
 * This block previously lived — identically — in AccountGateScreen, LoginScreen
 * and AccountScreen, each hard-coding `Platform.OS === "android"`. Enabling iOS
 * therefore meant making the same edit three times and getting it right three
 * times, so it is extracted here instead.
 *
 * ## Why iOS was excluded, and what actually gates it now
 * The original comment says importing the module on iOS "crashes in Expo Go".
 * The real constraint is that the native iOS SDK needs an iOS OAuth client and
 * a matching URL scheme baked in at prebuild. Until that client exists there is
 * nothing to sign in against, so we gate on the id being configured rather than
 * on the platform. With it unset, iOS behaves exactly as it does today —
 * Apple only — rather than showing a button that cannot work.
 */
const iosClientId: string =
  (Constants.expoConfig?.extra as any)?.googleIosClientId ?? "";

const webClientId: string =
  (Constants.expoConfig?.extra as any)?.googleWebClientId ?? "";

const supported = Platform.OS === "android" || Boolean(iosClientId);

/** The configured SDK, or null when Google sign-in is not available here. */
export const GoogleSignin: any = supported
  ? require("@react-native-google-signin/google-signin").GoogleSignin
  : null;

if (GoogleSignin) {
  GoogleSignin.configure({
    webClientId,
    // Only meaningful on iOS; harmless on Android.
    ...(iosClientId ? { iosClientId } : {}),
  });
}

/** Whether to render a "Continue with Google" button on this device. */
export const isGoogleSignInAvailable = Boolean(GoogleSignin);

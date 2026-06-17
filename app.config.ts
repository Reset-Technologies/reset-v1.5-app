import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "reset-app",
  slug: "reset-app",
  scheme: "resetapp",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-reset.png",
    resizeMode: "contain",
    backgroundColor: "#361416",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.betterwell.reset.dev",
    // usesAppleSignIn: true, // TODO: re-enable once added to paid dev team
    entitlements: {
      "aps-environment": "production",
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSMicrophoneUsageDescription:
        "Reset uses your microphone for voice conversations with Ester.",
      NSSpeechRecognitionUsageDescription:
        "Reset uses speech recognition to transcribe what you say to Ester.",
      NSPhotoLibraryUsageDescription:
        "Reset may request photo access if you choose to share or upload images.",
      UIBackgroundModes: ["voip", "audio", "remote-notification"],
    },
  },
  android: {
    package: "com.betterwell.reset.dev",
    permissions: ["RECORD_AUDIO"],
    adaptiveIcon: {
      backgroundColor: "#F3EFE3",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-font",
    "expo-video",
    "expo-audio",
    [
      // ShenAI SDK requires Android minSdk 26. app.config's android.minSdkVersion
      // is not a real Expo field (it was silently ignored, so prebuild fell back
      // to the SDK default of 24 and the manifest merge failed). Set it the
      // canonical way via build properties.
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
        },
      },
    ],
    // "expo-apple-authentication", // TODO: re-enable once added to paid dev team
    [
      "expo-camera",
      {
        cameraPermission:
          "Reset uses your camera to read biometric signals from your face.",
      },
    ],
    [
      "@braze/expo-plugin",
      {
        iosApiKey: "c2b31d10-6583-4a51-9a08-6ef896be9e2c",
        androidApiKey: "b4300a40-f8e5-4eca-baeb-eefacfe15901",
        baseUrl: "sdk.iad-07.braze.com",
        enableBrazeIosPush: true,
        enableFirebaseCloudMessaging: false,
      },
    ],
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "Reset uses your microphone so you can talk to Ester instead of typing.",
        speechRecognitionPermission:
          "Reset uses speech recognition to transcribe what you say to Ester.",
      },
    ],
    "./plugins/withRegisterPush",
    // Wires Twilio Voice's VoiceApplicationProxy into the Android Application
    // lifecycle — without it the app crashes on launch (null JSEventEmitter).
    "./plugins/withTwilioVoiceAndroid",
    // Enables modular headers for GoogleUtilities/RecaptchaInterop so the Swift pod
    // AppCheckCore can be integrated as a static library (broke after adding
    // expo-image's SDWebImage stack). See plugins/withModularHeaders.js.
    "./plugins/withModularHeaders",
  ],
  extra: {
    shenAiApiKey: process.env.SHEN_AI_API_KEY ?? "",
    apiBaseUrl: process.env.API_BASE_URL ?? "",
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? "",
    // RevenueCat public SDK keys (platform-specific). Safe to ship in the
    // bundle — these are the *public* client keys, not a secret key — so they
    // live here as defaults (same as the Braze keys above), overridable via
    // env. Both platforms point at the same RevenueCat project (same `pro`
    // entitlement + webhook). Android's offering stays empty until the Play
    // subscriptions are created (gated on the Play payments profile), so the
    // paywall falls back to static prices on Android until then.
    revenueCatIosApiKey:
      process.env.REVENUECAT_IOS_API_KEY ?? "appl_fFSqzbabmCIEVvADlYAwdtHxhMv",
    revenueCatAndroidApiKey:
      process.env.REVENUECAT_ANDROID_API_KEY ??
      "goog_BlNBidaCymvrJlRtCgTeutCmrAu",
    eas: {
      projectId: "e1576fd6-3519-4c0f-95e8-abf43df86a02",
    },
  },
});

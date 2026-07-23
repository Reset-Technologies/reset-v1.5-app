import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "reset-app",
  slug: "reset-app",
  scheme: "resetapp",
  // Ships as a new version of the EXISTING App Store record ("Reset: Lasting
  // Weight Loss", Apple ID 1478144712), whose 4.5-star / 2000+ reviews cannot
  // be transferred to another record. That app is live at 2.1.11, so the
  // marketing version has to climb past it — 3.0.0 marks the rebrand.
  version: "3.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-reset.png",
    resizeMode: "contain",
    backgroundColor: "#361416",
  },
  ios: {
    // The legacy App Store record we're migrating onto is a UNIVERSAL app, and
    // iPad is ~54% of its activity (72% of updates). Shipping iPhone-only would
    // letterbox the app to ~23% of an iPad screen for the majority of the
    // existing base, and risks review rejection for dropping a supported
    // device. See app.config.ts history / the migration notes.
    supportsTablet: true,
    // Must match the target App Store record exactly — this is what routes the
    // build to Apple ID 1478144712 and keeps its existing ratings and reviews.
    // The previous `.dev`-suffixed id belonged to a separate, never-released
    // record (6760977260), which is retained only as a fallback.
    bundleIdentifier: "com.betterwell.reset",
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
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: "com.betterwell.reset.dev",
    permissions: ["RECORD_AUDIO"],
    adaptiveIcon: {
      backgroundColor: "#F1EDE1",
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
    [
      // Disable background playback so expo-audio does NOT add the `audio`
      // UIBackgroundModes entry. Ester's TTS plays only in the foreground, and
      // Apple rejected the app (Guideline 2.5.4) for declaring background audio
      // without a persistent background-audio feature. Also drops the unneeded
      // Android FOREGROUND_SERVICE_MEDIA_PLAYBACK permission + playback service.
      "expo-audio",
      { enableBackgroundPlayback: false },
    ],
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
    // Enables modular headers for GoogleUtilities/RecaptchaInterop so the Swift pod
    // AppCheckCore can be integrated as a static library (broke after adding
    // expo-image's SDWebImage stack). See plugins/withModularHeaders.js.
    "./plugins/withModularHeaders",
    // Strips unused `audio`/`voip` UIBackgroundModes from the final plist
    // (Apple Guideline 2.5.4). Runs last as a safety net. See the plugin file.
    "./plugins/withCleanBackgroundModes",
  ],
  extra: {
    shenAiApiKey: process.env.SHEN_AI_API_KEY ?? "",
    apiBaseUrl: process.env.API_BASE_URL ?? "",
    googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? "",
    // Build-time flag that reveals the Settings > EXPERIMENTAL section on
    // ANDROID internal/testing builds. Android can't tell an internal-testing
    // install from a production install at runtime, so the internal EAS
    // profile sets SHOW_EXPERIMENTS=true and the public build leaves it unset
    // (→ false). iOS ignores this and uses the App Store receipt instead
    // (see modules/build-env). Defaults to false so a build is private unless
    // it explicitly opts in.
    showExperiments: process.env.SHOW_EXPERIMENTS === "true",
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

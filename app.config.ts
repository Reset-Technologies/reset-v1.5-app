import { ExpoConfig, ConfigContext } from "expo/config";
import * as fs from "fs";

// Android FCM (Braze push) is only wired when a google-services.json exists —
// via the GOOGLE_SERVICES_JSON env (EAS builds) or a local ./google-services.json.
// Until then the whole Firebase apply is inert (enableFirebaseCloudMessaging off,
// no googleServicesFile, google-services Gradle plugin skipped), so dev prebuilds
// keep working before Firebase is set up. See plugins/withAndroidGoogleServices.js
// + RES-199. The file's package_name must match android.package at build time.
const GOOGLE_SERVICES_FILE =
  process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
const HAS_GOOGLE_SERVICES = fs.existsSync(GOOGLE_SERVICES_FILE);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // The HOME SCREEN name — what sits under the icon on the device. It was
  // "reset-app", the scaffold's working title, which is what shipped in 3.0.0.
  // The store listing name is a separate field in App Store Connect / Play
  // ("Reset: Lasting Weight Loss") and is unaffected; the two are allowed to
  // differ, and a short home-screen name is the norm.
  name: "Reset",
  // ⚠️ `slug` and `scheme` deliberately KEEP the old value.
  //   * slug identifies the EAS project (alongside extra.eas.projectId) —
  //     renaming it risks detaching the project and its build credentials.
  //   * scheme is the deep-link protocol (resetapp://). Changing it breaks
  //     every link already in the wild, including OAuth redirects.
  // Neither is ever shown to a user, so there is nothing to gain by touching
  // them and a working build to lose.
  slug: "reset-app",
  scheme: "resetapp",
  // Ships as a new version of the EXISTING App Store record ("Reset: Lasting
  // Weight Loss", Apple ID 1478144712), whose 4.5-star / 2000+ reviews cannot
  // be transferred to another record. That app is live at 2.1.11, so the
  // marketing version has to climb past it — 3.0.0 marks the rebrand.
  // 🔴 Must be HIGHER than any version already released. 3.0.0 went live on
  // both stores 2026-09-01, and App Store Connect will not accept a new build
  // for a version that is already "Ready for Sale" — the update needs its own
  // version record. 3.0.1 is the first post-launch patch: app display name,
  // the "Restorer" greeting fix, the Amplitude SDK, the legacy-member
  // analytics tag, and a working support contact.
  version: "3.0.1",
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
    // Mirrors the iOS migration: ships onto the LEGACY Google Play listing
    // `com.betterwell.reset` (BetterWell's original app, 4.5-star / 2000+
    // reviews) so the ratings carry over, instead of the throwaway
    // `.dev`-suffixed package that was only ever on an internal track. The
    // build must be signed with the upload key Google has registered for this
    // package (see the Android migration notes) or Play rejects the upload.
    package: "com.betterwell.reset",
    // POST_NOTIFICATIONS is the Android 13+ runtime push permission; Braze's
    // requestPushPermission() drives the OS prompt. Safe to declare always.
    permissions: ["RECORD_AUDIO", "POST_NOTIFICATIONS"],
    // Strip broad storage / media / overlay permissions that transitive SDK
    // manifests merge in. Reset has NO photo-library picker or file-upload
    // feature, so these are unused — blocking them keeps the Play listing's
    // permission list clean and avoids tripping Google's Photo & Video
    // Permissions policy (which otherwise demands a use-case declaration for
    // READ_MEDIA_IMAGES). CAMERA (face scan) + RECORD_AUDIO (voice) stay.
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
    // Copied to android/app/google-services.json at prebuild so the
    // google-services Gradle plugin (withAndroidGoogleServices) can read it.
    // Only set when the file exists, so builds without Firebase don't fail.
    ...(HAS_GOOGLE_SERVICES
      ? { googleServicesFile: GOOGLE_SERVICES_FILE }
      : {}),
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
        // Android push via FCM. Gated on google-services.json being present so
        // that, without Firebase set up, the firebase-messaging dep + braze.xml
        // FCM flag aren't added and behavior is byte-for-byte the old off state.
        enableFirebaseCloudMessaging: HAS_GOOGLE_SERVICES,
        // FCM sender ID = the Firebase/GCP project NUMBER. reset-fb706
        // (34987581161) already hosts Google Sign-In, so FCM lives there too.
        // Override per-env with FCM_SENDER_ID.
        firebaseCloudMessagingSenderId:
          process.env.FCM_SENDER_ID ?? "34987581161",
        // Let Braze open a deep link embedded in a push payload (e.g.
        // resetapp://weekly-review) natively, with no custom JS handler.
        androidHandlePushDeepLinksAutomatically: true,
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
    // Applies the Firebase google-services Gradle plugin so Braze can register
    // for FCM. Inert until a google-services.json is present. See RES-199.
    "./plugins/withAndroidGoogleServices",
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
    // Amplitude client-side analytics. This is the PUBLIC ingestion key — it
    // ships in the bundle by design, exactly like the Braze keys above and the
    // RevenueCat public keys below — so it lives here as a default rather than
    // only in an EAS secret. That is deliberate: the SDK fails SILENTLY when the
    // key is missing, so a forgotten env var would look identical to working
    // analytics. Overridable via AMPLITUDE_API_KEY.
    // 📌 Verified against Amplitude 2026-08-25: this key is live and the project
    // is on the US endpoint (api2.amplitude.com). An EU project would need
    // api.eu.amplitude.com, and sending EU data to the US endpoint fails quietly.
    // ⚠️ Shipping this SDK changes what the app collects, so the App Store
    // privacy labels must be updated in the same submission.
    amplitudeApiKey:
      process.env.AMPLITUDE_API_KEY ?? "846e3b4ec7b0c669809a505831d22cb1",
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

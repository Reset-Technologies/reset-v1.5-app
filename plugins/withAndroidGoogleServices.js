const {
  withProjectBuildGradle,
  withAppBuildGradle,
} = require("expo/config-plugins");
const fs = require("fs");

/**
 * Config plugin that wires the Firebase `com.google.gms.google-services` Gradle
 * plugin so Braze can register for FCM (Android push).
 *
 * The @braze/expo-plugin adds the `firebase-messaging` dependency and the
 * braze.xml FCM flags, but it does NOT apply the google-services Gradle plugin
 * or ship a google-services.json — and modern firebase-messaging (23.x) needs a
 * real initialized FirebaseApp, so both are required.
 *
 * This is deliberately INERT until a google-services.json is present (either the
 * GOOGLE_SERVICES_JSON env — used by EAS builds — or a local ./google-services.json).
 * Without it we skip the Gradle wiring entirely, so dev prebuilds keep working
 * before Firebase is set up. `android.googleServicesFile` in app.config.ts copies
 * the file into android/app/ at prebuild; this plugin applies the plugin that reads it.
 *
 * See RES-199. Pair with enableFirebaseCloudMessaging + firebaseCloudMessagingSenderId
 * in the @braze/expo-plugin block.
 */
const GOOGLE_SERVICES_VERSION = "4.4.2";
const CLASSPATH = `classpath('com.google.gms:google-services:${GOOGLE_SERVICES_VERSION}')`;
const APPLY_PLUGIN = `apply plugin: 'com.google.gms.google-services'`;

function googleServicesPresent() {
  const file = process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";
  return fs.existsSync(file);
}

module.exports = function withAndroidGoogleServices(config) {
  if (!googleServicesPresent()) {
    console.warn(
      "[withAndroidGoogleServices] No google-services.json (set GOOGLE_SERVICES_JSON or add ./google-services.json). " +
        "Skipping Firebase/FCM Gradle wiring — Android push stays inert until it is provided.",
    );
    return config;
  }

  // 1) Add the google-services classpath to the project-level buildscript.
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (!cfg.modResults.contents.includes("com.google.gms:google-services")) {
      // Insert into the first (buildscript) `dependencies {` block.
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n        ${CLASSPATH}`,
      );
    }
    return cfg;
  });

  // 2) Apply the plugin at the app level (must come after the RN/Expo plugins).
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    if (!cfg.modResults.contents.includes(APPLY_PLUGIN)) {
      cfg.modResults.contents = `${cfg.modResults.contents}\n${APPLY_PLUGIN}\n`;
    }
    return cfg;
  });

  return config;
};

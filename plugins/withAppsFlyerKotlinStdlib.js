const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Pin the Kotlin stdlib that react-native-appsflyer compiles against to the one
 * React Native actually ships, instead of the newer one it asks for.
 *
 * 🔴 THE BUG THIS FIXES (caught by a local `assembleDebug`, not by CI or tsc):
 * react-native-appsflyer 7.0.2's android/build.gradle declares
 *
 *     implementation "org.jetbrains.kotlin:kotlin-stdlib:${safeExtGet('kotlin_stdlib_version', '2.4.10')}"
 *
 * React Native 0.83 pins the Kotlin toolchain at 2.1.20
 * (node_modules/react-native/gradle/libs.versions.toml). Gradle then hands a
 * 2.1.20 compiler a 2.4.10 stdlib whose metadata it cannot read:
 *
 *     kotlin-stdlib-2.4.10.jar ... The binary version of its metadata is 2.4.0,
 *     expected version is 2.1.0.
 *
 * Every stdlib symbol goes unresolved (`mapOf`, `to`, `setOf`, `takeIf`, even
 * `it`), and the compiler dies with `Internal compiler error` /
 * `IllegalArgumentException: source must not be null`. The surfaced message
 * names AppsFlyer's own source file, which reads like a broken package — it
 * isn't, it is a version conflict, and the whole Android build fails.
 *
 * The fix is the escape hatch AppsFlyer left: `safeExtGet` reads
 * `rootProject.ext`, so defining `kotlin_stdlib_version` there wins. We set it
 * to RN's own Kotlin version, so the stdlib matches the compiler by
 * construction rather than by coincidence.
 *
 * ⚠️ Do NOT "fix" this by raising the project's Kotlin to 2.4.x instead. RN
 * 0.83 pins 2.1.20 and every other native module is compiled against it; moving
 * the toolchain to satisfy one dependency changes the blast radius from one
 * package to all of them.
 *
 * 📌 Delete this plugin when react-native-appsflyer's default stdlib is <= the
 * Kotlin version React Native ships (check line ~88 of its android/build.gradle
 * after any upgrade). Leaving it in place is harmless — it only ever pins to
 * whatever RN already uses.
 */

// Must track node_modules/react-native/gradle/libs.versions.toml → `kotlin`.
const KOTLIN_VERSION = "2.1.20";
const EXT_LINE = `ext.kotlin_stdlib_version = "${KOTLIN_VERSION}"`;

module.exports = function withAppsFlyerKotlinStdlib(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "[withAppsFlyerKotlinStdlib] Expected a Groovy android/build.gradle; " +
          "got " +
          cfg.modResults.language +
          ". The Kotlin stdlib pin was NOT applied and the Android build will " +
          "fail in react-native-appsflyer's Kotlin compile.",
      );
    }
    if (cfg.modResults.contents.includes("ext.kotlin_stdlib_version")) {
      return cfg;
    }
    // Prepend, so it is set before any subproject's build.gradle is evaluated.
    cfg.modResults.contents = `${EXT_LINE}\n\n${cfg.modResults.contents}`;
    return cfg;
  });
};

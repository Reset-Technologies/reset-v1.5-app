const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// The Swift pod `AppCheckCore` (pulled in transitively via GoogleSignIn) depends on
// `GoogleUtilities` and `RecaptchaInterop`, which do not define modules. Under static
// linkage CocoaPods refuses to integrate AppCheckCore unless those deps generate
// module maps. Adding `expo-image` (and its SDWebImage stack) tipped the Podfile into
// this state, breaking `pod install` on EAS with:
//   "The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and `RecaptchaInterop`,
//    which do not define modules. ... set `:modular_headers => true`"
// Enable modular headers for just those transitive pods — the targeted fix the error
// recommends — rather than a global `use_modular_headers!` that would override Expo's
// own per-pod modular-header selection.
const MODULAR_PODS = ["GoogleUtilities", "RecaptchaInterop", "AppCheckCore"];
const MARKER = "# @generated-modular-headers (withModularHeaders)";

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes(MARKER)) {
        const block =
          `  ${MARKER}\n` +
          MODULAR_PODS.map(
            (p) => `  pod '${p}', :modular_headers => true`
          ).join("\n") +
          "\n";
        // Insert just inside the app target block (first `target '...' do`).
        contents = contents.replace(
          /(^target ['"][^'"]+['"] do\n)/m,
          `$1${block}`
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};

const { withInfoPlist } = require("expo/config-plugins");

// Apple rejected the app under Guideline 2.5.4 because the built Info.plist
// declared the `audio` (and a stale `voip`) UIBackgroundModes, but the app has
// no persistent background-audio feature — Ester's TTS plays only in the
// foreground. `expo-audio`'s config plugin injects `audio` whenever
// enableBackgroundPlayback is on (its default); we disable that option in
// app.config.ts, and this plugin runs last as a belt-and-suspenders guarantee
// that no unused background mode survives into the final plist regardless of
// plugin ordering or leftover state from a previous prebuild.
//
// We keep only the modes the app actually uses (remote-notification for push).
const DISALLOWED = ["audio", "voip"];

module.exports = function withCleanBackgroundModes(config) {
  return withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      cfg.modResults.UIBackgroundModes = modes.filter(
        (m) => !DISALLOWED.includes(m)
      );
    }
    return cfg;
  });
};

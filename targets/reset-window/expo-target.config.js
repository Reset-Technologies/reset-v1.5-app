// The Reset Window Live Activity (lock screen + Dynamic Island).
// Generated into the Xcode project by @bacons/apple-targets at prebuild; the
// app starts/updates it through modules/reset-live-activity.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "widget",
  name: "ResetWindowWidget",
  displayName: "Reset Window",
  // → com.betterwell.reset.resetwindow
  bundleIdentifier: ".resetwindow",
  // Live Activities with ActivityContent / staleDate need iOS 16.2.
  deploymentTarget: "16.2",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"],
});

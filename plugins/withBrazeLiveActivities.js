const { withAppDelegate } = require("expo/config-plugins");

/**
 * Live Activity phase 2 — lets the SERVER start the Reset Window Live Activity
 * with the app closed, through Braze push-to-start.
 *
 * Phase 1 only works while the app is open (modules/reset-live-activity), so a
 * member who never opens Reset that evening sees nothing on the lock screen.
 * Braze needs three things from the app, all native — the RN SDK exposes no
 * JS API for Live Activities:
 *   1. a push-to-start registration for our attributes type, whose `name` must
 *      equal the `activity_attributes_type` the backend sends;
 *   2. `resumeActivities` on each launch so pushed activities stay addressable;
 *   3. `BrazeLiveActivityAttributes` conformance (the `brazeActivityId` field).
 *
 * 🔑 The Braze instance belongs to @braze/expo-plugin's own app-delegate
 * subscriber, which builds it from Info.plist during didFinishLaunching. We
 * must use THAT instance — a second one would double-count sessions — so this
 * reads it back through the ObjC runtime (`BrazeReactUtils.braze`) rather than
 * importing a pod header that may not be bridged, and retries briefly in case
 * our code runs before the subscriber.
 *
 * Silent-failure note: if the type name here and in the backend ever drift, the
 * push is accepted by Braze and simply nothing appears on the phone.
 */
const MARKER = "ResetWindowPushToStart";

module.exports = function withBrazeLiveActivities(config) {
  return withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    // 1. Imports. BrazeKit for the SDK types, ResetLiveActivity for the shared
    //    attributes struct the module starts activities with.
    //    Prepended rather than anchored to an existing import: the generated
    //    AppDelegate's imports change between Expo versions, and a missed
    //    anchor here fails SILENTLY — the plugin reports success and ships a
    //    binary that never registers for push-to-start.
    contents = `import ActivityKit\nimport BrazeKit\ninternal import ResetLiveActivity\n${contents}`;

    // 2. Kick the registration off after didFinishLaunching returns, so Braze's
    //    own subscriber has created the instance first.
    contents = contents.replace(
      /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
      `if #available(iOS 17.2, *) {\n      DispatchQueue.main.async { ${MARKER}.register() }\n    }\n    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`,
    );

    // 3. The helper itself.
    contents += `

// MARK: - Reset Window Live Activity (phase 2, server-driven)
// Added by plugins/withBrazeLiveActivities.js — edit it there, not here:
// ios/ is generated and this file is overwritten on every prebuild.

/// Braze matches a pushed activity to the app by this exact string, and the
/// backend sends it as \`activity_attributes_type\`. Keep the two in step.
let resetWindowActivityType = "ResetWindowAttributes"

@available(iOS 17.2, *)
enum ${MARKER} {
  /// registerPushToStart returns a Task that must be retained, or the observer
  /// is torn down immediately and no token is ever sent. resumeActivities
  /// returns Void.
  private static var pushToStart: Task<Void, Never>?

  static func register(attempt: Int = 0) {
    guard let braze = brazeInstance() else {
      // The Braze subscriber has not run yet; try again shortly.
      guard attempt < 5 else { return }
      DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
        register(attempt: attempt + 1)
      }
      return
    }

    pushToStart = braze.liveActivities.registerPushToStart(
      forType: Activity<ResetWindowAttributes>.self,
      name: resetWindowActivityType
    )
    braze.liveActivities.resumeActivities(
      ofType: Activity<ResetWindowAttributes>.self
    )
  }

  /// The instance @braze/expo-plugin created, read through the ObjC runtime so
  /// this compiles whether or not the pod's headers are bridged into Swift.
  private static func brazeInstance() -> Braze? {
    guard let cls = NSClassFromString("BrazeReactUtils") else { return nil }
    let selector = NSSelectorFromString("braze")
    guard cls.responds(to: selector) else { return nil }
    return (cls as AnyObject).perform(selector)?.takeUnretainedValue() as? Braze
  }
}

/// Braze requires the attributes type to carry \`brazeActivityId\`; the property
/// lives on the shared struct, this declares the conformance.
@available(iOS 16.1, *)
extension ResetWindowAttributes: BrazeLiveActivityAttributes {}
`;

    config.modResults.contents = contents;
    return config;
  });
};

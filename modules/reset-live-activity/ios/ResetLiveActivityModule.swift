import ActivityKit
import ExpoModulesCore

// Starts, updates and ends the one Reset Window Live Activity. The widget that
// draws it is targets/reset-window.
//
// Phase 1 is app-driven (no push): JS calls `sync` whenever the Window state
// changes, and the activity carries a staleDate so the lock screen flips on its
// own — at the Reset start for an "eating" activity, at the eating-window open
// for a "reset" one. Apple caps an activity at 8h active + 4h on the lock
// screen, so Phase 2 (server pushes via Braze) is what covers a full Reset.
public class ResetLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ResetLiveActivity")

    Function("isSupported") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // Returns "started" | "updated" | "unchanged" | "disabled" | "unavailable" | "failed".
    AsyncFunction("sync") {
      (phase: String, startAtMs: Double, openAtMs: Double, windowLabel: String) async -> String in
      guard #available(iOS 16.2, *) else { return "unavailable" }
      let state = ResetWindowAttributes.ContentState(
        phase: phase,
        startAt: Date(timeIntervalSince1970: startAtMs / 1000),
        openAt: Date(timeIntervalSince1970: openAtMs / 1000),
        windowLabel: windowLabel
      )
      return await ResetLiveActivityController.sync(state)
    }

    AsyncFunction("end") { () async -> Void in
      guard #available(iOS 16.2, *) else { return }
      await ResetLiveActivityController.endAll()
    }
  }
}

@available(iOS 16.2, *)
enum ResetLiveActivityController {
  static func sync(_ state: ResetWindowAttributes.ContentState) async -> String {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "disabled" }

    // "eating" goes stale at the Reset start (the widget then draws the Reset);
    // "reset" goes stale when the eating window opens.
    let staleDate = state.phase == "eating" ? state.startAt : state.openAt
    let content = ActivityContent(state: state, staleDate: staleDate)

    // Only activities still on screen count. One the system already ended
    // (the 8-hour cap) is replaced rather than updated.
    let live = Activity<ResetWindowAttributes>.activities.filter {
      $0.activityState == .active || $0.activityState == .stale
    }
    if let current = live.first {
      for extra in live.dropFirst() {
        await extra.end(nil, dismissalPolicy: .immediate)
      }
      if current.content.state == state && current.activityState == .active {
        return "unchanged"
      }
      await current.update(content)
      return "updated"
    }

    do {
      _ = try Activity.request(
        attributes: ResetWindowAttributes(),
        content: content,
        pushType: nil
      )
      return "started"
    } catch {
      return "failed"
    }
  }

  static func endAll() async {
    for activity in Activity<ResetWindowAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}

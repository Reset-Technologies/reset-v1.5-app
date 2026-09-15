import ActivityKit
import Foundation

// ⚠️ KEEP IDENTICAL to modules/reset-live-activity/ios/ResetWindowAttributes.swift.
// The module that starts the activity is a separate pod and can't see this
// file — each side needs its own copy. ActivityKit pairs this widget with
// those activities by the type's name and its Codable shape, so the two copies
// must match field for field.
@available(iOS 16.1, *)
struct ResetWindowAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// "eating" — counting down to the next Reset; "reset" — a Reset is running.
    var phase: String
    /// The Reset's start: scheduled for "eating", actual for "reset".
    var startAt: Date
    /// When the eating window opens.
    var openAt: Date
    /// The member's Window, e.g. "14:10".
    var windowLabel: String
  }
}

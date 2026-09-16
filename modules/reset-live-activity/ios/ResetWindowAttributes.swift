import ActivityKit
import Foundation

// ⚠️ KEEP IDENTICAL to targets/reset-window/ResetWindowAttributes.swift.
// This module is a separate pod, so it can't see files in the widget target —
// each side needs its own copy.
// ActivityKit pairs the widget with those activities by the type's name and its
// Codable shape, so the two copies must match field for field.
//
// 🔑 The times are EPOCH MILLISECONDS, not `Date`. The server starts and updates
// these through Braze push, and iOS decodes that payload with a plain
// JSONDecoder — a `Date` field would expect Apple's reference-date number and
// silently fail to decode, leaving the activity blank.
@available(iOS 16.1, *)
public struct ResetWindowAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// "eating" — counting down to the next Reset; "reset" — a Reset is running.
    public var phase: String
    /// The Reset's start: scheduled for "eating", actual for "reset".
    public var startAtMs: Double
    /// When the eating window opens.
    public var openAtMs: Double
    /// The member's Window, e.g. "14:10".
    public var windowLabel: String

    /// Computed, so they are not part of the encoded shape.
    public var startAt: Date { Date(timeIntervalSince1970: startAtMs / 1000) }
    public var openAt: Date { Date(timeIntervalSince1970: openAtMs / 1000) }

    public init(phase: String, startAtMs: Double, openAtMs: Double, windowLabel: String) {
      self.phase = phase
      self.startAtMs = startAtMs
      self.openAtMs = openAtMs
      self.windowLabel = windowLabel
    }
  }

  /// Required by Braze so a pushed activity can be updated or ended later. Nil
  /// for activities the app starts itself.
  public var brazeActivityId: String?

  public init(brazeActivityId: String? = nil) {
    self.brazeActivityId = brazeActivityId
  }
}

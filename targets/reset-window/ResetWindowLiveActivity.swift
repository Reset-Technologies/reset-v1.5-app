import ActivityKit
import SwiftUI
import WidgetKit

// The Reset Window on the lock screen and in the Dynamic Island.
//
// Phase 1 is app-driven: the app starts or updates this activity and gives it
// a staleDate, and the widget redraws itself when that date passes — so the
// lock screen "flips" at the Reset start without a push. Timers use
// `Text(date, style: .timer)`, which counts down to the date and then counts
// up past it, so the seconds keep moving with no updates at all.
//
// Layout mirrors the Today card (ResetWindowCard) in the evening palette until
// Lang designs this surface.

// src/components/resetWindow/palette.ts (evening) + constants/colors.ts.
private enum Palette {
  static let background = Color(red: 0x2A / 255, green: 0x0E / 255, blue: 0x10 / 255)
  static let text = Color(red: 0xF3 / 255, green: 0xEF / 255, blue: 0xE3 / 255)
  static let textAlt = Color(red: 0xB8 / 255, green: 0xA7 / 255, blue: 0xA8 / 255)
  static let accent = Color(red: 0x92 / 255, green: 0xB4 / 255, blue: 0xBD / 255)
}

/// What to draw, from the content the app sent plus whether it has gone stale.
private struct Display {
  enum Kind {
    case countdown  // eating window open, Reset coming up
    case reset      // Reset running
    case open       // the Reset finished; eating window open
  }

  let state: ResetWindowAttributes.ContentState
  let kind: Kind

  init(_ state: ResetWindowAttributes.ContentState, isStale: Bool) {
    self.state = state
    switch (state.phase, isStale) {
    case ("eating", false): kind = .countdown
    case ("eating", true), ("reset", false): kind = .reset
    default: kind = .open
    }
  }

  var title: String {
    switch kind {
    case .countdown, .open: return "Eating Window Open"
    case .reset: return "You’re in your Reset"
    }
  }

  var timerCaption: String {
    kind == .countdown ? "until your Reset" : "in your Reset"
  }

  var subtitle: String {
    switch kind {
    case .countdown: return "Your Reset starts at \(clock(state.startAt))"
    case .reset: return "Eating window opens at \(clock(state.openAt))"
    case .open: return "Your Reset is complete."
    }
  }

  var symbol: String {
    kind == .reset ? "moon.fill" : "fork.knife"
  }
}

private func clock(_ date: Date) -> String {
  let formatter = DateFormatter()
  formatter.dateFormat = "h:mma"
  formatter.amSymbol = "am"
  formatter.pmSymbol = "pm"
  return formatter.string(from: date)
}

struct ResetWindowLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ResetWindowAttributes.self) { context in
      LockScreenView(display: Display(context.state, isStale: context.isStale))
        .activityBackgroundTint(Palette.background)
        .activitySystemActionForegroundColor(Palette.text)
    } dynamicIsland: { context in
      let display = Display(context.state, isStale: context.isStale)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          // The expanded island's corners are strongly rounded; without inset
          // the first/last letters of these labels were clipped on an iPhone
          // 16 Pro ("14:10 Windo", and the bottom line lost its "E").
          Label(display.kind == .reset ? "Reset" : "Eating", systemImage: display.symbol)
            .font(.caption.weight(.medium))
            .foregroundStyle(Palette.accent)
            .padding(.leading, 8)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text("\(display.state.windowLabel) Window")
            .font(.caption.weight(.medium))
            .foregroundStyle(Palette.textAlt)
            .lineLimit(1)
            .padding(.trailing, 8)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            if display.kind != .open {
              HStack(alignment: .firstTextBaseline, spacing: 6) {
                TimerText(display: display)
                  .font(.system(size: 28, weight: .semibold, design: .rounded))
                Text(display.timerCaption)
                  .font(.caption)
                  .foregroundStyle(Palette.textAlt)
              }
            }
            if display.kind == .reset {
              ResetProgress(state: display.state)
            }
            Text(display.subtitle)
              .font(.caption)
              .foregroundStyle(Palette.textAlt)
          }
          .padding(.horizontal, 8)
        }
      } compactLeading: {
        Image(systemName: display.symbol)
          .foregroundStyle(Palette.accent)
      } compactTrailing: {
        if display.kind == .open {
          Text("Open").font(.caption2).foregroundStyle(Palette.text)
        } else {
          TimerText(display: display)
            .font(.caption2.weight(.semibold))
            .frame(maxWidth: 52)
        }
      } minimal: {
        Image(systemName: display.symbol)
          .foregroundStyle(Palette.accent)
      }
      .widgetURL(URL(string: "resetapp://"))
      .keylineTint(Palette.accent)
    }
  }
}

private struct LockScreenView: View {
  let display: Display

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text(display.title)
          .font(.headline)
          .foregroundStyle(Palette.text)
        Spacer()
        Text("\(display.state.windowLabel) Window")
          .font(.caption.weight(.medium))
          .foregroundStyle(Palette.textAlt)
      }

      if display.kind != .open {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          TimerText(display: display)
            .font(.system(size: 34, weight: .semibold, design: .rounded))
          Text(display.timerCaption)
            .font(.subheadline)
            .foregroundStyle(Palette.textAlt)
        }
      }

      if display.kind == .reset {
        ResetProgress(state: display.state)
      }

      Text(display.subtitle)
        .font(.subheadline)
        .foregroundStyle(Palette.textAlt)
    }
    .padding(16)
  }
}

/// A running clock ("2:35:12"): down to the Reset start while counting down,
/// up from it during the Reset.
///
/// `Text(date, style: .timer)` rendered as spelled-out words on the lock screen
/// ("2 hours, 35 m…", truncated) on the iOS 26 simulator, so this uses the
/// explicit timer-interval form, which always formats as a clock. After the
/// start passes, the activity goes stale, the widget redraws as `.reset`, and
/// the count-up takes over.
private struct TimerText: View {
  let display: Display

  var body: some View {
    let now = Date()
    let counting = display.kind == .countdown && display.state.startAt > now
    Text(
      timerInterval: counting
        ? now...display.state.startAt
        : display.state.startAt...Date.distantFuture,
      countsDown: counting
    )
    .monospacedDigit()
    .foregroundStyle(Palette.text)
    .multilineTextAlignment(.leading)
  }
}

/// Fills from the Reset start to the eating-window open on the system clock.
private struct ResetProgress: View {
  let state: ResetWindowAttributes.ContentState

  var body: some View {
    ProgressView(
      timerInterval: state.startAt...max(state.openAt, state.startAt.addingTimeInterval(60)),
      countsDown: false,
      label: { EmptyView() },
      currentValueLabel: { EmptyView() }
    )
    .tint(Palette.accent)
  }
}

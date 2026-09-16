import type {
  EarnedAchievement,
  PayoffCopyId,
  WeeklyUpdate,
} from "../services/resetWindow";

// Presentation helpers for Reset Window. Rules and copy come from the Reset
// Window Product + Engineering Handoff v1.0 (ESTER COPY / FLIP + PAYOFF sheets);
// copy IDs are kept next to each string so copy can change without logic.

const MINUTE_MS = 60_000;

/** The picker presets. 12:12 is offered only on a Rebounder's on-ramp. */
export const WINDOW_PRESETS = [
  { durationMin: 840, label: "14:10" },
  { durationMin: 900, label: "15:9" },
  { durationMin: 960, label: "16:8" },
  { durationMin: 1080, label: "18:6" },
] as const;
export const REBOUNDER_ONRAMP = { durationMin: 720, label: "12:12" } as const;

/** "14:10" for whole hours; "14h 30m" when the fast has minutes. */
export function windowLabel(durationMin: number): string {
  const fastH = Math.floor(durationMin / 60);
  const fastM = durationMin % 60;
  if (fastM === 0) return `${fastH}:${24 - fastH}`;
  return `${fastH}h ${fastM}m`;
}

/** "14 hours and 12 minutes" — the Morning Payoff's {duration}. */
export function durationWords(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = `${h} ${h === 1 ? "hour" : "hours"}`;
  if (m === 0) return hours;
  const mins = `${m} ${m === 1 ? "minute" : "minutes"}`;
  return h === 0 ? mins : `${hours} and ${mins}`;
}

/** "14h 12m" — compact duration for stats. */
export function durationShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** HH:MM for a span of milliseconds — the timer face. */
export function clockFace(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MINUTE_MS));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "Today, 9:33pm" / "Tomorrow, 2:33pm" / "Yesterday, 9:33pm" / "Sep 12, 8:00pm". */
export function relativeDayTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  // iOS separates "PM" with a narrow no-break space (U+202F), not a plain
  // space, so strip any whitespace to get the design's "9:33pm".
  const time = d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s+/g, "")
    .toLowerCase();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : days === -1
          ? "Yesterday"
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

/** "8:00pm" from "20:00". */
export function localTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * Reset Stages — narrative thirds of the required elapsed time (FLIP + PAYOFF
 * sheet, "Reset stages"). No physiological claim; Extended is deferred because
 * auto-complete leaves no live post-target state.
 */
export function resetStage(fraction: number): "Winding down" | "Settling" | "Deep Reset" {
  if (fraction < 1 / 3) return "Winding down";
  if (fraction < 2 / 3) return "Settling";
  return "Deep Reset";
}

// ESTER COPY sheet.
export const COPY = {
  W_START_14: "I’d start you at 14:10. You choose where it fits in your day.",
  W_START_RB:
    "I’d start you at 12:12 for two weeks. You choose where it fits in your day. Then I’ll see whether 14:10 makes sense.",
  W_OVERRIDE_01: (window: string) => `Works. I’ll use ${window} and learn from how it fits.`,
  W_FLIP_01: "Okay. Your Reset starts now.",
  W_ACTIVE_01: (timeLeft: string, openTime: string) =>
    `${timeLeft} left. Your eating window opens at ${openTime}.`,
  W_SHIFT_01: (openTime: string) =>
    `Got it. I moved tonight’s Reset to start now. Your eating window opens at ${openTime}.`,
  W_EARLY_01: "Got it. Your eating window is open.",
  W_HOLD_01:
    "I’ve paused your Window while you’re away. We’ll pick it back up when you’re ready.",
  W_RESUME_01:
    "You’re back. I’m keeping the Window where it was while I get a few clean days again.",
  W_ADJUSTED_01: "Updated.",

  // Weekly Window decisions (ESTER COPY, WEEKLY DECISION tab).
  W_HOLD_02: (window: string) =>
    `Your Window is fitting well. I’m keeping it at ${window} this week.`,
  W_HOLD_03: (window: string) => `I’m keeping your Window at ${window} this week.`,
  W_GATHER_01: (window: string) =>
    `I don’t have enough clean evidence to change your Window yet. I’m keeping ${window} this week.`,
  W_LENGTHEN_01: (window: string, newWindow: string) =>
    `You’ve been holding ${window} well. I want to test one small timing change: ${newWindow} this week.`,
  W_SHORTEN_01: (newWindow: string) =>
    `This Window is creating too much friction. I’d bring it back to ${newWindow} this week.`,
  W_TIMING_01: (newStart: string, window: string) =>
    `Your Reset keeps starting later than the schedule. I’d move it to ${newStart} and keep the same ${window}.`,
  W_RB_RAMP_01:
    "Two weeks in, and this Window has been fitting well. I’d move you to 14:10.",
  W_RB_HOLD_01:
    "I’m keeping 12:12 for now. I want a cleaner read before I make it longer.",

  // Not in the copy library: the Easy / Fine / Rough question and its thanks.
  W_DIFFICULTY_01: "How did that Reset feel?",
  W_DIFFICULTY_THANKS: "Thanks — that helps me fit your Window.",
} as const;

/**
 * Ester's line and buttons for a weekly Window decision (ESTER COPY). An offer
 * has two buttons — accept first — and a note has one, "Continue".
 */
export function weeklyUpdateCopy(update: WeeklyUpdate): {
  line: string;
  accept: string;
  decline: string | null;
} {
  const window = windowLabel(update.oldDurationMin);
  const newWindow = windowLabel(update.newDurationMin ?? update.oldDurationMin);
  const keep = { accept: `Use ${newWindow}`, decline: `Keep ${window}` };
  const note = { accept: "Continue", decline: null };
  switch (update.copyId) {
    case "W_LENGTHEN_01":
      return { line: COPY.W_LENGTHEN_01(window, newWindow), ...keep };
    case "W_SHORTEN_01":
      return { line: COPY.W_SHORTEN_01(newWindow), ...keep };
    case "W_RB_RAMP_01":
      return { line: COPY.W_RB_RAMP_01, ...keep };
    case "W_TIMING_01":
      return {
        line: COPY.W_TIMING_01(
          localTimeLabel(update.newStartLocalTime ?? update.oldStartLocalTime),
          window,
        ),
        accept: "Move it",
        decline: "Keep current time",
      };
    case "W_HOLD_01":
      return { line: COPY.W_HOLD_01, ...note };
    case "W_RESUME_01":
      return { line: COPY.W_RESUME_01, ...note };
    case "W_HOLD_02":
      return { line: COPY.W_HOLD_02(window), ...note };
    case "W_GATHER_01":
      return { line: COPY.W_GATHER_01(window), ...note };
    case "W_RB_HOLD_01":
      return { line: COPY.W_RB_HOLD_01, ...note };
    default:
      return { line: COPY.W_HOLD_03(window), ...note };
  }
}

/** "1,248h" — whole hours for lifetime totals. */
export function hoursTotal(minutes: number): string {
  return `${Math.floor(minutes / 60).toLocaleString("en-US")}h`;
}

export function payoffLine(
  copyId: PayoffCopyId,
  durationMin: number,
  streak: number,
): string {
  const base = `You reset for ${durationWords(durationMin)}.`;
  switch (copyId) {
    case "W_PAYOFF_02":
      return `${base} That’s ${streak} in a row.`;
    case "W_PAYOFF_03":
      return `${base} Your longest one yet.`;
    default:
      // W_PAYOFF_01 and the short-Reset W_PAYOFF_04 share the same truth; the
      // streak change on a short night stays quiet.
      return base;
  }
}

/**
 * The label for a badge. PLACEHOLDER COPY — the handoff puts achievement copy
 * and art outside the core logic ("copy/art external to core logic"), and Lang
 * hasn't designed these yet.
 */
export function achievementLabel(achievement: EarnedAchievement): string {
  const n = achievement.metricValue;
  switch (achievement.family) {
    case "completed":
      return n === 1 ? "First Reset" : `${thresholdOf(achievement)} Resets`;
    case "streak":
      return `${thresholdOf(achievement)} in a row`;
    default:
      return `${thresholdOf(achievement)}-hour Reset`;
  }
}

/** The trigger this badge is for, read back from its id. */
function thresholdOf(achievement: EarnedAchievement): number {
  const match = achievement.id.match(/(\d+)/);
  return match ? Number(match[1]) : achievement.metricValue;
}

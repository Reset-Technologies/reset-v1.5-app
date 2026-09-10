import type { PayoffCopyId } from "../services/resetWindow";

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
} as const;

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

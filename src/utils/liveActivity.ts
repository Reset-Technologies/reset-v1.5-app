import { Platform } from "react-native";

import {
  endLiveActivity,
  syncLiveActivity,
  type LiveActivityContent,
} from "../../modules/reset-live-activity";
import { logEvent } from "../services/braze";
import { reportLiveActivity, type WindowState } from "../services/resetWindow";
import { windowLabel } from "./resetWindow";

/**
 * How close the next Reset must be before the lock screen shows a countdown.
 *
 * Apple ends a Live Activity 8 hours after it starts (it can stay on the lock
 * screen up to 4 hours more), so every hour of countdown is an hour less of
 * the Reset itself. At 3 hours the Flip still lands with 5 hours of the Reset
 * active and about 9 visible. Phase 2's server pushes remove this trade-off.
 */
export const EATING_LEAD_MIN = 180;

/**
 * The Live Activity the lock screen should show for this Window state, or null
 * for none: a countdown when the next Reset is close, the Reset while one is
 * running, and nothing on hold, before a Window is set, or once a Reset ended
 * early and the next one is still hours away.
 */
export function liveActivityFor(
  state: WindowState,
  now: number = Date.now(),
): LiveActivityContent | null {
  const plan = state.plan;
  if (!plan) return null;
  const label = windowLabel(plan.assignedDurationMin);

  const active = state.activeInstance;
  if ((state.status === "RESET_ACTIVE" || state.status === "RESET_SHIFTED") && active) {
    return {
      phase: "reset",
      startAt: new Date(active.actualStartAt),
      openAt: new Date(active.scheduledOpenAt),
      windowLabel: label,
    };
  }

  if (state.status === "EATING_OPEN" && state.nextScheduledStartAt) {
    const startAt = new Date(state.nextScheduledStartAt);
    if (startAt.getTime() - now > EATING_LEAD_MIN * 60_000) return null;
    return {
      phase: "eating",
      startAt,
      // Display only: the server's scheduledOpenAt accounts for DST, but no
      // instance exists yet, and a countdown only shows the start time.
      openAt: new Date(startAt.getTime() + plan.assignedDurationMin * 60_000),
      windowLabel: label,
    };
  }

  return null;
}

// The last content sent this session. The Window refreshes on every focus and
// foreground; re-sending unchanged content would also undo a member swiping
// the activity away, so only a real change reaches the lock screen.
let lastSent: string | null = null;

function keyOf(content: LiveActivityContent | null): string {
  if (!content) return "none";
  return [
    content.phase,
    content.startAt.getTime(),
    content.openAt.getTime(),
    content.windowLabel,
  ].join("|");
}

/** Brings the Live Activity in line with the Window state. */
export async function syncWindowLiveActivity(state: WindowState): Promise<void> {
  const content = liveActivityFor(state);
  const key = keyOf(content);
  if (key === lastSent) return;
  lastSent = key;

  const result = await syncLiveActivity(content);
  if (result === "started" || result === "updated") {
    logEvent(`live_activity_${result}`, { phase: content?.phase ?? "none" });
  }

  // Claim the lock screen with the server, or its scheduler will push a second
  // card onto it. Keyed by the night, not by the time shown: a late shift or a
  // "tonight only" move changes the time but never the night's identity.
  //
  // 🔑 iOS only, because only iOS has a server-driven card to collide with:
  // Braze's Live Activity API is an ActivityKit feature. Claiming on Android
  // would write `source: 'app'` rows the scheduler can never act on. Revisit
  // if the server ever drives the Android card too.
  if (result === "started" && content && Platform.OS === "ios") {
    const opportunityAt =
      content.phase === "reset"
        ? state.activeInstance?.opportunityAt
        : state.nextOpportunityAt ?? null;
    if (opportunityAt) {
      reportLiveActivity(opportunityAt, content.phase).catch(() => {
        // Best effort: a missed claim costs a duplicate card, never a crash.
      });
    }
  }
}

/** Sign-out / account switch: the next member starts with a clean lock screen. */
export function clearWindowLiveActivity(): void {
  lastSent = null;
  endLiveActivity();
}

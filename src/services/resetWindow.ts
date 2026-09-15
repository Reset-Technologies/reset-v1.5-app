import { apiClient } from "./apiClient";

// Mirrors reset-api `ResetWindowService` (src/reset-window). The server derives
// every state from the member's plan + timestamps on each read, so the app never
// has to be open for a Reset to start or complete — it just asks.

export type WindowStatus =
  | "UNASSIGNED"
  | "EATING_OPEN"
  | "RESET_ACTIVE"
  | "RESET_SHIFTED"
  | "HOLD";

export type PayoffCopyId =
  | "W_PAYOFF_01"
  | "W_PAYOFF_02"
  | "W_PAYOFF_03"
  | "W_PAYOFF_04";

export type WindowDifficulty = "easy" | "fine" | "rough";

export interface WindowInstance {
  id: string;
  localDate: string;
  scheduledStartAt: string;
  scheduledOpenAt: string;
  requiredElapsedMin: number;
  actualStartAt: string;
  actualEndAt: string | null;
  actualDurationMin: number | null;
  lateShift: boolean;
  earlyEnd: boolean;
  completion: boolean | null;
  flipShown: boolean;
  difficulty: WindowDifficulty | null;
}

export interface WindowPlan {
  planVersionId: string;
  assignedDurationMin: number;
  eatingMin: number;
  startLocalTime: string; // HH:MM
  openLocalTime: string; // HH:MM
  timezone: string;
  source: "ester_recommendation" | "user_override" | "user_edit";
  effectiveAt: string;
}

export interface WindowProgress {
  currentStreak: number;
  longestStreak: number;
  completedResets: number;
  totalFastingMin: number;
  longestResetMin: number | null;
  sevenDayAvgMin: number | null;
  // Actual fasting minutes in the last 30 local days vs the 30 before.
  last30DaysFastingMin: number;
  prior30DaysFastingMin: number;
}

export type RecommendationAction =
  | "hold"
  | "gather"
  | "change_timing"
  | "shorten"
  | "lengthen"
  | "safety_ease";

/** A weekly Window decision: an offer to accept or decline, or a note shown once. */
export interface WeeklyUpdate {
  id: string;
  action: RecommendationAction;
  reasonCode: string;
  copyId: string;
  needsDecision: boolean;
  oldDurationMin: number;
  newDurationMin: number | null;
  oldStartLocalTime: string;
  newStartLocalTime: string | null;
  decidedAt: string;
}

export interface WindowState {
  status: WindowStatus;
  recommendation: {
    durationMin: number;
    copyId: "W_START_14" | "W_START_RB";
  } | null;
  plan: WindowPlan | null;
  activeInstance: WindowInstance | null;
  nextScheduledStartAt: string | null;
  // The next Reset has been moved "tonight only".
  nextResetRescheduled: boolean;
  pendingPayoff: (WindowInstance & {
    copyId: PayoffCopyId;
    currentStreak: number;
    // Ask Easy / Fine / Rough with this Payoff (the server keeps the weekly budget).
    askDifficulty: boolean;
  }) | null;
  progress: WindowProgress;
  weeklyUpdate: WeeklyUpdate | null;
}

export type WindowHistoryState = "complete" | "short" | "running" | "hold" | "none";

export interface WindowHistoryDay {
  date: string; // YYYY-MM-DD, the day the Reset started
  state: WindowHistoryState;
  instanceId: string | null;
  actualDurationMin: number | null;
  requiredElapsedMin: number | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
}

const BASE = "/api/reset-window";

export function getResetWindow(): Promise<WindowState> {
  return apiClient<WindowState>(BASE);
}

export function setWindowPlan(
  assignedDurationMin: number,
  startLocalTime: string,
): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/plan`, {
    method: "PUT",
    body: JSON.stringify({ assignedDurationMin, startLocalTime }),
  });
}

// Bodyless POSTs: apiClient omits Content-Type when there is no body, which
// Fastify requires (it 400s an empty body declared as JSON).
export function imEating(): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/im-eating`, { method: "POST" });
}

export function correctInstance(
  instanceId: string,
  times: { actualStartAt?: string; actualEndAt?: string },
): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/instances/${instanceId}`, {
    method: "PATCH",
    body: JSON.stringify(times),
  });
}

export function markFlipShown(instanceId: string): Promise<{ success: true }> {
  return apiClient(`${BASE}/instances/${instanceId}/flip-shown`, {
    method: "POST",
  });
}

export function markPayoffShown(instanceId: string): Promise<{ success: true }> {
  return apiClient(`${BASE}/instances/${instanceId}/payoff-shown`, {
    method: "POST",
  });
}

/** Showing the Easy / Fine / Rough question spends the weekly budget. */
export function markDifficultyPrompted(instanceId: string): Promise<{ success: true }> {
  return apiClient(`${BASE}/instances/${instanceId}/difficulty-prompted`, {
    method: "POST",
  });
}

export function setDifficulty(
  instanceId: string,
  response: WindowDifficulty,
): Promise<{ success: true }> {
  return apiClient(`${BASE}/instances/${instanceId}/difficulty`, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

export function startHold(reason?: string): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/hold`, {
    method: "POST",
    ...(reason ? { body: JSON.stringify({ reason }) } : {}),
  });
}

export function endHold(): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/resume`, { method: "POST" });
}

/** "Tonight only": move the next Reset's start without changing the plan. */
export function setNextReset(startAt: string): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/next-reset`, {
    method: "PUT",
    body: JSON.stringify({ startAt }),
  });
}

export function clearNextReset(): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/next-reset`, { method: "DELETE" });
}

export function getWindowHistory(
  days = 35,
): Promise<{ timezone: string; days: WindowHistoryDay[] }> {
  return apiClient(`${BASE}/history?days=${days}`);
}

export function requestLongerWindow(): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/recommendations/longer`, { method: "POST" });
}

export function markRecommendationSeen(id: string): Promise<{ success: true }> {
  return apiClient(`${BASE}/recommendations/${id}/seen`, { method: "POST" });
}

export function acceptRecommendation(id: string): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/recommendations/${id}/accept`, { method: "POST" });
}

export function declineRecommendation(id: string): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/recommendations/${id}/decline`, { method: "POST" });
}

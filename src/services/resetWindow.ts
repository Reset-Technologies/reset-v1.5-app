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
  pendingPayoff: (WindowInstance & {
    copyId: PayoffCopyId;
    currentStreak: number;
  }) | null;
  progress: WindowProgress;
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

export function startHold(reason?: string): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/hold`, {
    method: "POST",
    ...(reason ? { body: JSON.stringify({ reason }) } : {}),
  });
}

export function endHold(): Promise<WindowState> {
  return apiClient<WindowState>(`${BASE}/resume`, { method: "POST" });
}

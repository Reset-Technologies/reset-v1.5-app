import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  correctInstance,
  endHold,
  getResetWindow,
  imEating as postImEating,
  setWindowPlan,
  type WindowState,
} from "../services/resetWindow";

// setTimeout overflows (and fires immediately) past ~24.8 days.
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface ResetWindowController {
  state: WindowState | null;
  refresh: () => Promise<WindowState | null>;
  savePlan: (durationMin: number, startLocalTime: string) => Promise<WindowState>;
  imEating: () => Promise<WindowState>;
  correct: (
    instanceId: string,
    times: { actualStartAt?: string; actualEndAt?: string },
  ) => Promise<WindowState>;
  resume: () => Promise<WindowState>;
}

/**
 * Reset Window state for Today. The server is the source of truth — it starts
 * and completes Resets from the schedule whether or not the app is open — so
 * this only has to ask at the right moments: on focus, on returning to the
 * foreground, and at the next moment the state changes on its own (the
 * scheduled start, or the eating window opening).
 */
export function useResetWindow(): ResetWindowController {
  const [state, setState] = useState<WindowState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getResetWindow();
      setState(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (appState) => {
      if (appState === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const boundary =
      state?.activeInstance?.scheduledOpenAt ?? state?.nextScheduledStartAt;
    if (!boundary) return;
    // A beat after the boundary, so the server has crossed it too.
    const ms = new Date(boundary).getTime() - Date.now() + 1500;
    if (ms > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(refresh, Math.max(1000, ms));
    return () => clearTimeout(timer);
  }, [state, refresh]);

  const run = useCallback(async (action: () => Promise<WindowState>) => {
    const next = await action();
    setState(next);
    return next;
  }, []);

  return {
    state,
    refresh,
    savePlan: (durationMin, startLocalTime) =>
      run(() => setWindowPlan(durationMin, startLocalTime)),
    imEating: () => run(postImEating),
    correct: (instanceId, times) => run(() => correctInstance(instanceId, times)),
    resume: () => run(endHold),
  };
}

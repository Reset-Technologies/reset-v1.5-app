import { useCallback, useRef, useState } from "react";
import {
  answerTypingTree,
  rememberTypingTreeSession,
  startTypingTree,
  type TypingTreeStep,
} from "../services/typingTree";

/**
 * Session state machine for the adaptive onboarding typing tree.
 *
 * 🔑 THE SERVER DRIVES THE ROUTE. This hook holds the current step, submits an
 * answer, and holds whatever comes back. It never decides what to ask next,
 * never scores, and never reorders. That is what lets a routing correction ship
 * from the backend without a store release, and what keeps the spec's fixtures
 * the acceptance gate rather than a thing the client can quietly diverge from.
 *
 * ⚠️ Not wired into onboarding. The fixed `SURVEY_STEPS` flow is still live.
 */

/** From the generated tree config (`TREE_CONSTANTS`), mirrored for the bar. */
export const MIN_DIAGNOSTIC = 6;
export const MAX_DIAGNOSTIC = 10;

/**
 * 🔴 The adaptive flow has NO KNOWN LENGTH. The confidence gate clears
 * somewhere between 6 and 10 questions, and the client cannot know which until
 * the server says `complete`. The existing fixed survey divides by a step count
 * it has up front; that is not available here, and the naive substitutes are
 * all visibly wrong:
 *
 *   - `count / 10` stalls at 60% and then jumps to done for most members,
 *     because most clear at 6.
 *   - `count / 6` reaches 100% and then has to keep going, which is worse —
 *     a bar that fills and then asks another question reads as broken.
 *
 * So: fill most of the bar across the GUARANTEED first six, then creep through
 * the uncertain tail. It never goes backwards, never completes early, and never
 * stalls. `complete` is the only thing that reaches 1.
 */
export function treeProgress(diagnosticCount: number, complete: boolean): number {
  if (complete) return 1;
  const n = Math.max(0, Math.min(diagnosticCount, MAX_DIAGNOSTIC));
  const GUARANTEED_SHARE = 0.75;
  if (n <= MIN_DIAGNOSTIC) return (n / MIN_DIAGNOSTIC) * GUARANTEED_SHARE;
  const tail = (n - MIN_DIAGNOSTIC) / (MAX_DIAGNOSTIC - MIN_DIAGNOSTIC);
  return GUARANTEED_SHARE + tail * (1 - GUARANTEED_SHARE) * 0.9;
}

export interface TypingTreeState {
  step: TypingTreeStep | null;
  loading: boolean;
  /** Set when a call failed. The caller decides whether to retry or fall back. */
  error: unknown;
  progress: number;
}

export function useTypingTree() {
  const [step, setStep] = useState<TypingTreeStep | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // 🔴 Guards a double-submit. Two taps on an answer would post the same
  // questionId twice; the server replays the answer log on every request, so a
  // duplicate would land in `selectedAnswerIds` and perturb the scores the
  // confidence gate reads. A ref, not state — it has to be correct within the
  // same tick as the tap, before any re-render.
  const inFlight = useRef(false);

  const run = useCallback(
    async (fn: () => Promise<TypingTreeStep>): Promise<TypingTreeStep | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setLoading(true);
      setError(null);
      try {
        const next = await fn();
        setStep(next);
        return next;
      } catch (e) {
        // Surfaced, never swallowed: a dead typing session must not look like a
        // question with no answers.
        setError(e);
        return null;
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Open a session.
   *
   * 🔴 `hasScan` is not "do we have biomarkers". A SKIPPED scan routes
   * differently from a scan that ran and found no usable signal, so the caller
   * states which happened. Pass the SDK's `stressIndex` through untouched — it
   * is a 0-10 index and the server owns the thresholds.
   */
  const start = useCallback(
    async (input: {
      hasScan: boolean;
      stressIndex?: number | null;
      wellnessScore?: number | null;
    }) => {
      const next = await run(() => startTypingTree(input));
      // 🔴 Persist IMMEDIATELY. The member has no account yet, so this id is the
      // only thing that can bind these answers to them at signup — and signup
      // happens two screens later, after this component is gone.
      if (next?.sessionId) await rememberTypingTreeSession(next.sessionId);
      return next;
    },
    [run],
  );

  const answer = useCallback(
    (questionId: string, answerId: string) => {
      const sessionId = step?.sessionId;
      if (!sessionId) return Promise.resolve(null);
      return run(() => answerTypingTree({ sessionId, questionId, answerId }));
    },
    [run, step?.sessionId],
  );

  return {
    step,
    loading,
    error,
    progress: treeProgress(step?.diagnosticCount ?? 0, step?.complete ?? false),
    start,
    answer,
  };
}

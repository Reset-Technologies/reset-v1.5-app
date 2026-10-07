import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "./apiClient";

/**
 * Client for the adaptive onboarding typing tree (backend `typing-tree`).
 *
 * 🔑 THE SERVER DRIVES THE ROUTE. Every response carries the next question and
 * its answers; this client renders what it is given and never decides what to
 * ask. That is the whole point of the design — the routing rules, the
 * scan-conflict forcing and the confidence gate are the product, and keeping
 * them server-side means a routing correction ships without a store release.
 *
 * ⚠️ NOT wired into onboarding. The fixed six-question `SURVEY_STEPS` flow is
 * still the live path; this exists so the screens can be built against a real
 * contract. Nothing imports it yet.
 *
 * 🔴 Do NOT add scoring, ordering or "which question comes next" logic here.
 * The moment the client decides anything, the server stops being correctable
 * and the fixtures stop being the acceptance gate.
 */

/** One answer option, as the server ordered it. Render in `order`. */
export interface TypingTreeAnswer {
  id: string;
  text: string;
  order: number;
}

export interface TypingTreeQuestion {
  id: string;
  text: string;
  answers: TypingTreeAnswer[];
}

/**
 * Mirrors the backend's `NextStep`. Kept structurally identical on purpose —
 * if the server adds a field, add it here rather than reshaping it, so the two
 * can be diffed by eye.
 */
export interface TypingTreeStep {
  sessionId: string;
  complete: boolean;
  /** Present while the session is running. */
  question?: TypingTreeQuestion;
  /** Shown once, after U3. Never affects scores. */
  reflection?: { id: string; text: string };
  /** Shown once, if the flow extends past Q6. Never affects scores. */
  bridge?: { id: string; text: string };
  /** Scored questions asked so far — drives the progress bar, not the routing. */
  diagnosticCount: number;
  /** Populated only once `complete` is true. */
  outcome?: unknown;
}

/**
 * Open a session.
 *
 * 🔴 `hasScan` is REQUIRED and is not the same as "we have biomarkers". The
 * tree routes a skipped scan differently from a scan that ran and produced no
 * usable signal, so the client has to state which happened rather than letting
 * the server infer it from absent numbers.
 *
 * ⚠️ `stressIndex` is the raw ShenAI index on a **0-10** scale, not 0-100 and
 * not the 0.5-4 range some of our own app-side comments claim. Verified against
 * production 2026-10-06: 159 scans, values 0-10, max 10. Pass the SDK's number
 * through untouched and let the server threshold it — a client-side conversion
 * here is how a scale bug gets baked into typing.
 */
export async function startTypingTree(input: {
  hasScan: boolean;
  stressIndex?: number | null;
  wellnessScore?: number | null;
}): Promise<TypingTreeStep> {
  return apiClient("/api/typing-tree/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Submit one answer and get the next step. */
export async function answerTypingTree(input: {
  sessionId: string;
  questionId: string;
  answerId: string;
}): Promise<TypingTreeStep> {
  return apiClient("/api/typing-tree/answer", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** The most recent completed session's outcome, if there is one. */
export async function getTypingTreeResult(): Promise<TypingTreeStep | null> {
  return apiClient("/api/typing-tree/result", { method: "GET" });
}

/**
 * 🔑 THE SESSION ID IS THE CAPABILITY, so it has to outlive the screen.
 *
 * The tree starts before the member has an account, and the id is the only
 * thing that can bind those answers to them afterwards. It must survive leaving
 * the survey screen and backgrounding the app, so it is persisted rather than
 * held in component state. Losing it costs a restart, never a wrong Type.
 */
const PENDING_SESSION_KEY = "@reset_typing_tree_session";

export async function rememberTypingTreeSession(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_SESSION_KEY, sessionId);
  } catch {
    // Non-fatal. The member can still finish the tree in this session; only the
    // claim would be lost, and that degrades to being typed by the fixed engine.
  }
}

/** Bind an anonymously-completed session to the member who just signed up. */
export async function claimTypingTree(sessionId: string): Promise<unknown> {
  return apiClient("/api/typing-tree/claim", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

/**
 * Claim whatever anonymous session this device is holding, if any.
 *
 * 🔑 Called from `setAuth`, which is the ONE place every signup and login path
 * passes through. Six `setAuth` call sites already exist across three screens
 * (email, Google, Apple); claiming at each of them is how the seventh one
 * forgets. This is deliberately safe to call on every auth, including logins
 * that have no pending session.
 *
 * 🔴 Never throws and never blocks. A failed claim must not break signing in —
 * the member simply keeps the Type the fixed engine already gave them.
 */
export async function claimPendingTypingTreeSession(): Promise<void> {
  let sessionId: string | null = null;
  try {
    sessionId = await AsyncStorage.getItem(PENDING_SESSION_KEY);
  } catch {
    return;
  }
  if (!sessionId) return;
  try {
    await claimTypingTree(sessionId);
    // Cleared only on success. A transient failure leaves it to be retried on
    // the next auth rather than silently dropping the member's answers.
    await AsyncStorage.removeItem(PENDING_SESSION_KEY);
  } catch {
    // Swallowed on purpose — see above.
  }
}

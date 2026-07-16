import { apiClient } from "./apiClient";

// RES-188 — third-party-AI data-sharing consent (Apple 5.1.1(i)/5.1.2(i)).
// The app must capture explicit consent before any user data is sent to our AI
// partners (OpenAI for text, ElevenLabs for voice). The backend enforces this
// on every AI endpoint; this service reads/writes the decision.

export type AiConsentStatus = "granted" | "declined";

export interface AiConsentRecord {
  status: AiConsentStatus;
  decidedAt: string;
  copyVersion: string;
  providers: string[];
  dataCategories: string[];
}

export interface AiConsentState {
  /** The stored decision, or null if the user hasn't decided yet. */
  consent: AiConsentRecord | null;
  /** The current canonical disclosure the app should present. */
  current: {
    version: string;
    providers: string[];
    dataCategories: string[];
  };
  /** True when the app should show the consent prompt (no decision, or stale). */
  needsPrompt: boolean;
}

export async function getAiConsent(): Promise<AiConsentState> {
  return apiClient<AiConsentState>("/api/ai-consent");
}

export async function setAiConsent(
  status: AiConsentStatus,
): Promise<AiConsentState> {
  return apiClient<AiConsentState>("/api/ai-consent", {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

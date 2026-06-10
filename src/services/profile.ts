import { apiClient } from "./apiClient";

export interface Layer1 {
  primaryBucket: string | null;
  secondaryBucket: string | null;
  energyPattern: string | null;
  cravingType: string | null;
  goal: string | null;
  dietaryRestrictions: string[];
  tasteCluster: string | null;
  tasteExclusions: string[];
  eatingWindowClose: string;
  currentPhase: "follicular" | "luteal" | null;
  phaseStartDate: string | null;
  cycleLengthDays: number | null;
}

export interface Layer2 {
  energyLog: { date: string; energy: string }[];
  stressTags: { date: string; tags: string[] }[];
  sleepLog: { date: string; hours: number | null; quality: string | null }[];
  mealFeedback: any[];
  timingConsistency: number;
  planAdherence: number;
  confidenceLayer2: number;
}

export interface Layer3 {
  scanHistory: any[];
  latestScan: any | null;
  biometricTrend: string | null;
  scanCount: number;
  // `confidenceLayer3` was removed in RES-121; the composite L3 value is
  // surfaced via `Confidence.layer3` instead.
}

export interface Confidence {
  layer1: number;
  layer2: number;
  layer3: number;
  composite: number;
  esterTier: "Pattern Acknowledgment" | "Observation" | "Interpretation" | "Prediction";
}

export interface OnboardingState {
  quizAnswers: Record<string, string>;
  onboardingStep: string | null;
  onboardingComplete: boolean;
}

export interface UserProfile {
  userId: string;
  layer1: Layer1;
  layer2: Layer2;
  layer3: Layer3;
  confidence: Confidence;
  onboarding: OnboardingState;
  // RES-127 — account status, defaults to "pro" on the backend until paywall
  // ships. Drives Settings copy + Ester's biomarker access gating.
  subscriptionTier?: "free" | "pro";
}

export async function getProfile(): Promise<UserProfile> {
  return apiClient<UserProfile>("/api/profile");
}

/**
 * Dev-only: persist the caller's subscription tier in the backend. Backs the
 * local "Subscribe" testing shortcut on the paywall so a dev-granted pro
 * survives re-login instead of living only in client state. The backend
 * hard-gates this to the local env (403 everywhere else), and the call site is
 * compiled out of production via __DEV__.
 */
export async function setSubscriptionTierDev(
  tier: "free" | "pro",
): Promise<void> {
  await apiClient("/api/profile/dev/subscription-tier", {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
}

export interface UpdateProfileData {
  primaryBucket?: string;
  secondaryBucket?: string;
  energyPattern?: string;
  cravingType?: string;
  goal?: string;
  dietaryRestrictions?: string[];
  tasteCluster?: string;
  tasteExclusions?: string[];
  eatingWindowClose?: string;
  currentPhase?: "follicular" | "luteal";
  phaseStartDate?: string;
  cycleLengthDays?: number;
  // RES-121 typing-survey answers — replaces local `determineType`. The
  // backend computes `primaryBucket` from these and returns it in the
  // PATCH response.
  behaviorAnswers?: { q1?: string; q2?: string; q3?: string };
  quizAnswers?: Record<string, string>;
  onboardingStep?: string;
  onboardingComplete?: boolean;
}

export interface UpdateProfileResponse {
  message: string;
  profile: {
    primaryBucket: string | null;
    secondaryBucket: string | null;
    energyPattern: string | null;
    cravingType: string | null;
    dietaryRestrictions: string[];
    tasteCluster: string | null;
    // RES-121 typing-function flags. `internalConfidence` itself stays
    // backend-only per the ticket.
    startingRead?: boolean;
    glp1Flag?: boolean;
  };
}

// Backend returns the just-updated Layer1 snapshot — including the
// freshly-computed `primaryBucket` when `behaviorAnswers` was submitted.
export async function updateProfile(
  data: UpdateProfileData,
): Promise<UpdateProfileResponse> {
  return apiClient<UpdateProfileResponse>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function submitScanResults(
  scanData: Record<string, any>,
): Promise<{ message: string; scanCount: number }> {
  return apiClient("/api/profile/scan", {
    method: "POST",
    body: JSON.stringify({ scanData }),
  });
}

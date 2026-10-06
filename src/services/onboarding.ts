import { updateProfile } from "./profile";
import type { V1AnswerMap } from "../constants/v1Questions";
import type { MetabolicType } from "../constants/colors";

/**
 * Push all onboarding data to backend profile after account creation.
 *
 * RES-121: the FE no longer computes `primaryBucket` locally. We submit
 * the raw 3-question survey answers (`behaviorAnswers`) and the backend's
 * TypingService computes the archetype, persists it on the profile, and
 * we read it back from the response.
 */
export async function syncOnboardingToBackend(params: {
  goal?: string;
  /**
   * 🔑 Fixed V1 — the six scored question ids, each holding the selected
   * ANSWER WEIGHTS row id (`U1_A2`). Sent verbatim: these ARE the scoring keys
   * the backend's weight table is indexed by.
   */
  behaviorAnswers: V1AnswerMap;
  tastePreferences: string[];
  dietaryRestrictions: string[];
}): Promise<{
  primaryBucket: MetabolicType | null;
  startingRead: boolean;
  glp1Flag: boolean;
}> {
  const { goal, behaviorAnswers, tastePreferences, dietaryRestrictions } =
    params;

  const updated = await updateProfile({
    goal: goal ?? undefined,
    dietaryRestrictions,
    tasteCluster: tastePreferences[0] ?? undefined, // First selection is primary cluster
    behaviorAnswers,
    onboardingStep: "Account",
    // 🔴 NO `onboardingComplete` here. This runs the moment the account
    // exists — before AI consent, the paywall and the Type reveal — so
    // claiming completion here was simply false, and the backend now stamps
    // `onboardingCompletedAt` from it. `markOnboardingComplete()` below is
    // sent once, from the end of the reveal stack, which is where onboarding
    // actually ends.
  });

  return {
    primaryBucket:
      (updated?.profile?.primaryBucket as MetabolicType | undefined) ?? null,
    startingRead: !!updated?.profile?.startingRead,
    glp1Flag: !!updated?.profile?.glp1Flag,
  };
}

/**
 * Mark onboarding finished. Sent once, from the end of the Type reveal stack.
 *
 * 🔴 This exists because `primaryBucket` stopped being a usable proxy for "has
 * finished onboarding". The Type is written at account creation now, so a
 * member who closes the app on the consent screen or the paywall and reopens it
 * had their session restored as complete — skipping the AI-consent screen and
 * the paywall. Reported on an S24, 2026-10-02.
 *
 * 🔑 Fire-and-forget on purpose. The local `completeOnboarding()` is what moves
 * the member on; this only has to win before their NEXT cold start, and the
 * backend latches it so a retry is harmless.
 */
export async function markOnboardingComplete(): Promise<void> {
  try {
    await updateProfile({ onboardingComplete: true });
  } catch {
    // Non-fatal — see above.
  }
}

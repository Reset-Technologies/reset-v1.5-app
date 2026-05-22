import { updateProfile } from "./profile";
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
  behaviorAnswers: { q1?: string; q2?: string; q3?: string };
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
    onboardingComplete: true,
  });

  return {
    primaryBucket:
      (updated?.profile?.primaryBucket as MetabolicType | undefined) ?? null,
    startingRead: !!updated?.profile?.startingRead,
    glp1Flag: !!updated?.profile?.glp1Flag,
  };
}

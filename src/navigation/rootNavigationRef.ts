import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

// Module-level ref so screens outside the navigator tree (e.g. ones that are
// about to unmount because completeOnboarding() switches the root stack from
// Onboarding to Main) can still dispatch a deep navigation once the new
// stack mounts.
export const rootNavigationRef =
  createNavigationContainerRef<RootStackParamList>();

/**
 * Dispatch a root navigation once the target stack actually exists.
 *
 * 🔴 `isReady()` is not enough, and assuming it was cost us the first-meal
 * handoff. It reports that the CONTAINER is mounted, not that the stack you are
 * navigating to has rendered — so a fixed `setTimeout` after
 * `completeOnboarding()` is a race. Observed on an Android emulator
 * 2026-09-30: `isReady()` true, 80ms elapsed, and React Navigation still logged
 * "The action 'NAVIGATE' … was not handled by any navigator", leaving the member
 * on Home instead of their first meal.
 *
 * Polls for the route name to appear in the root state instead, so it works on
 * a slow device rather than on the machine it was written on. Gives up quietly
 * after ~2s: the member is already on Home, which is a fine place to be — this
 * is a nicety, not a destination.
 *
 * Returns a cancel function so an effect that re-runs does not leave a second
 * poller behind.
 */
export function navigateWhenMounted(
  rootRouteName: string,
  action: () => void,
  { attempts = 20, intervalMs = 100 }: { attempts?: number; intervalMs?: number } = {},
): () => void {
  let left = attempts;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    if (cancelled) return;
    if (rootNavigationRef.isReady()) {
      const state = rootNavigationRef.getRootState?.();
      const mounted = state?.routes?.some((r) => r.name === rootRouteName);
      if (mounted) {
        action();
        return;
      }
    }
    if (--left > 0) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

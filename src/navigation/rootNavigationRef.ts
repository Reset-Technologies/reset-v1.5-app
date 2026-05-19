import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

// Module-level ref so screens outside the navigator tree (e.g. ones that are
// about to unmount because completeOnboarding() switches the root stack from
// Onboarding to Main) can still dispatch a deep navigation once the new
// stack mounts.
export const rootNavigationRef =
  createNavigationContainerRef<RootStackParamList>();

import { requireNativeModule } from "expo-modules-core";

// The native module is iOS-only and only present in binaries built after it
// was added. Load it defensively so importing this file never throws: on
// Android, in Expo Go, or in an older dev client the getters fall back to a
// safe default (treat as a non-TestFlight build).
let native: { isTestFlight?: boolean } | null = null;
try {
  native = requireNativeModule("BuildEnv");
} catch {
  native = null;
}

/**
 * True when the running iOS binary was installed via TestFlight — its App
 * Store receipt is a `sandboxReceipt`. False on the App Store build, on
 * Android, and in the simulator (no receipt). TestFlight and the App Store
 * ship the same binary, so this receipt check is the only reliable way to
 * distinguish them at runtime.
 */
export function isTestFlightBuild(): boolean {
  return native?.isTestFlight === true;
}

/**
 * Whether internal/experimental UI should be visible: local dev builds
 * (`__DEV__`) and TestFlight builds only — never the shipping App Store build.
 */
export function shouldShowExperiments(): boolean {
  return __DEV__ || isTestFlightBuild();
}

import AsyncStorage from "@react-native-async-storage/async-storage";

// The Reset Window introduction is shown ONCE per member — new members meet it
// after the paywall (they land on Today with no Window set), existing members
// the first time they open the app after the feature ships. Same shape as
// appOpenFlowGate, minus the per-day key.
const keyFor = (userId: string) => `@reset_window_intro_${userId}`;

export async function shouldShowWindowIntro(userId: string): Promise<boolean> {
  try {
    return !(await AsyncStorage.getItem(keyFor(userId)));
  } catch {
    // Storage unavailable: don't interrupt Today with an intro we cannot
    // remember dismissing.
    return false;
  }
}

export async function markWindowIntroShown(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), "1");
  } catch {
    // noop — the Today card still carries a "Set Window" CTA.
  }
}

export async function resetWindowIntroGate(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // noop
  }
}

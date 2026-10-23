import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * The buzz half of Lang's cooking-timer alarm (`5062:58141`), annotated
 * *"Rings (sound + vibration) until manually dismissed"*.
 *
 * Same platform split, and for the same reason, as [[playRevealHaptics]] in
 * `revealHaptics.ts`:
 *
 *   Android — `Vibration.vibrate(pattern, true)` repeats a real waveform on
 *             the motor, so the alarm keeps buzzing on its own until it is
 *             cancelled. `expo-haptics` only fires fixed system ticks there
 *             with no amplitude control, which reads as far too polite for
 *             something meant to reach you across a kitchen.
 *
 *   iOS     — patterns and the repeat flag are both IGNORED by
 *             `Vibration.vibrate`; it buzzes once and stops. So the repeat has
 *             to be driven from JS, and `NotificationFeedbackType.Warning` is
 *             the strongest double-tap Core Haptics exposes through
 *             `expo-haptics`.
 *
 * Returns the stop function. The caller MUST call it — on dismissal and on
 * unmount — or Android keeps buzzing after the screen is gone.
 */
export function startAlarmBuzz(): () => void {
  if (Platform.OS === "android") {
    // [wait, buzz, gap, buzz, long rest] — two pulses then a breath, so it
    // reads as a ring rather than a continuous drone.
    Vibration.vibrate([0, 500, 320, 500, 900], true);
    return () => Vibration.cancel();
  }

  const fire = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };
  fire();
  const timer = setInterval(fire, 1500);
  return () => clearInterval(timer);
}

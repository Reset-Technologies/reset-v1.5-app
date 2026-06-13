import * as Haptics from "expo-haptics";

/**
 * RES-138 — reveal haptics for the metabolic-type reveal animation.
 *
 * The brief: a simple vibration that starts small and grows in intensity as the
 * reveal video plays, building to ~80% and then holding at that peak for ~5s.
 *
 * `expo-haptics` only exposes discrete impacts (Light/Medium/Heavy) with no
 * continuous amplitude control, so we approximate the ramp two ways at once:
 *   1. escalate the impact weight (Light → Medium → Heavy) with progress, and
 *   2. tighten the interval between pulses so they come faster as it builds.
 * Then we sustain steady Heavy pulses for the hold. Heavy is our perceptual
 * ceiling here (we deliberately avoid the harsher notification/rigid styles, so
 * the peak reads as a strong-but-not-maxed ~80%).
 *
 * Returns a cancel function that clears every pending pulse — call it on unmount
 * or if the reveal is re-triggered, so timers don't fire after teardown.
 */
export function playRevealHaptics(rampMs = 5200, holdMs = 5000): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];

  const fire = (style: Haptics.ImpactFeedbackStyle, at: number) => {
    timers.push(
      setTimeout(() => {
        Haptics.impactAsync(style).catch(() => {});
      }, at),
    );
  };

  // Ramp: pulse interval shrinks from ~360ms to ~80ms, weight escalates with
  // progress, so the buzz both speeds up and hits harder as the video plays.
  let t = 0;
  while (t < rampMs) {
    const p = t / rampMs; // 0 → 1
    const style =
      p < 0.34
        ? Haptics.ImpactFeedbackStyle.Light
        : p < 0.67
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
    fire(style, t);
    t += 360 - p * 280; // 360ms → ~80ms
  }

  // Hold at the ~80% peak: steady Heavy pulses for holdMs.
  for (let h = rampMs; h < rampMs + holdMs; h += 140) {
    fire(Haptics.ImpactFeedbackStyle.Heavy, h);
  }

  return () => {
    timers.forEach(clearTimeout);
  };
}

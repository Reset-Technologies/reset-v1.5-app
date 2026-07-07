import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * RES-138 / RES-149 — reveal haptics for the metabolic-type reveal.
 *
 * The brief (RES-149, PM): really lean into the haptics and make the reveal
 * slower. The buzz is synced to the (~3.2s) pixel dissolve — it starts soft and
 * sparse, then hits harder AND faster as the pixels lift off, building to a
 * strong payoff the instant the card is fully revealed. After that it settles
 * into a gentle sustained throb that KEEPS GOING until the user swipes to the
 * next card (the caller cancels it on dismiss/unmount). The visual dissolve and
 * this schedule share REVEAL_DURATION_MS so the crescendo lands with the reveal.
 *
 * Platform split, because the two OSes expose very different haptic surfaces:
 *
 *   iOS   — Core Haptics via `expo-haptics` feels great. We escalate the impact
 *           weight (Light → Medium → Heavy) and tighten the interval as it
 *           builds, land a Heavy hit + Success pop, then a soft Light throb.
 *
 *   Android — `expo-haptics` only fires tiny fixed system ticks with no
 *           amplitude control, so a ramp of impacts reads as weak. Instead we
 *           drive the motor directly with RN's `Vibration` waveform: buzzes that
 *           lengthen and gaps that tighten into a real crescendo capped by a
 *           long hit, then a looping low throb. Much beefier on a device like
 *           the S24.
 *
 * Returns a cancel function — call it on unmount or when the card is swiped away
 * so nothing keeps buzzing after the reveal card is gone.
 */
export function playRevealHaptics(revealMs = 3200): () => void {
  if (Platform.OS === "android") return playAndroidCrescendo(revealMs);
  return playIosRamp(revealMs);
}

// iOS: escalating, tightening impact ramp → Heavy/Success climax → soft throb.
function playIosRamp(revealMs: number): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let holdTimer: ReturnType<typeof setInterval> | null = null;

  const fire = (style: Haptics.ImpactFeedbackStyle, at: number) => {
    timers.push(
      setTimeout(() => {
        Haptics.impactAsync(style).catch(() => {});
      }, at),
    );
  };

  let t = 0;
  while (t < revealMs) {
    const p = t / revealMs; // 0 → 1
    const style =
      p < 0.4
        ? Haptics.ImpactFeedbackStyle.Light
        : p < 0.75
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
    fire(style, t);
    t += 280 - p * 210; // ~280ms → ~70ms, accelerating
  }

  // Climax: a Heavy hit the instant the card is revealed + a Success pop after.
  fire(Haptics.ImpactFeedbackStyle.Heavy, revealMs);
  timers.push(
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }, revealMs + 90),
  );

  // Hold: a soft Light throb that keeps going until the user swipes away.
  timers.push(
    setTimeout(() => {
      holdTimer = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 240);
    }, revealMs + 320),
  );

  return () => {
    timers.forEach(clearTimeout);
    if (holdTimer) clearInterval(holdTimer);
  };
}

// Android: a vibration crescendo (lengthening buzzes, tightening gaps) capped by
// a sustained hit, then a looping low throb until cancelled. RN's Vibration is a
// single channel and `repeat` loops the WHOLE pattern, so we play the crescendo
// once and start the repeating throb right after it finishes.
function playAndroidCrescendo(revealMs: number): () => void {
  const pattern: number[] = [0]; // leading wait; [wait, buzz, wait, buzz, …]
  let t = 0;
  while (t < revealMs) {
    const p = t / revealMs; // 0 → 1
    const on = Math.round(10 + p * p * 60); // ~10ms → ~70ms buzzes lengthen
    const off = Math.round(200 - p * 172); // ~200ms → ~28ms gaps tighten
    pattern.push(on, off);
    t += on + off;
  }
  // Climax: a sharp double then a long sustained buzz as the reveal completes.
  pattern.push(90, 45, 420);

  const crescendoMs = pattern.reduce((a, b) => a + b, 0);
  Vibration.vibrate(pattern, false);

  // Once the crescendo ends, loop a gentle throb (wait 150, buzz 45) until swipe.
  const holdTimer = setTimeout(() => {
    Vibration.vibrate([150, 45], true);
  }, crescendoMs);

  return () => {
    clearTimeout(holdTimer);
    Vibration.cancel();
  };
}

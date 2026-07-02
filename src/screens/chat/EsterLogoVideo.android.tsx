import React, { useEffect, useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { MetabolicType } from "../../constants/colors";

/**
 * RES-140 — Android variant of the Ester voice-screen logo animation.
 *
 * Android's video stack doesn't composite HEVC alpha, so the per-type reveal
 * plays as a transparent animated WebP via expo-image. These `require`s live
 * only in the `.android` file so the WebPs are bundled into the Android app
 * only (iOS uses the `.mov`s in EsterLogoVideo.tsx).
 *
 * Like the iOS sibling, this loops only while Ester is reading (`playing`). When
 * she goes quiet it does NOT cut the morph off on the current frame the way
 * `stopAnimating()` alone would (that left a half-formed logo frozen on screen).
 * Instead it lets the current cycle play through to its end — the clean
 * assembled frame 0 where the WebP loops with a hard cut — then settles there.
 */
const TYPE_WEBP: Record<MetabolicType, any> = {
  Burner: require("../../../assets/animations/type-reveal-burner.webp"),
  Rebounder: require("../../../assets/animations/type-reveal-rebounder.webp"),
  Ember: require("../../../assets/animations/type-reveal-ember.webp"),
  Chameleon: require("../../../assets/animations/type-reveal-chameleon.webp"),
  Explorer: require("../../../assets/animations/type-reveal-explorer.webp"),
};

// Loop length of each reveal WebP in ms, measured from the asset frame timings
// (267 frames × 33ms for Burner, etc.). Used to time the settle so the morph
// finishes its current cycle instead of freezing partway. expo-image exposes no
// per-loop callback, so we time it from when animation started.
const TYPE_DURATION_MS: Record<MetabolicType, number> = {
  Burner: 8811,
  Rebounder: 4653,
  Ember: 8514,
  Chameleon: 5313,
  Explorer: 6765,
};

export function EsterLogoVideo({
  type,
  playing,
  style,
}: {
  type: MetabolicType;
  playing: boolean;
  style: object;
}) {
  const ref = useRef<any>(null);
  const startedAtRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped to remount the image so the animated WebP resets to its first
  // ("assembled") frame and rests there. We time the bump to the loop boundary
  // so the swap is assembled-frame → assembled-frame and reads as seamless.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const clearTimer = () => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
    };
    // start/stopAnimating reject if the WebP view was already recycled (the
    // resetKey remount swaps it out) — swallow that so it doesn't surface as an
    // uncaught-promise error banner. The remount handles the visual reset.
    const ignoreRejection = (p: any) => {
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    if (playing) {
      clearTimer();
      startedAtRef.current = Date.now();
      ignoreRejection(ref.current?.startAnimating?.());
    } else {
      clearTimer();
      const dur = TYPE_DURATION_MS[type] || 0;
      if (dur > 0 && startedAtRef.current > 0) {
        // Time left in the cycle that's currently on screen, so we settle right
        // as it wraps back to the assembled frame 0.
        const elapsed = Date.now() - startedAtRef.current;
        const remainingMs = dur - (elapsed % dur);
        settleTimer.current = setTimeout(() => {
          ignoreRejection(ref.current?.stopAnimating?.());
          setResetKey((k) => k + 1);
        }, remainingMs + 60);
      } else {
        ignoreRejection(ref.current?.stopAnimating?.());
        setResetKey((k) => k + 1);
      }
    }
    return clearTimer;
  }, [playing, type]);

  return (
    <ExpoImage
      key={resetKey}
      ref={ref}
      source={TYPE_WEBP[type]}
      style={style}
      contentFit="contain"
      autoplay={false}
      cachePolicy="memory-disk"
    />
  );
}

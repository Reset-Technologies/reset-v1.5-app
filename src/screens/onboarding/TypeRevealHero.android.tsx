import React, { useEffect, useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { MetabolicType } from "../../constants/colors";

/**
 * RES-138 — hero metabolic-type reveal animation (Android variant).
 *
 * Android's video stack doesn't composite HEVC alpha (it renders a black box),
 * so the per-type reveal plays as a transparent animated WebP via expo-image.
 * These `require`s live only in the `.android` file, so the WebPs are bundled
 * into the Android app only — never the iOS one (which uses the `.mov`s).
 *
 * `autoplay` is off so the image holds on its first frame behind the card's
 * "Tap to reveal" frost; when `playing` flips true we kick playback via the
 * imperative `startAnimating()` so it begins exactly on reveal (in sync with
 * the haptics) rather than whenever the card mounted.
 *
 * 🔴 GATED ON LOAD, not just on `playing`. These are 2–4 MB WebPs of 141–267
 * frames, and `startAnimating()` does nothing if the image has not finished
 * decoding — so on a slow decode the reveal tap fired into the void and the
 * artwork simply appeared, static, whenever it was ready. Every one of these
 * files has an infinite loop count, so a frozen hero is never the asset: it
 * means playback never started. Waiting for `onLoad` makes the tap and the
 * decode independent of each other.
 */
const TYPE_WEBP: Record<MetabolicType, any> = {
  Burner: require("../../../assets/animations/type-reveal-burner.webp"),
  Rebounder: require("../../../assets/animations/type-reveal-rebounder.webp"),
  Ember: require("../../../assets/animations/type-reveal-ember.webp"),
  Chameleon: require("../../../assets/animations/type-reveal-chameleon.webp"),
  Explorer: require("../../../assets/animations/type-reveal-explorer.webp"),
};

export function TypeRevealHero({
  type,
  playing,
  style,
}: {
  type: MetabolicType;
  playing: boolean;
  style: object;
}) {
  const ref = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!playing || !loaded) return;
    // 🔑 No `?.` on the method — it exists on expo-image's ref (55.0.11). If a
    // future version drops it this should throw rather than silently no-op,
    // which is how the original failure hid.
    ref.current?.startAnimating();
  }, [playing, loaded]);

  return (
    <ExpoImage
      ref={ref}
      source={TYPE_WEBP[type]}
      style={style}
      contentFit="contain"
      autoplay={false}
      onLoad={() => setLoaded(true)}
    />
  );
}

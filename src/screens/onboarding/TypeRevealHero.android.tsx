import React, { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (playing) {
      ref.current?.startAnimating?.();
    }
  }, [playing]);

  return (
    <ExpoImage
      ref={ref}
      source={TYPE_WEBP[type]}
      style={style}
      contentFit="contain"
      autoplay={false}
    />
  );
}

import React, { useEffect, useRef } from "react";
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
 * Animates only while Ester is reading (`playing`) and holds its current frame
 * when she goes quiet.
 */
const TYPE_WEBP: Record<MetabolicType, any> = {
  Burner: require("../../../assets/animations/type-reveal-burner.webp"),
  Rebounder: require("../../../assets/animations/type-reveal-rebounder.webp"),
  Ember: require("../../../assets/animations/type-reveal-ember.webp"),
  Chameleon: require("../../../assets/animations/type-reveal-chameleon.webp"),
  Explorer: require("../../../assets/animations/type-reveal-explorer.webp"),
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

  useEffect(() => {
    if (playing) {
      ref.current?.startAnimating?.();
    } else {
      // Idle state is shown via the static logo overlay in EsterChatScreen.
      ref.current?.stopAnimating?.();
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

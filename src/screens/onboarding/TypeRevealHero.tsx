import React, { useEffect } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import { MetabolicType } from "../../constants/colors";

/**
 * RES-138 — hero metabolic-type reveal animation (iOS / default variant).
 *
 * Plays the per-type HEVC-with-alpha clip via expo-video, composited over the
 * bone card. The clip is paused on its first frame until `playing` flips true
 * (the "Tap to reveal" moment), then plays once. Android has its own
 * `TypeRevealHero.android.tsx` that plays a transparent WebP via expo-image, so
 * the `.mov` files are bundled on iOS only and the `.webp` only on Android.
 */
const TYPE_VIDEO: Record<MetabolicType, any> = {
  Burner: require("../../../assets/videos/type-reveal-burner.mov"),
  Rebounder: require("../../../assets/videos/type-reveal-rebounder.mov"),
  Ember: require("../../../assets/videos/type-reveal-ember.mov"),
  Chameleon: require("../../../assets/videos/type-reveal-chameleon.mov"),
  Explorer: require("../../../assets/videos/type-reveal-explorer.mov"),
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
  const player = useVideoPlayer(TYPE_VIDEO[type], (p) => {
    // Loop so the reveal animation keeps playing continuously instead of
    // freezing on its last frame after the first pass.
    p.loop = true;
    p.muted = true;
    p.pause();
  });

  useEffect(() => {
    if (playing) {
      player.currentTime = 0;
      player.play();
    }
  }, [playing, player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

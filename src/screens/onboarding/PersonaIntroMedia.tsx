import React from "react";
import { VideoView, type VideoPlayer } from "expo-video";

/**
 * Persona logo animation — iOS / default variant.
 *
 * Renders the HEVC-with-alpha video (RES-134) via the player created by the
 * parent screen (the parent listens to the player's `playToEnd` to advance the
 * onboarding step). Android has its own `PersonaIntroMedia.android.tsx` that
 * plays a transparent WebP instead, so the WebP asset is bundled only on
 * Android and the `.mov` only ships where it's used.
 */
export function PersonaIntroMedia({
  player,
  style,
}: {
  player: VideoPlayer;
  style: object;
}) {
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

import React from "react";
import { Image as ExpoImage } from "expo-image";
import { type VideoPlayer } from "expo-video";

// Android's video stack doesn't composite HEVC alpha (it renders a black box),
// so the persona logo animation plays as a transparent animated WebP via
// expo-image. This require lives only in the `.android` file, so the WebP is
// bundled into the Android app only — never the iOS one.
const POST_SCAN_WEBP = require("../../../assets/animations/post-scan-intro.webp");

/**
 * Persona logo animation — Android variant (transparent WebP).
 *
 * `player` is accepted for prop-parity with the iOS variant but unused here —
 * the parent screen still creates the video player and uses its `playToEnd`
 * (plus a `durationMs` fallback timer) to advance the onboarding step.
 */
export function PersonaIntroMedia({
  style,
}: {
  player: VideoPlayer;
  style: object;
}) {
  return (
    <ExpoImage
      source={POST_SCAN_WEBP}
      style={style}
      contentFit="contain"
      autoplay
    />
  );
}

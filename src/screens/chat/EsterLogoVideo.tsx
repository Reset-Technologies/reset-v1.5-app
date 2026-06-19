import React, { useEffect, useRef } from "react";
import { VideoView, useVideoPlayer } from "expo-video";
import { MetabolicType } from "../../constants/colors";

/**
 * RES-140 — the metabolic-type logo animation that anchors the Ester voice
 * screen. Reuses the per-type reveal clips (RES-138). iOS plays the HEVC-alpha
 * `.mov` via expo-video; the Android sibling (`.android.tsx`) plays the
 * transparent WebP via expo-image since Android can't composite HEVC alpha.
 *
 * Unlike the onboarding hero, this loops only while Ester is actively reading a
 * message (`playing`) and freezes on the current frame when she goes quiet — so
 * the logo "comes alive" in step with the voice and rests otherwise.
 */
const TYPE_VIDEO: Record<MetabolicType, any> = {
  Burner: require("../../../assets/videos/type-reveal-burner.mov"),
  Rebounder: require("../../../assets/videos/type-reveal-rebounder.mov"),
  Ember: require("../../../assets/videos/type-reveal-ember.mov"),
  Chameleon: require("../../../assets/videos/type-reveal-chameleon.mov"),
  Explorer: require("../../../assets/videos/type-reveal-explorer.mov"),
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
  const player = useVideoPlayer(TYPE_VIDEO[type], (p) => {
    p.loop = true;
    p.muted = true;
    p.pause();
  });

  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const clearTimer = () => {
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
    };
    if (playing) {
      clearTimer();
      player.loop = true;
      player.play();
    } else {
      // Don't cut the morph off when Ester stops — let it keep playing through
      // to the end of its current cycle, then settle on the assembled frame 0
      // (the clip loops with a hard cut, so frame 0 is the only clean "finished"
      // frame). The video keeps playing during this tail; we pause right as it
      // wraps back to the start.
      clearTimer();
      const dur = player.duration || 0;
      const cur = player.currentTime || 0;
      if (dur > 0 && player.playing) {
        const remainingMs = Math.max(0, (dur - cur) * 1000);
        settleTimer.current = setTimeout(() => {
          player.pause();
          player.currentTime = 0;
        }, remainingMs + 80);
      } else {
        player.pause();
        player.currentTime = 0;
      }
    }
    return clearTimer;
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

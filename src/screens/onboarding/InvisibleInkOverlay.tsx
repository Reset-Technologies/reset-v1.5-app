import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from "react-native-reanimated";

// RES-149 — "invisible ink" pixel reveal for the metabolic-type card.
//
// The type content (mascot + name + tagline + paragraph) is rendered as normal
// RN views underneath. This overlay sits on top as an OPAQUE accent field with a
// gentle "invisible ink" shimmer. On reveal, a soft band sweeps noise-space and
// each pixel-cell shrinks to a drifting dot that floats up and off — the content
// coalesces out from behind the dissolving pixels (RES-149, PM-picked variant:
// pixel dissolve, NO holographic sheen, slowed down to lean into the haptics).
// GPU SkSL so the per-pixel dissolve holds 60fps where RN views would drop frames.
//
// coverage == alpha:
//   progress 0  -> every cell fully covered  -> content hidden, no leak
//   progress 1  -> every cell dissolved off  -> content fully revealed
const SKSL = `
uniform float2 u_resolution;
uniform float  u_time;      // monotonic seconds, drives the ink shimmer
uniform float  u_progress;  // 0 = fully inked, 1 = fully revealed
uniform float3 u_ink;       // metabolic-type accent (normalized RGB)

float hash21(float2 p) {
  p = fract(p * float2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// Smooth value noise so pixels leave in organic clusters, not pure TV static.
float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + float2(1.0, 0.0));
  float c = hash21(i + float2(0.0, 1.0));
  float d = hash21(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Signed distance to a rounded box — the shrinking pixel is drawn from this.
float sdRoundBox(float2 p, float2 b, float rad) {
  float2 q = abs(p) - b + rad;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rad;
}

half4 main(float2 fragcoord) {
  float px = u_resolution.x / 32.0;         // ~32 pixels across the card
  float2 grid = u_resolution / px;
  float2 cell = floor(fragcoord / px);
  float2 cellUv = cell / grid;              // 0..1 cell index
  float2 cc = fract(fragcoord / px) - 0.5;  // -0.5..0.5 within the cell

  // Per-cell dissolve threshold: white-noise speckle blended with smooth value
  // noise so cells leave in clusters rather than as isolated flecks.
  float field = mix(hash21(cell), vnoise(cellUv * float2(4.0, 6.0)), 0.4);

  // A soft band sweeps threshold-space as progress climbs; each cell crosses
  // from covered (r=0) to revealed (r=1) as the band passes its threshold.
  float band = 0.24;
  float threshold = (1.0 + band) - u_progress * (1.0 + 2.0 * band);
  float r = smoothstep(threshold - band, threshold + band, field);

  // The covered pixel is a rounded square that shrinks toward a dot and floats
  // up as it dissolves — the "pixels lift off and the content coalesces" look.
  float hs  = (1.0 - r) * 0.56;             // half-size, shrinks to 0
  float rad = hs * (0.22 + 0.6 * r);        // rounds off into a dot as it goes
  float2 p  = cc - float2(0.0, r * 0.30);   // drift upward while dissolving
  float d   = sdRoundBox(p, float2(hs), rad);
  float aa  = 1.3 / px;                      // ~1.3px of edge AA, in cell units
  float pixelCoverage = 1.0 - smoothstep(-aa, aa, d);

  // Until a cell actually begins to dissolve, keep it a SOLID fill. The per-cell
  // rounded boxes only tile with antialiased seams — thin dark lines where
  // neighbouring cells meet (content leaking through at ~half coverage) — so we
  // hand off from solid to the shrinking pixel only once r lifts off zero.
  float coverage = mix(1.0, pixelCoverage, smoothstep(0.0, 0.18, r));

  // Fully extinguish the pixel over the last of its life. A box shrunk to size 0
  // still leaves a ~half-pixel AA dot at its drift point, so without this a faint
  // grid of dots lingers after the reveal completes (r -> 1).
  coverage = coverage * (1.0 - smoothstep(0.9, 1.0, r));

  // Base foil: accent with faint per-cell brightness + a slow, gentle shimmer so
  // the covered card feels alive ("invisible ink") — deliberately NO sheen band.
  float shade = hash21(cell + 3.17);
  float twinkle = 0.06 * sin(u_time * 1.6 + hash21(cell) * 6.2831);
  half3 ink = half3(u_ink);
  half3 col = mix(ink * 0.93, mix(ink, half3(1.0), 0.10), clamp(shade + twinkle, 0.0, 1.0));

  // Skia runtime shaders return PREMULTIPLIED colour (premultiply by coverage so
  // coverage 0 -> half4(0,0,0,0), not an additive glow — the "sunburnt" bug).
  return half4(col * coverage, coverage);
}
`;

const source = Skia.RuntimeEffect.Make(SKSL);

// RES-149 — reveal duration. Slowed from 1.1s so the dissolve is savoured and
// the haptic ramp has room to build (PM: "lean into the haptics, make it slower").
// Exported so the haptic schedule in TypeRevealScreen stays locked to the visual.
export const REVEAL_DURATION_MS = 4000;

export function InvisibleInkOverlay({
  width,
  height,
  revealed,
  inkColor,
  onRevealComplete,
}: {
  width: number;
  height: number;
  revealed: boolean;
  inkColor: [number, number, number];
  onRevealComplete?: () => void;
}) {
  const clock = useSharedValue(0);
  const progress = useSharedValue(0);

  // Monotonic clock for the shimmer (seconds). Cheaper + smoother than a
  // repeating withTiming and never resets mid-animation.
  useFrameCallback((info) => {
    "worklet";
    clock.value = info.timeSinceFirstFrame / 1000;
  });

  useEffect(() => {
    if (!revealed) return;
    progress.value = withTiming(
      1,
      { duration: REVEAL_DURATION_MS, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished && onRevealComplete) runOnJS(onRevealComplete)();
      }
    );
    return () => cancelAnimation(progress);
  }, [revealed]);

  const uniforms = useDerivedValue(() => ({
    u_resolution: [width, height],
    u_time: clock.value,
    u_progress: progress.value,
    u_ink: inkColor,
  }));

  if (!source) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ width, height }}>
        <Fill>
          <Shader source={source} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

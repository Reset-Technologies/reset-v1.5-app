import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Confidence "pie" gauge — a thin ring with a filled slice showing how far the
 * Ester confidence score has accrued (`fraction`, 0–1). Matches the Figma pie
 * shown to the right of the confidence percentage. Defaults to the 24×24 / r10
 * spec; `size` scales the ring proportionally so other call sites (e.g. the
 * 22px profile-card pie) can reuse it.
 */

function buildPieSlicePath(
  fraction: number,
  center: number,
  radius: number,
): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0) return "";
  if (clamped >= 1) {
    return `M ${center} ${center - radius}
            A ${radius} ${radius} 0 1 1 ${center} ${center + radius}
            A ${radius} ${radius} 0 1 1 ${center} ${center - radius} Z`;
  }
  const angle = clamped * 2 * Math.PI;
  const endX = center + radius * Math.sin(angle);
  const endY = center - radius * Math.cos(angle);
  const largeArc = clamped > 0.5 ? 1 : 0;
  return `M ${center} ${center}
          L ${center} ${center - radius}
          A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export function ConfidencePie({
  fraction,
  color,
  size = 24,
}: {
  fraction: number;
  color: string;
  size?: number;
}) {
  const center = size / 2;
  const radius = (size * 10) / 24; // 24px → r10, scaled for other sizes
  const path = buildPieSlicePath(fraction, center, radius);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      {path ? <Path d={path} fill={color} /> : null}
    </Svg>
  );
}

import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

interface WindowRingProps {
  size: number;
  strokeWidth: number;
  fraction: number; // 0–1, clockwise from 12 o'clock
  trackColor: string;
  progressColor: string;
  // >1 splits the ring into equal arcs — the Reset stages (thirds).
  segments?: number;
  gapDegrees?: number;
  children?: React.ReactNode; // centred inside the ring
}

function polar(c: number, r: number, degrees: number): [number, number] {
  const a = ((degrees - 90) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
}

function arcPath(c: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(c, r, from);
  const [x2, y2] = polar(c, r, to);
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** The Window timer ring: quiet countdown by day, staged Reset by night. */
export function WindowRing({
  size,
  strokeWidth,
  fraction,
  trackColor,
  progressColor,
  segments = 1,
  gapDegrees = 0,
  children,
}: WindowRingProps) {
  const f = Math.max(0, Math.min(1, fraction));
  const c = size / 2;
  const r = c - strokeWidth / 2 - 1;

  let rings: React.ReactNode;
  if (segments <= 1) {
    const circumference = 2 * Math.PI * r;
    rings = (
      <>
        <Circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {f > 0 ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - f)}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
      </>
    );
  } else {
    const span = (360 - segments * gapDegrees) / segments;
    rings = Array.from({ length: segments }, (_, i) => {
      const from = i * (span + gapDegrees) + gapDegrees / 2;
      const filled = Math.max(0, Math.min(1, f * segments - i));
      return (
        <React.Fragment key={i}>
          <Path
            d={arcPath(c, r, from, from + span)}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          {filled > 0.002 ? (
            <Path
              d={arcPath(c, r, from, from + span * filled)}
              stroke={progressColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </React.Fragment>
      );
    });
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {rings}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});

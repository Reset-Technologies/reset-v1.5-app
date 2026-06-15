import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { K } from "../../constants/colors";

interface ScoreRingProps {
  score: number;
  previousScore?: number;
  animate?: boolean;
  width?: number;
  numberColor?: string;
  showNeedle?: boolean;
  needleColor?: string;
}

// Semicircle gauge made of radial tick lines. Ticks inside the filled sweep
// are brown; ticks outside are a muted blue. The score count-ups animate
// the filled sweep from 0 to the target value over ~1.2s.

const BASE_W = 320;
const BASE_H = 200;
const CENTER_X = BASE_W / 2;
const CENTER_Y = BASE_H - 30;
const INNER_R = 110;
const TICK_LEN = 30;
const TICK_WIDTH = 3;
const TOTAL_TICKS = 61;
const START_DEG = -90; // left side of the semicircle (9 o'clock)
const SWEEP_DEG = 180; // through 12 o'clock to 3 o'clock
const BASE_FONT = 88;
const BASE_LINE = 96;
const BASE_LABEL_OFFSET = 70;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function ScoreRing({
  score,
  previousScore,
  animate = true,
  width = BASE_W,
  numberColor = K.brown,
  showNeedle = true,
  needleColor = K.brown,
}: ScoreRingProps) {
  const target = Math.max(0, Math.min(100, Math.round(score)));
  const prior =
    previousScore !== undefined
      ? Math.max(0, Math.min(target, Math.round(previousScore)))
      : target;
  const [displayed, setDisplayed] = useState(animate ? Math.min(prior, target) : target);

  useEffect(() => {
    if (!animate) {
      setDisplayed(target);
      return;
    }
    const fromValue = Math.min(prior, target);
    setDisplayed(fromValue);
    const duration = 1200;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(fromValue + (target - fromValue) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, prior, animate]);

  const filledFraction = displayed / 100;
  const priorFraction = prior / 100;

  const scale = width / BASE_W;
  const height = BASE_H * scale;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${BASE_W} ${BASE_H}`}>
        {Array.from({ length: TOTAL_TICKS }).map((_, i) => {
          const tFrac = i / (TOTAL_TICKS - 1);
          const angle = START_DEG + tFrac * SWEEP_DEG;
          const inner = polar(CENTER_X, CENTER_Y, INNER_R, angle);
          const outer = polar(
            CENTER_X,
            CENTER_Y,
            INNER_R + TICK_LEN,
            angle,
          );
          const inFilled = tFrac <= filledFraction + 0.0001;
          const inGain =
            tFrac > priorFraction - 0.0001 &&
            tFrac <= filledFraction + 0.0001 &&
            priorFraction < filledFraction;

          const color = !inFilled
            ? "#B89DA0" // unfilled track — light maroon
            : inGain
              ? K.brown
              : "#B8D0D6"; // filled — light blue
          const strokeW = inGain ? TICK_WIDTH + 1.5 : TICK_WIDTH;
          return (
            <Line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
          );
        })}
        {showNeedle ? (() => {
          const needleAngle = START_DEG + filledFraction * SWEEP_DEG;
          const pivot = polar(CENTER_X, CENTER_Y, INNER_R - 14, needleAngle);
          const tip = polar(CENTER_X, CENTER_Y, INNER_R + TICK_LEN + 8, needleAngle);
          return (
            <Line
              x1={pivot.x}
              y1={pivot.y}
              x2={tip.x}
              y2={tip.y}
              stroke={needleColor}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })() : null}
      </Svg>
      <View
        style={[
          styles.centerLabel,
          { top: (CENTER_Y - BASE_LABEL_OFFSET) * scale },
        ]}
        pointerEvents="none"
      >
        <Text
          style={[
            styles.number,
            {
              fontSize: BASE_FONT * scale,
              lineHeight: BASE_LINE * scale,
              color: numberColor,
            },
          ]}
        >
          {displayed}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  centerLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  number: {
    fontFamily: "PlayfairDisplay_700Bold",
    letterSpacing: -2,
  },
});

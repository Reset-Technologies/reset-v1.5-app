import React from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { K } from "../constants/colors";

/**
 * Shared trend indicator (up / down / same) sourced from Figma node
 * 950:20753-20776 (Icon/Trend). The triangle always *points* in the actual
 * direction of change; only the fill conveys meaning. Same/null: bone-toned
 * pill. K palette already matches the Figma fills exactly. Used by the Scan
 * Insights screen and the profile stat-detail tooltip modals so the trend
 * glyphs stay identical.
 *
 * Color modes:
 *  - Directional (default, when `betterDirection` is omitted): up = ochre,
 *    down = blue. This is the original v1 behavior — color encodes direction.
 *  - Valence-aware (when `betterDirection` is passed): ochre when the change
 *    moves in the better direction (a good change), blue otherwise — regardless
 *    of which way the triangle points. e.g. for Stress Index / Vascular Age
 *    (`betterDirection="down"`) a downward move is good, so it renders ochre.
 */

export type TrendDirection = "up" | "down" | "same" | null;

const TREND_TRIANGLE =
  "M9.35204 4.89235C10.1843 3.8104 11.8157 3.8104 12.648 4.89235L19.4256 13.7032C20.4773 15.0705 19.5026 17.05 17.7776 17.05H4.2224C2.49741 17.05 1.5227 15.0705 2.57444 13.7032L9.35204 4.89235Z";

export function TrendIcon({
  direction,
  betterDirection,
  size = 22,
}: {
  direction: TrendDirection;
  betterDirection?: "up" | "down";
  size?: number;
}) {
  if (direction === "same" || direction == null) {
    // Pill geometry is defined against the 22px viewBox; the viewBox scales it.
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <Rect
          x={1.55957}
          y={8.31641}
          width={17.6725}
          height={5.19779}
          rx={2.07912}
          fill={K.faded}
        />
      </Svg>
    );
  }
  // Valence-aware fill when a better direction is declared; otherwise the
  // original direction-based fill (up = ochre, down = blue).
  const isGood = betterDirection
    ? direction === betterDirection
    : direction === "up";
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d={TREND_TRIANGLE}
        fill={isGood ? K.ochre : K.blue}
        transform={direction === "down" ? "rotate(180 11 11)" : undefined}
      />
    </Svg>
  );
}

import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { MetabolicType } from "../../constants/colors";

const NOISE = require("../../../assets/images/noise-bg.png");

// RES-140 — the Ester background is three stacked layers: a cream page-surface
// base, a metabolic-type-primary half-ellipse rising from the bottom whose peak
// reaches just below the call timer, and a dark-maroon half-ellipse over the
// lower portion. Only the type ellipse changes per type. The type primaries are
// the per-logo hues established in the profile redesign (TYPE_GRADIENT_STOPS.mid).
const TOP_FIXED = "#EBE2D1"; // Page Surface (alt) — cream
const BOTTOM_ELLIPSE = "#361416"; // brown/950 Brown Primary
const TYPE_PRIMARY: Record<MetabolicType, string> = {
  Burner: "#A45937",
  Rebounder: "#5D5470",
  Ember: "#4F5760",
  Chameleon: "#6B5A4A",
  Explorer: "#8A7060",
};

/**
 * Full-bleed Ester background. A cream base, then a type-primary ellipse anchored
 * at the bottom-center that domes up to just under the timer, then a dark maroon
 * ellipse anchored at the bottom — matching the Figma's stacked half-ellipses.
 * The brand noise texture is laid over everything so the gradients don't band.
 *
 * The Svg is given explicit measured pixel dimensions because react-native-svg's
 * height="100%" under-resolves on Android and would leave the bottom uncovered.
 */
export function EsterBackground({ type }: { type: MetabolicType }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const primary = TYPE_PRIMARY[type];
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) =>
          s.w === width && s.h === height ? s : { w: width, h: height }
        );
      }}
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            {/* Type-primary ellipse — peaks just below the timer (~0.11h) at the
                center and curves down toward the sides; fades to reveal cream. */}
            <RadialGradient
              id="esterType"
              gradientUnits="userSpaceOnUse"
              cx={size.w / 2}
              cy={size.h}
              rx={size.w * 1.2}
              ry={size.h * 1.0}
              fx={size.w / 2}
              fy={size.h}
            >
              <Stop offset="0" stopColor={primary} stopOpacity={1} />
              <Stop offset="0.72" stopColor={primary} stopOpacity={1} />
              <Stop offset="0.84" stopColor={primary} stopOpacity={0.63} />
              <Stop offset="0.92" stopColor={primary} stopOpacity={0.29} />
              <Stop offset="1" stopColor={primary} stopOpacity={0} />
            </RadialGradient>
            {/* Dark maroon ellipse over the lower portion. */}
            <RadialGradient
              id="esterEllipse"
              gradientUnits="userSpaceOnUse"
              cx={size.w / 2}
              cy={size.h}
              rx={size.w * 1.3}
              ry={size.h * 0.72}
              fx={size.w / 2}
              fy={size.h}
            >
              <Stop offset="0" stopColor={BOTTOM_ELLIPSE} stopOpacity={1} />
              <Stop offset="0.6" stopColor={BOTTOM_ELLIPSE} stopOpacity={1} />
              <Stop offset="0.76" stopColor={BOTTOM_ELLIPSE} stopOpacity={0.63} />
              <Stop offset="0.88" stopColor={BOTTOM_ELLIPSE} stopOpacity={0.29} />
              <Stop offset="1" stopColor={BOTTOM_ELLIPSE} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={TOP_FIXED} />
          <Rect
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            fill="url(#esterType)"
          />
          <Rect
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            fill="url(#esterEllipse)"
          />
        </Svg>
      ) : null}
      {/* Subtle grain so the gradients don't band; matches the design's NOISE BG.
          The texture has a bell-shaped vertical falloff baked in: grain peaks
          across the primary-color band and tapers into the cream top and the
          maroon bottom. With this 0.1 layer opacity that reads as ~0.1 over the
          primary band, ~0.012 in the cream, and ~0.03 over the maroon. */}
      <Image
        source={NOISE}
        style={[StyleSheet.absoluteFill, { opacity: 0.1 }]}
        resizeMode="cover"
      />
    </View>
  );
}

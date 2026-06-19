import React, { useId, useState } from "react";
import { View, StyleSheet, Platform, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

/**
 * RES-140 — the "Liquid Glass" surface from the Ester design: a translucent
 * fill over a backdrop blur (the input bar and the frosted round buttons).
 *
 * React Native has no CSS backdrop-filter, so the blur comes from expo-blur's
 * BlurView on iOS. On Android expo-blur renders unevenly (per the onboarding
 * screens), so we drop the blur there and lean on a slightly stronger
 * translucent overlay — still reads as frosted glass over the gradient.
 *
 * `shine` adds the specular edge highlight from the design — a 1.5px stroke
 * whose white gradient is bright at the top and fades to nothing at the bottom,
 * mimicking light catching the top rim of the glass. It's drawn as an SVG
 * rounded-rect because RN borders can only be a single flat color.
 *
 * Children render above the glass; give the wrapper a borderRadius via `style`.
 */
export function LiquidGlass({
  style,
  children,
  intensity = 32,
  tint = "light",
  overlay = "rgba(255,255,255,0.1)",
  overlayAndroid,
  // Optional stack of translucent fill layers drawn above `overlay`, bottom
  // first. Used to approximate Figma's blend-mode fill stacks (which RN can't
  // reproduce) by layering the dominant colors as plain alpha fills.
  fills,
  shine = false,
  // Corner radius for the shine stroke. Defaults to a full pill (min/2).
  radius,
}: {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  overlay?: string;
  overlayAndroid?: string;
  fills?: string[];
  shine?: boolean;
  radius?: number;
}) {
  const fill =
    Platform.OS === "android" ? overlayAndroid ?? overlay : overlay;
  const gradientId = useId();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const r = radius ?? Math.min(size.w, size.h) / 2;
  return (
    <View
      style={[style, styles.clip]}
      onLayout={
        shine
          ? (e) => {
              const { width, height } = e.nativeEvent.layout;
              setSize((s) =>
                s.w === width && s.h === height ? s : { w: width, h: height }
              );
            }
          : undefined
      }
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={intensity}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {fills?.map((c, i) => (
        <View
          key={i}
          style={[StyleSheet.absoluteFill, { backgroundColor: c }]}
        />
      ))}
      {shine && size.w > 0 && size.h > 0 ? (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.w}
          height={size.h}
          pointerEvents="none"
        >
          <Defs>
            {/* The dim notch (offset 0.5) must land on the top-right and
                bottom-left corners. react-native-svg orients gradient iso-lines
                in *screen* space, so for a wide pill a (0,0)→(1,1) vector would
                put the notch at top/bottom-middle. Aiming the vector along
                (h, w) in userSpaceOnUse instead makes 0.5 pass exactly through
                those two corners at any aspect ratio (TL→0, BR→1, TR=BL→0.5). */}
            <LinearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={(2 * size.w * size.h * size.h) / (size.w * size.w + size.h * size.h)}
              y2={(2 * size.w * size.w * size.h) / (size.w * size.w + size.h * size.h)}
            >
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.5} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0.75}
            y={0.75}
            width={size.w - 1.5}
            height={size.h - 1.5}
            rx={r}
            ry={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});

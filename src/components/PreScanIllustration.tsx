import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

/**
 * The face-scan illustration on Pre-scan — Figma 5251:59410, `Layer_1`.
 *
 * 🔑 This REPLACES the type-cards fan we used to show here. The design never
 * had that image on this screen, which quietly resolves a live problem: the
 * fan is `prescan-types.png`, and its Type taglines are the OLD drifted ones
 * that #148 corrected in code. Using the frame's artwork drops the stale asset
 * from the screen entirely.
 *
 * Seven stroked paths, each with its own top-to-bottom gradient fading to 40%
 * — that fade is why this is inlined rather than exported flat.
 */
export function PreScanIllustration({
  width = 198.884,
  height = 191.286,
  color = "#FAFDFE",
}: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 198.884 191.286" fill="none">
      <Defs>
        <LinearGradient id="paint0_linear_0_79" x1="101.556" y1="16.4145" x2="101.556" y2="165.933" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="paint1_linear_0_79" x1="114.729" y1="156.953" x2="114.729" y2="180.295" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="paint2_linear_0_79" x1="22.3871" y1="2.0315" x2="22.3871" y2="43.474" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="paint3_linear_0_79" x1="22.3871" y1="156.892" x2="22.3871" y2="189.254" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="paint4_linear_0_79" x1="176.507" y1="156.892" x2="176.507" y2="189.254" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="paint5_linear_0_79" x1="176.507" y1="2.0315" x2="176.507" y2="43.474" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
        <LinearGradient id="paint6_linear_0_79" x1="98.223" y1="100.884" x2="98.223" y2="101.884" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.4" />
        </LinearGradient>
      </Defs>
      <Path
        d="M46.7244 165.933C50.5639 157.888 52.311 149.335 52.7376 141.006C53.1439 133.226 51.1327 125.526 47.4354 118.68C39.8985 104.683 35.4496 88.8983 35.4496 75.3685C35.4496 42.1536 59.8885 16.4145 95.0334 16.4145C130.178 16.4145 154.211 38.7406 154.211 75.3685V79.3909C154.211 82.2147 154.922 84.9978 156.263 87.4763L166.867 106.999C168.838 110.615 166.989 115.125 163.068 116.344L156.527 118.355C155.349 118.721 154.719 120.021 155.206 121.179L156.303 123.82C156.974 125.425 156.303 127.273 154.8 128.086L152.057 129.569C151.448 129.894 151.306 130.727 151.793 131.235L153.825 133.429C155.044 134.749 155.023 136.801 153.764 138.081L151.265 140.641L151.428 146.735C151.631 153.784 145.882 159.554 138.832 159.391C122.621 158.985 96.5367 155.227 93.0019 135.46"
        stroke={`url(#paint0_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M118.518 156.953C115.145 162.885 112.098 170.666 110.94 180.295"
        stroke={`url(#paint1_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2.03149 43.474V11.031C2.03149 6.05386 6.07417 2.0315 11.031 2.0315H42.7427"
        stroke={`url(#paint2_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2.03149 156.892V180.255C2.03149 185.232 6.07417 189.254 11.031 189.254H42.7427"
        stroke={`url(#paint3_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M196.852 156.892V180.255C196.852 185.232 192.83 189.254 187.853 189.254H156.161"
        stroke={`url(#paint4_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M156.161 2.0315H187.853C192.83 2.0315 196.852 6.05386 196.852 11.031V43.474"
        stroke={`url(#paint5_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.602 100.884H180.844"
        stroke={`url(#paint6_linear_0_79)`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

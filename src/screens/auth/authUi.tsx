import React from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

// Shared visual language for the auth screens (login + password reset). The
// login screen predates this module; these constants and marks are the same
// ones it uses, extracted so the reset screens match it exactly.
export const MAROON = "#361416";
export const BONE = "#F3EFE3";
export const WHITE = "#FAFDFE";
export const TEXT_ALT = "#7E6869";
export const GHOST = "rgba(250,253,254,0.24)";
export const ERROR_RED = "#FF8A8A";

export const BG_LOGO = require("../../../assets/images/login-logo-faded.png");

export function ResetWordmark() {
  return (
    <Svg width={72} height={24} viewBox="0 0 72 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.6847 3.37491C25.2171 3.37491 27.6729 7.35293 27.6729 12.1084V13.1966H16.2347C16.5145 15.31 17.6025 16.4289 19.9024 16.4289C21.5496 16.4289 22.451 15.838 22.7617 14.7501H27.6106C26.9269 18.3246 23.9117 20.2834 19.8401 20.2834C14.9293 20.2833 11.4173 17.3303 11.4173 12.0153C11.4173 7.25986 14.1524 3.37499 19.6847 3.37491ZM19.6847 7.22937C17.7576 7.22943 16.7008 8.16141 16.3278 10.1196H22.8863C22.7931 8.19255 21.6119 7.22937 19.6847 7.22937Z"
        fill={WHITE}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.2582 3.34478C57.7906 3.3448 60.2463 7.32343 60.2463 12.0789V13.1664H48.8082C49.0881 15.2799 50.1756 16.3994 52.4758 16.3995C54.123 16.3995 55.0251 15.8086 55.3358 14.7207H60.1841C59.5003 18.295 56.4858 20.2532 52.4142 20.2533L51.9575 20.2446C47.2867 20.0663 43.9908 17.1344 43.9908 11.9858C43.9908 7.23033 46.7257 3.34478 52.2582 3.34478ZM52.2582 7.19924C50.3313 7.19924 49.2749 8.1314 48.9019 10.0894H55.4597C55.3665 8.16259 54.1851 7.19925 52.2582 7.19924Z"
        fill={WHITE}
      />
      <Path
        d="M35.5874 3.33406C40.0942 3.33413 42.9223 5.13692 43.1704 9.02201H38.353C38.1976 7.71656 37.1718 7.03317 35.4314 7.03317C34.0329 7.0332 33.3495 7.49898 33.3495 8.27603C33.3495 9.05315 34.0641 9.45733 35.4006 9.67491L38.5707 10.2033C41.0572 10.6072 43.4195 11.6953 43.4195 14.8968C43.4195 18.4399 40.5596 20.2425 36.3327 20.2425L35.9637 20.2379C32.154 20.1412 28.6134 18.5346 28.2521 14.7408H33.2249C33.4735 15.8284 34.4683 16.5441 36.4265 16.5441C37.9179 16.5441 38.6643 16.1088 38.6644 15.3321C38.6644 14.4305 37.7317 14.182 36.4265 13.9954L34.1885 13.6533C31.5466 13.2493 28.6867 12.2856 28.6867 8.58674C28.6868 5.29217 31.0805 3.33406 35.5874 3.33406Z"
        fill={WHITE}
      />
      <Path
        d="M6.15794 6.76732C6.59309 4.96456 7.96057 3.7212 9.91866 3.72111H11.1796V9.17402H6.34411V19.9365H1.37134V3.72111H6.15794V6.76732Z"
        fill={WHITE}
      />
      <Path
        d="M65.6062 4.73897H70.6285V10.1912H69.3675C67.4096 10.1912 66.042 9.04662 65.6068 7.24411V15.5323L70.6285 15.4827L70.6278 15.4834V19.9044H66.1097C62.722 19.9043 61.0794 18.2883 61.0794 14.8693V1.37134H65.6062V4.73897Z"
        fill={WHITE}
      />
    </Svg>
  );
}

export function BackArrow() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M11 19l-7-7 7-7"
        stroke={WHITE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EyeIcon({ off }: { off: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke={TEXT_ALT}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke={TEXT_ALT}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {off ? (
        <Path
          d="M3 3l18 18"
          stroke={TEXT_ALT}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}

/**
 * The shared frame for the password-reset screens: maroon background, faded
 * corner logo, bottom darken gradient, safe area, and a top bar with a back
 * button and the wordmark. Children render inside a KeyboardAvoidingView
 * below the top bar. Mirrors the login screen's layout so the flow feels
 * continuous.
 */
export function AuthScaffold({
  onBack,
  loading = false,
  children,
}: {
  onBack: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.root}>
      <Image source={BG_LOGO} style={styles.bgLogo} resizeMode="contain" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="authScaffoldBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.44" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.82" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#authScaffoldBg)"
          />
        </Svg>
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onBack}
              hitSlop={10}
              style={styles.iconBtn}
            >
              <BackArrow />
            </TouchableOpacity>
            <ResetWordmark />
            <View style={styles.iconBtn} />
          </View>

          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={WHITE} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },
  keyboardView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  bgLogo: {
    position: "absolute",
    width: 460,
    height: 580,
    left: -120,
    bottom: -120,
    opacity: 0.12,
    transform: [{ rotate: "-17deg" }],
    pointerEvents: "none",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});

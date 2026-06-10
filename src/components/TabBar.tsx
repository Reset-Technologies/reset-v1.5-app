import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
import Svg, { Path, Mask, Rect, Defs } from "react-native-svg";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/MainNavigator";
import { K } from "../constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppPalette } from "../hooks/useAppPalette";

// Figma: Reset v1.5 / Bottom Nav (node 1324:14600)
// Paths exported directly from Figma — left D, right D, and a center
// "subtract" rect whose top edge curves down to follow the Ester button.
const PILL_W = 250;
const PILL_H = 50;
const ESTER_SIZE = 40;
// Ester center sits above the pill. Notch dips to y=28.5 in the 50-tall pill.
// Top at -15 puts the button's bottom at y=25 — ~3.5px gap above the notch.
const ESTER_TOP_OFFSET = -15;
// Visual padding above and below the pill within the nav wrapper.
const NAV_PAD = 10;

const ESTER_LOGO = require("../../assets/images/ester-logo.png");

const SUBTRACT_PATH =
  "M81 0.5L81.4268 0.505859C85.8233 0.625716 89.7052 2.58878 93.0625 5.40332C96.5257 8.30677 99.4596 12.1402 101.865 15.874C106.76 23.4711 115.293 28.5 125 28.5C134.707 28.5 143.24 23.4711 148.135 15.874C150.54 12.1402 153.474 8.30677 156.938 5.40332C160.403 2.49805 164.428 0.5 169 0.5H170.5V49.5H79.5V0.5H81Z";
const LEFT_D_PATH =
  "M1 25C1 11.7452 11.7452 1 25 1H80V49H25C11.7452 49 1 38.2548 1 25Z";
const LEFT_D_STROKE_PATH =
  "M0 25C0 11.1929 11.1929 0 25 0H80V2H25C12.2975 2 2 12.2975 2 25H0ZM80 50H25C11.1929 50 0 38.8071 0 25H2C2 37.7025 12.2975 48 25 48H80V50ZM25 50C11.1929 50 0 38.8071 0 25C0 11.1929 11.1929 0 25 0V2C12.2975 2 2 12.2975 2 25C2 37.7025 12.2975 48 25 48V50ZM25 48M80 1V49V1";
const RIGHT_D_PATH =
  "M170 1H225C238.255 1 249 11.7452 249 25C249 38.2548 238.255 49 225 49H170V1Z";
const RIGHT_D_STROKE_PATH =
  "M170 0H225C238.807 0 250 11.1929 250 25H248C248 12.2975 237.703 2 225 2H170V0ZM250 25C250 38.8071 238.807 50 225 50H170V48H225C237.703 48 248 37.7025 248 25H250ZM248 25M170 49V1V49M225 0C238.807 0 250 11.1929 250 25C250 38.8071 238.807 50 225 50V48C237.703 48 248 37.7025 248 25C248 12.2975 237.703 2 225 2V0Z";

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={22} viewBox="0 0 15 17" fill="none">
      <Path
        d="M1.5 14.9423H4.84625V9.90375C4.84625 9.64775 4.93283 9.43308 5.106 9.25975C5.27933 9.08658 5.494 9 5.75 9H9.25C9.506 9 9.72067 9.08658 9.894 9.25975C10.0672 9.43308 10.1538 9.64775 10.1538 9.90375V14.9423H13.5V6.096C13.5 6.04483 13.4888 5.99842 13.4663 5.95675C13.4439 5.91508 13.4135 5.87817 13.375 5.846L7.68275 1.56725C7.63142 1.52242 7.5705 1.5 7.5 1.5C7.4295 1.5 7.36858 1.52242 7.31725 1.56725L1.625 5.846C1.5865 5.87817 1.55608 5.91508 1.53375 5.95675C1.51125 5.99842 1.5 6.04483 1.5 6.096V14.9423ZM0 14.9423V6.096C0 5.80983 0.0639998 5.53875 0.192 5.28275C0.320166 5.02658 0.497167 4.81567 0.723 4.65L6.4155 0.361501C6.73133 0.120501 7.09233 0 7.4985 0C7.90467 0 8.26667 0.120501 8.5845 0.361501L14.277 4.65C14.5028 4.81567 14.6798 5.02658 14.808 5.28275C14.936 5.53875 15 5.80983 15 6.096V14.9423C15 15.3513 14.8523 15.7035 14.5568 15.999C14.2613 16.2945 13.909 16.4423 13.5 16.4423H9.55775C9.30158 16.4423 9.08692 16.3556 8.91375 16.1823C8.74042 16.0091 8.65375 15.7944 8.65375 15.5383V10.5H6.34625V15.5383C6.34625 15.7944 6.25958 16.0091 6.08625 16.1823C5.91308 16.3556 5.69842 16.4423 5.44225 16.4423H1.5C1.091 16.4423 0.73875 16.2945 0.44325 15.999C0.14775 15.7035 0 15.3513 0 14.9423Z"
        fill={color}
      />
    </Svg>
  );
}

function AccountIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 19 19" fill="none">
      <Path
        d="M3.523 14.7923C4.373 14.1616 5.299 13.6635 6.301 13.298C7.30283 12.9327 8.36917 12.75 9.5 12.75C10.6308 12.75 11.6972 12.9327 12.699 13.298C13.701 13.6635 14.627 14.1616 15.477 14.7923C16.0987 14.1089 16.5912 13.3179 16.9548 12.4192C17.3183 11.5206 17.5 10.5475 17.5 9.5C17.5 7.28333 16.7208 5.39583 15.1625 3.8375C13.6042 2.27917 11.7167 1.5 9.5 1.5C7.28333 1.5 5.39583 2.27917 3.8375 3.8375C2.27917 5.39583 1.5 7.28333 1.5 9.5C1.5 10.5475 1.68175 11.5206 2.04525 12.4192C2.40875 13.3179 2.90133 14.1089 3.523 14.7923ZM7.1905 9.3095C6.5635 8.68267 6.25 7.91283 6.25 7C6.25 6.08717 6.5635 5.31733 7.1905 4.6905C7.81733 4.0635 8.58717 3.75 9.5 3.75C10.4128 3.75 11.1827 4.0635 11.8095 4.6905C12.4365 5.31733 12.75 6.08717 12.75 7C12.75 7.91283 12.4365 8.68267 11.8095 9.3095C11.1827 9.9365 10.4128 10.25 9.5 10.25C8.58717 10.25 7.81733 9.9365 7.1905 9.3095ZM9.5 19C8.18083 19 6.94333 18.7519 5.7875 18.2558C4.63167 17.7596 3.62625 17.0839 2.77125 16.2288C1.91608 15.3738 1.24042 14.3683 0.74425 13.2125C0.248083 12.0567 0 10.8192 0 9.5C0 8.18083 0.248083 6.94333 0.74425 5.7875C1.24042 4.63167 1.91608 3.62625 2.77125 2.77125C3.62625 1.91608 4.63167 1.24042 5.7875 0.74425C6.94333 0.248084 8.18083 0 9.5 0C10.8192 0 12.0567 0.248084 13.2125 0.74425C14.3683 1.24042 15.3738 1.91608 16.2288 2.77125C17.0839 3.62625 17.7596 4.63167 18.2558 5.7875C18.7519 6.94333 19 8.18083 19 9.5C19 10.8192 18.7519 12.0567 18.2558 13.2125C17.7596 14.3683 17.0839 15.3738 16.2288 16.2288C15.3738 17.0839 14.3683 17.7596 13.2125 18.2558C12.0567 18.7519 10.8192 19 9.5 19ZM12.1105 17.0645C12.9483 16.774 13.6923 16.3679 14.3422 15.8462C13.6923 15.3436 12.958 14.9519 12.1395 14.6712C11.3208 14.3904 10.441 14.25 9.5 14.25C8.559 14.25 7.67758 14.3888 6.85575 14.6663C6.03392 14.9439 5.30125 15.3372 4.65775 15.8462C5.30775 16.3679 6.05167 16.774 6.8895 17.0645C7.72733 17.3548 8.5975 17.5 9.5 17.5C10.4025 17.5 11.2727 17.3548 12.1105 17.0645ZM10.748 8.248C11.0827 7.9135 11.25 7.4975 11.25 7C11.25 6.5025 11.0827 6.0865 10.748 5.752C10.4135 5.41733 9.9975 5.25 9.5 5.25C9.0025 5.25 8.5865 5.41733 8.252 5.752C7.91733 6.0865 7.75 6.5025 7.75 7C7.75 7.4975 7.91733 7.9135 8.252 8.248C8.5865 8.58267 9.0025 8.75 9.5 8.75C9.9975 8.75 10.4135 8.58267 10.748 8.248Z"
        fill={color}
      />
    </Svg>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { innerBg, evening } = useAppPalette();
  const stackNavigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  // Wrapper paints a shade slightly different from the page bg so the nav
  // reads as a distinct bar. Pill stays white in both modes (Figma).
  // Evening: page is #513436; wrapper is a touch darker + more maroon.
  const wrapperBg = evening ? "#3F1719" : K.bone;
  const pillBg = "#FAFDFE";
  const pillStroke = "#C3B9BA";
  const iconActive = K.brown;
  const iconInactive = "#7E6869";
  const activeGhostBg = "rgba(54, 20, 22, 0.12)";
  const esterBg = K.brown;

  const homeIndex = state.routes.findIndex((r) => r.name === "Home");
  const profileIndex = state.routes.findIndex((r) => r.name === "Profile");
  const isHomeFocused = state.index === homeIndex;
  const isProfileFocused = state.index === profileIndex;

  const onTabPress = (index: number, routeName: string, routeKey: string) => {
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          // Symmetric visual padding around the pill+Ester. Top adds the
          // Ester overshoot so the gap above the Ester button equals the
          // gap below the pill; bottom adds the safe-area inset.
          paddingTop: NAV_PAD + Math.abs(ESTER_TOP_OFFSET),
          paddingBottom: NAV_PAD + insets.bottom,
          backgroundColor: wrapperBg,
        },
      ]}
    >
      <View style={styles.pill}>
        <Svg
          width={PILL_W}
          height={PILL_H}
          viewBox={`0 0 ${PILL_W} ${PILL_H}`}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <Mask
              id="leftMask"
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={80}
              height={50}
            >
              <Rect width={80} height={50} fill="white" />
              <Path d={LEFT_D_PATH} fill="black" />
            </Mask>
            <Mask
              id="rightMask"
              maskUnits="userSpaceOnUse"
              x={170}
              y={0}
              width={80}
              height={50}
            >
              <Rect x={170} width={80} height={50} fill="white" />
              <Path d={RIGHT_D_PATH} fill="black" />
            </Mask>
          </Defs>
          <Path d={SUBTRACT_PATH} fill={pillBg} stroke={pillStroke} />
          <Path d={LEFT_D_PATH} fill={pillBg} />
          <Path d={LEFT_D_STROKE_PATH} fill={pillStroke} mask="url(#leftMask)" />
          <Path d={RIGHT_D_PATH} fill={pillBg} />
          <Path
            d={RIGHT_D_STROKE_PATH}
            fill={pillStroke}
            mask="url(#rightMask)"
          />
        </Svg>

        <TouchableOpacity
          style={[styles.tabHalf, styles.tabHalfLeft]}
          activeOpacity={0.7}
          onPress={() => {
            const route = state.routes[homeIndex];
            onTabPress(homeIndex, route.name, route.key);
          }}
          accessibilityRole="button"
          accessibilityState={isHomeFocused ? { selected: true } : {}}
          accessibilityLabel="Home"
        >
          <View
            style={[
              styles.iconPill,
              isHomeFocused && { backgroundColor: activeGhostBg },
            ]}
          >
            <HomeIcon color={isHomeFocused ? iconActive : iconInactive} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabHalf, styles.tabHalfRight]}
          activeOpacity={0.7}
          onPress={() => {
            const route = state.routes[profileIndex];
            onTabPress(profileIndex, route.name, route.key);
          }}
          accessibilityRole="button"
          accessibilityState={isProfileFocused ? { selected: true } : {}}
          accessibilityLabel="Profile"
        >
          <View
            style={[
              styles.iconPill,
              isProfileFocused && { backgroundColor: activeGhostBg },
            ]}
          >
            <AccountIcon color={isProfileFocused ? iconActive : iconInactive} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.esterButton, { backgroundColor: esterBg }]}
          activeOpacity={0.85}
          onPress={() =>
            stackNavigation.navigate("EsterChat", { context: "general" })
          }
          accessibilityRole="button"
          accessibilityLabel="Ester"
        >
          <Image
            source={ESTER_LOGO}
            style={styles.esterLogo}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  pill: {
    width: PILL_W,
    height: PILL_H,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tabHalf: {
    position: "absolute",
    top: 0,
    height: PILL_H,
    width: (PILL_W - 90) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tabHalfLeft: {
    left: 0,
  },
  tabHalfRight: {
    right: 0,
  },
  iconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    // The active-icon background is ~30px tall. A concrete radius ≥ half that
    // keeps the full oval on iOS while staying a value Android reliably rounds
    // — Android renders very large radii (e.g. 999) on small views as squares.
    borderRadius: 18,
    overflow: "hidden",
  },
  esterButton: {
    position: "absolute",
    top: ESTER_TOP_OFFSET,
    left: (PILL_W - ESTER_SIZE) / 2,
    width: ESTER_SIZE,
    height: ESTER_SIZE,
    borderRadius: ESTER_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  esterLogo: {
    width: ESTER_SIZE + 4,
    height: ESTER_SIZE + 4,
  },
});

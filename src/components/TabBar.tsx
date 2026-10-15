import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
import Svg, { Path, Rect, G } from "react-native-svg";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/MainNavigator";
import { K } from "../constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppPalette } from "../hooks/useAppPalette";
import { useAiConsentGate } from "../hooks/useAiConsentGate";

// Figma: Reset v1.5 / Bottom Nav (node 1324:14600)
// Paths exported directly from Figma — left D, right D, and a center
// "subtract" rect whose top edge curves down to follow the Ester button.
// Lang's Bottom Nav (Figma 1324:14600) is a 250x50 pill: a rounded "D" cap at
// each end holding ONE tab, and a 90-wide middle piece whose top edge dips into
// the notch the Ester button sits in.
//
// 🔑 A THIRD tab does not fit that shape, so the pill GROWS BY ONE SLOT: a
// straight section is inserted between the left cap and the notch piece, and the
// notch + right cap shift right by its width. A stadium's straight run can be
// extended without distorting anything, so Lang's caps and her notch are still
// drawn from her exported paths — nothing here is stretched, scaled or redrawn.
// (Her four-tab bar is a different component entirely — labelled tabs, no notch,
// Ester as a tab. Bryan deferred it 2026-10-15: "add Meals to the current tab
// bar now ... we can move to the new nav once Progress, Account, and the Ester
// decision are ready.")
const SLOT_W = 80; // one tab slot — Lang's frames "1" and "4" are both 80 wide
const NOTCH_W = 90; // the middle piece, SUBTRACT_PATH, x 79.5..170.5
const PILL_H = 50;
/** The pill exactly as Lang drew it: cap + notch + cap. */
const BASE_PILL_W = SLOT_W * 2 + NOTCH_W;
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

// Figma `restaurant` — the SAME glyph Lang puts in the Meals tab of her new nav,
// and the same path PaywallIcons.MealsIcon draws (that copy is wrapped in a glow
// filter for the paywall, so the bare path is repeated here next to its two
// siblings rather than imported through that wrapper).
// The glyph's own bounds are x 7.1..25.766, y 7.1..33.1 — narrower than it is
// tall, like Material's. The viewBox pads the width by 0.12 a side so 15.8x22
// scales it EVENLY and it stands exactly as tall as the Home and Account icons.
function MealsIcon({ color }: { color: string }) {
  return (
    <Svg width={15.8} height={22} viewBox="6.98 7.1 18.909 26" fill="none">
      <Path
        d="M10.946 16.254V8.1C10.946 7.81667 11.0419 7.57922 11.2337 7.38767C11.4254 7.19589 11.663 7.1 11.9463 7.1C12.2299 7.1 12.4673 7.19589 12.6587 7.38767C12.8502 7.57922 12.946 7.81667 12.946 8.1V16.254H14.7923V8.1C14.7923 7.81667 14.8881 7.57922 15.0797 7.38767C15.2714 7.19589 15.5091 7.1 15.7927 7.1C16.076 7.1 16.3134 7.19589 16.505 7.38767C16.6963 7.57922 16.792 7.81667 16.792 8.1V16.254C16.792 17.4471 16.4216 18.474 15.6807 19.3347C14.9396 20.1953 14.028 20.7428 12.946 20.977V32.1C12.946 32.3833 12.8501 32.6208 12.6583 32.8123C12.4666 33.0041 12.229 33.1 11.9457 33.1C11.6621 33.1 11.4247 33.0041 11.2333 32.8123C11.0418 32.6208 10.946 32.3833 10.946 32.1V20.977C9.864 20.7428 8.95244 20.1953 8.21133 19.3347C7.47044 18.474 7.1 17.4471 7.1 16.254V8.1C7.1 7.81667 7.19589 7.57922 7.38767 7.38767C7.57922 7.19589 7.81678 7.1 8.10033 7.1C8.38367 7.1 8.62111 7.19589 8.81267 7.38767C9.004 7.57922 9.09967 7.81667 9.09967 8.1V16.254H10.946ZM23.7663 22.4333H21.3323C20.9877 22.4333 20.7003 22.3179 20.4703 22.087C20.2406 21.8559 20.1257 21.5697 20.1257 21.2283V13.4333C20.1257 11.758 20.6102 10.2837 21.5793 9.01033C22.5484 7.73678 23.533 7.1 24.533 7.1C24.9074 7.1 25.2067 7.23422 25.4307 7.50267C25.6544 7.77089 25.7663 8.10767 25.7663 8.513V32.1C25.7663 32.3833 25.6704 32.6208 25.4787 32.8123C25.2871 33.0041 25.0496 33.1 24.766 33.1C24.4827 33.1 24.2452 33.0041 24.0537 32.8123C23.8621 32.6208 23.7663 32.3833 23.7663 32.1V22.4333Z"
        fill={color}
      />
    </Svg>
  );
}

/** Route name -> glyph. A tab with no entry here renders no icon, which is a
 *  loud enough failure to catch in a walk. */
const TAB_ICONS: Record<string, (props: { color: string }) => React.ReactElement> = {
  Home: HomeIcon,
  Meals: MealsIcon,
  Profile: AccountIcon,
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { innerBg, evening } = useAppPalette();
  const { runWithAiConsent } = useAiConsentGate();
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

  // Every tab but the last sits left of the Ester notch; the last one takes the
  // right cap. With three tabs that reads Home · Meals · (Ester) · Profile at
  // centres 40 · 120 · 205 · 290 — even 80/85/85 spacing across the bar.
  const leftCount = Math.max(state.routes.length - 1, 1);
  const shift = (leftCount - 1) * SLOT_W;
  const pillW = BASE_PILL_W + shift;
  const slots = state.routes.map((route, index) => ({
    route,
    index,
    focused: state.index === index,
    Icon: TAB_ICONS[route.name],
    // Left slots run 0, 80, …; whatever is last lands in the right cap.
    left: index < leftCount ? index * SLOT_W : shift + BASE_PILL_W - SLOT_W,
  }));

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
      <View style={[styles.pill, { width: pillW }]}>
        <Svg
          width={pillW}
          height={PILL_H}
          viewBox={`0 0 ${pillW} ${PILL_H}`}
          style={StyleSheet.absoluteFill}
        >
          {/* 🔑 NO MASKS. Lang's two stroke paths are 2-unit BANDS, and her
              export masked each one down to the outer unit. Painting the cap's
              FILL on top of its own band does exactly the same thing — the fill
              starts 1 unit in — and it leaves this file with nothing but plain
              paths, which matters because the right half has to be moved: a
              mask on a transformed path is resolved in the transformed space,
              which is the kind of SVG detail iOS and Android disagree about.
              ▶ Order is the whole trick here. Every piece is drawn before the
              neighbour that has to cover its stroked edge:
                notch piece → right band → right fill → inserted → left band →
                left fill. SUBTRACT_PATH is stroked all the way round, so both
                its vertical edges are seams; each one is painted over by the
                fill that abuts it. Draw them the other way and you get a rule
                down the middle of the bar — I shipped that to the simulator
                once and it is plainly visible. */}
          {/* Notch piece + right cap, moved across by the inserted width. */}
          <G transform={`translate(${shift}, 0)`}>
            <Path d={SUBTRACT_PATH} fill={pillBg} stroke={pillStroke} />
            <Path d={RIGHT_D_STROKE_PATH} fill={pillStroke} />
            <Path d={RIGHT_D_PATH} fill={pillBg} />
          </G>
          {/* One straight section per tab beyond the two Lang drew. Fill
              y 1..49 between a 1-unit rule above and below is exactly what her
              caps show, so the join is invisible. */}
          {Array.from({ length: leftCount - 1 }).map((_, i) => (
            <React.Fragment key={i}>
              <Rect
                x={SLOT_W + i * SLOT_W}
                y={1}
                width={SLOT_W}
                height={PILL_H - 2}
                fill={pillBg}
              />
              <Rect
                x={SLOT_W + i * SLOT_W}
                y={0}
                width={SLOT_W}
                height={1}
                fill={pillStroke}
              />
              <Rect
                x={SLOT_W + i * SLOT_W}
                y={PILL_H - 1}
                width={SLOT_W}
                height={1}
                fill={pillStroke}
              />
            </React.Fragment>
          ))}
          <Path d={LEFT_D_STROKE_PATH} fill={pillStroke} />
          <Path d={LEFT_D_PATH} fill={pillBg} />
        </Svg>

        {slots.map(({ route, index, focused, Icon, left }) => (
          <TouchableOpacity
            key={route.key}
            style={[styles.tab, { left }]}
            activeOpacity={0.7}
            onPress={() => onTabPress(index, route.name, route.key)}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={route.name}
          >
            <View
              style={[
                styles.iconPill,
                focused && { backgroundColor: activeGhostBg },
              ]}
            >
              {Icon ? (
                <Icon color={focused ? iconActive : iconInactive} />
              ) : null}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.esterButton,
            { backgroundColor: esterBg, left: shift + (BASE_PILL_W - ESTER_SIZE) / 2 },
          ]}
          activeOpacity={0.85}
          onPress={() =>
            runWithAiConsent(() =>
              stackNavigation.navigate("EsterChat", { context: "general" }),
            )
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
    // width is set at render time — it grows with the number of tabs.
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
  tab: {
    position: "absolute",
    top: 0,
    height: PILL_H,
    width: SLOT_W,
    alignItems: "center",
    justifyContent: "center",
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
    // left is set at render time — the button rides the notch, not the centre.
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

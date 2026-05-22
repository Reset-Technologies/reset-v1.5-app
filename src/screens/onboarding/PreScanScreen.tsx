import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "PreScan">;

const TYPES_GRAPHIC = require("../../../assets/images/onboarding/prescan-types.png");
// The exported PNG is 1206×1002. Render it at full screen width so the fanned
// cards reach (and bleed past) the screen edges; explicit numeric dimensions
// avoid <Image> falling back to its (huge) intrinsic point size.
const SCREEN_W = Dimensions.get("window").width;
const GRAPHIC_W = SCREEN_W;
const GRAPHIC_H = Math.round(SCREEN_W * (880 / 1206));

const WHITE = "#FAFDFE";
const BONE = K.bone;
const MAROON = K.brown;

// Feature-chip icons (paths exported from the Figma "Pre Scan" frame, 24px).
const ICON = WHITE;
function HeartRateIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 19 17.048" fill="none">
      <Path
        d="M9.5 17.048C9.2705 17.048 9.04708 17.0051 8.82975 16.9192C8.61242 16.8334 8.42108 16.7046 8.25575 16.5328L1.748 10C1.16467 9.41667 0.7275 8.75483 0.4365 8.0145C0.1455 7.274 0 6.50825 0 5.71725C0 4.14175 0.503833 2.795 1.5115 1.677C2.51917 0.558999 3.76658 0 5.25375 0C5.99608 0 6.70217 0.150333 7.372 0.450999C8.042 0.751666 8.63917 1.1725 9.1635 1.7135L9.5 2.06925L9.81725 1.73275C10.3378 1.17892 10.9346 0.751666 11.6078 0.450999C12.2808 0.150333 12.9852 0 13.7212 0C15.2084 0 16.46 0.558999 17.476 1.677C18.492 2.795 19 4.13342 19 5.69225C19 6.48975 18.8519 7.25867 18.5557 7.999C18.2596 8.7395 17.825 9.40142 17.252 9.98475L10.7193 16.5328C10.5474 16.7046 10.3586 16.8334 10.1527 16.9192C9.94708 17.0051 9.7295 17.048 9.5 17.048ZM10.5 4.7885C10.6282 4.7885 10.748 4.81892 10.8595 4.87975C10.9712 4.94075 11.059 5.02192 11.123 5.12325L12.8902 7.7885H17.002C17.1763 7.45383 17.3071 7.11025 17.3943 6.75775C17.4814 6.40525 17.5218 6.05008 17.5155 5.69225C17.4885 4.54225 17.1148 3.56117 16.3943 2.749C15.6738 1.93683 14.7827 1.53075 13.7212 1.53075C13.1917 1.53075 12.6798 1.63558 12.1855 1.84525C11.6913 2.05492 11.2628 2.361 10.9 2.7635L10.1095 3.6135C10.0327 3.70717 9.94042 3.77675 9.83275 3.82225C9.72508 3.86775 9.61417 3.8905 9.5 3.8905C9.38583 3.8905 9.27333 3.86608 9.1625 3.81725C9.05167 3.76858 8.95267 3.70067 8.8655 3.6135L8.075 2.7635C7.71217 2.361 7.28617 2.04975 6.797 1.82975C6.308 1.60992 5.79358 1.5 5.25375 1.5C4.19225 1.5 3.30125 1.91125 2.58075 2.73375C1.86025 3.55608 1.5 4.54225 1.5 5.69225C1.5 6.05642 1.541 6.41317 1.623 6.7625C1.70517 7.11183 1.83017 7.45383 1.998 7.7885H6.5C6.62817 7.7885 6.74642 7.81892 6.85475 7.87975C6.96308 7.94075 7.04933 8.02192 7.1135 8.12325L8.277 9.85575L9.7905 5.3155C9.84433 5.16033 9.93467 5.03375 10.0615 4.93575C10.1885 4.83758 10.3347 4.7885 10.5 4.7885ZM10.723 7.22125L9.2095 11.7615C9.15567 11.9167 9.06117 12.0432 8.926 12.1412C8.79067 12.2394 8.64033 12.2885 8.475 12.2885C8.34683 12.2885 8.22858 12.2581 8.12025 12.1972C8.01192 12.1362 7.92567 12.0551 7.8615 11.9537L6.08475 9.2885H3.1595L9.325 15.4635C9.35833 15.4968 9.3875 15.5177 9.4125 15.526C9.4375 15.5343 9.46667 15.5385 9.5 15.5385C9.53333 15.5385 9.5625 15.5343 9.5875 15.526C9.6125 15.5177 9.64167 15.4968 9.675 15.4635L15.825 9.2885H12.5C12.3718 9.2885 12.252 9.25642 12.1405 9.19225C12.0288 9.12825 11.9358 9.04558 11.8615 8.94425L10.723 7.22125Z"
        fill={ICON}
      />
    </Svg>
  );
}
function VascularAgeIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 18.4135 18.6923" fill="none">
      <Path
        d="M12 15.6538L17.1423 10.5115C17.2808 10.373 17.4548 10.3022 17.6645 10.299C17.874 10.2958 18.0512 10.3667 18.1962 10.5115C18.3411 10.6563 18.4135 10.832 18.4135 11.0385C18.4135 11.2448 18.3411 11.4204 18.1962 11.5653L12.6328 17.1288C12.4519 17.3096 12.241 17.4 12 17.4C11.759 17.4 11.5481 17.3096 11.3673 17.1288L8.623 14.3845C8.48467 14.246 8.41383 14.072 8.4105 13.8625C8.40733 13.6528 8.47817 13.4756 8.623 13.3308C8.768 13.1859 8.94367 13.1135 9.15 13.1135C9.35633 13.1135 9.532 13.1859 9.677 13.3308L12 15.6538ZM1.80775 18.6923C1.30908 18.6923 0.883083 18.5157 0.52975 18.1625C0.176583 17.8092 0 17.3832 0 16.8845V3.5C0 3.00133 0.176583 2.57533 0.52975 2.222C0.883083 1.86883 1.30908 1.69225 1.80775 1.69225H6.2135C6.352 1.20508 6.635 0.80125 7.0625 0.48075C7.49 0.16025 7.96917 0 8.5 0C9.05133 0 9.53817 0.16025 9.9605 0.48075C10.383 0.80125 10.6635 1.20508 10.802 1.69225H15.1923C15.6909 1.69225 16.1169 1.86883 16.4703 2.222C16.8234 2.57533 17 3.00133 17 3.5V7.44225C17 7.65508 16.9282 7.83325 16.7845 7.97675C16.641 8.12042 16.4628 8.19225 16.25 8.19225C16.0372 8.19225 15.859 8.12042 15.7155 7.97675C15.5718 7.83325 15.5 7.65508 15.5 7.44225V3.5C15.5 3.423 15.4679 3.3525 15.4038 3.2885C15.3398 3.22433 15.2693 3.19225 15.1923 3.19225H13V4.90375C13 5.16142 12.9138 5.3765 12.7413 5.549C12.5689 5.72133 12.3538 5.8075 12.096 5.8075H4.904C4.64617 5.8075 4.43108 5.72133 4.25875 5.549C4.08625 5.3765 4 5.16142 4 4.90375V3.19225H1.80775C1.73075 3.19225 1.66025 3.22433 1.59625 3.2885C1.53208 3.3525 1.5 3.423 1.5 3.5V16.8845C1.5 16.9615 1.53208 17.032 1.59625 17.096C1.66025 17.1602 1.73075 17.1923 1.80775 17.1923H6.75C6.96283 17.1923 7.141 17.2641 7.2845 17.4078C7.42817 17.5513 7.5 17.7294 7.5 17.9423C7.5 18.1551 7.42817 18.3333 7.2845 18.4768C7.141 18.6204 6.96283 18.6923 6.75 18.6923H1.80775ZM9.14525 3.049C9.31758 2.8765 9.40375 2.66142 9.40375 2.40375C9.40375 2.14608 9.31758 1.931 9.14525 1.7585C8.97275 1.58617 8.75767 1.5 8.5 1.5C8.24233 1.5 8.02725 1.58617 7.85475 1.7585C7.68242 1.931 7.59625 2.14608 7.59625 2.40375C7.59625 2.66142 7.68242 2.8765 7.85475 3.049C8.02725 3.2215 8.24233 3.30775 8.5 3.30775C8.75767 3.30775 8.97275 3.2215 9.14525 3.049Z"
        fill={ICON}
      />
    </Svg>
  );
}
function StressIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 19 19" fill="none">
      <Path
        d="M9.5 12.8385L10.6788 14.0173C10.7724 14.1109 10.8795 14.1578 11 14.1578C11.1205 14.1578 11.2276 14.1109 11.3212 14.0173L12.5 12.8385L13.0557 13.3943C13.1737 13.5123 13.3119 13.5728 13.4703 13.576C13.6286 13.5792 13.7699 13.5186 13.8943 13.3943C14.0186 13.2699 14.0807 13.1302 14.0807 12.975C14.0807 12.8198 14.0186 12.6801 13.8943 12.5558L12.8212 11.4828C12.7276 11.3891 12.6205 11.3423 12.5 11.3423C12.3795 11.3423 12.2724 11.3891 12.1788 11.4828L11 12.6615L9.82125 11.4828C9.72758 11.3891 9.6205 11.3423 9.5 11.3423C9.3795 11.3423 9.27242 11.3891 9.17875 11.4828L8 12.6615L6.82125 11.4828C6.72758 11.3891 6.6205 11.3423 6.5 11.3423C6.3795 11.3423 6.27242 11.3891 6.17875 11.4828L5.10575 12.5558C4.98775 12.6738 4.92717 12.8119 4.924 12.9703C4.92083 13.1286 4.98142 13.2699 5.10575 13.3943C5.23008 13.5186 5.36983 13.5807 5.525 13.5807C5.68017 13.5807 5.81992 13.5186 5.94425 13.3943L6.5 12.8385L7.67875 14.0173C7.77242 14.1109 7.8795 14.1578 8 14.1578C8.1205 14.1578 8.22758 14.1109 8.32125 14.0173L9.5 12.8385ZM6.33075 7.5L4.85775 8.575C4.72308 8.67633 4.64133 8.80617 4.6125 8.9645C4.58367 9.12283 4.61992 9.26925 4.72125 9.40375C4.82242 9.53842 4.95383 9.62342 5.1155 9.65875C5.277 9.69392 5.425 9.65767 5.5595 9.55L7.8595 7.8615C7.98 7.768 8.04025 7.6475 8.04025 7.5C8.04025 7.3525 7.98 7.232 7.8595 7.1385L5.55 5.45C5.41533 5.34233 5.2705 5.30608 5.1155 5.34125C4.96033 5.37658 4.82892 5.46158 4.72125 5.59625C4.61992 5.73075 4.58108 5.87717 4.60475 6.0355C4.62858 6.19383 4.71292 6.32367 4.85775 6.425L6.33075 7.5ZM12.6693 7.5L14.1423 6.425C14.2769 6.32367 14.3587 6.19383 14.3875 6.0355C14.4163 5.87717 14.3801 5.73075 14.2788 5.59625C14.1776 5.46158 14.0462 5.37658 13.8845 5.34125C13.723 5.30608 13.575 5.34233 13.4405 5.45L11.1405 7.1385C11.02 7.232 10.9598 7.3525 10.9598 7.5C10.9598 7.6475 11.02 7.768 11.1405 7.8615L13.45 9.55C13.5847 9.65767 13.7295 9.69392 13.8845 9.65875C14.0397 9.62342 14.1711 9.53842 14.2788 9.40375C14.3801 9.26925 14.4189 9.12283 14.3953 8.9645C14.3714 8.80617 14.2871 8.67633 14.1423 8.575L12.6693 7.5ZM5.79725 18.251C4.64142 17.7517 3.63592 17.0744 2.78075 16.2193C1.92558 15.3641 1.24833 14.3586 0.749 13.2027C0.249667 12.0471 0 10.8128 0 9.5C0 8.18717 0.249667 6.95292 0.749 5.79725C1.24833 4.64142 1.92558 3.63592 2.78075 2.78075C3.63592 1.92558 4.64142 1.24833 5.79725 0.749001C6.95292 0.249667 8.18717 0 9.5 0C10.8128 0 12.0471 0.249667 13.2027 0.749001C14.3586 1.24833 15.3641 1.92558 16.2193 2.78075C17.0744 3.63592 17.7517 4.64142 18.251 5.79725C18.7503 6.95292 19 8.18717 19 9.5C19 10.8128 18.7503 12.0471 18.251 13.2027C17.7517 14.3586 17.0744 15.3641 16.2193 16.2193C15.3641 17.0744 14.3586 17.7517 13.2027 18.251C12.0471 18.7503 10.8128 19 9.5 19C8.18717 19 6.95292 18.7503 5.79725 18.251ZM15.175 15.175C16.725 13.625 17.5 11.7333 17.5 9.5C17.5 7.26667 16.725 5.375 15.175 3.825C13.625 2.275 11.7333 1.5 9.5 1.5C7.26667 1.5 5.375 2.275 3.825 3.825C2.275 5.375 1.5 7.26667 1.5 9.5C1.5 11.7333 2.275 13.625 3.825 15.175C5.375 16.725 7.26667 17.5 9.5 17.5C11.7333 17.5 13.625 16.725 15.175 15.175Z"
        fill={ICON}
      />
    </Svg>
  );
}
function SpaIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 18.5869 17.7801" fill="none">
      <Path
        d="M8.6615 17.7382C7.591 17.5344 6.53783 17.1867 5.502 16.695C4.46617 16.2033 3.5415 15.5193 2.728 14.643C1.9145 13.7668 1.2565 12.6848 0.754 11.397C0.251333 10.1092 0 8.57233 0 6.7865V6.6055C0 6.39783 0.0654166 6.22867 0.19625 6.098C0.327083 5.96717 0.496333 5.90175 0.704 5.90175H0.8655C1.6385 5.90175 2.48942 6.03892 3.41825 6.31325C4.34708 6.58758 5.17433 6.95425 5.9 7.41325C6.03217 6.23758 6.34117 5.02058 6.827 3.76225C7.31283 2.50408 7.9135 1.37242 8.629 0.36725C8.80333 0.122417 9.02317 0 9.2885 0C9.55383 0 9.77367 0.122417 9.948 0.36725C10.6635 1.37242 11.2642 2.50733 11.75 3.772C12.2358 5.03667 12.5448 6.25683 12.677 7.4325C13.3833 6.99283 14.1945 6.63258 15.1105 6.35175C16.0265 6.07092 16.8871 5.92092 17.6923 5.90175L17.8307 5.89225C18.0422 5.88575 18.2227 5.95717 18.372 6.1065C18.5215 6.25583 18.593 6.43633 18.5865 6.648L18.577 6.8055C18.532 8.42483 18.2919 9.84792 17.8567 11.0747C17.4214 12.3017 16.8355 13.3566 16.099 14.2393C15.3625 15.1219 14.4955 15.8428 13.498 16.4018C12.5007 16.9608 11.4154 17.3902 10.2423 17.6902C10.0256 17.7427 9.76217 17.7722 9.452 17.7785C9.14167 17.785 8.87817 17.7716 8.6615 17.7382ZM9.43075 16.3325C9.24742 13.5825 8.41825 11.495 6.94325 10.07C5.46825 8.645 3.66408 7.76583 1.53075 7.4325C1.49742 7.4325 1.49742 7.4325 1.53075 7.4325C1.71408 10.2492 2.56825 12.3658 4.09325 13.7825C5.61825 15.1992 7.39742 16.0492 9.43075 16.3325C9.46408 16.3492 9.46408 16.3533 9.43075 16.345C9.39742 16.3367 9.39742 16.3325 9.43075 16.3325ZM7.3385 8.3325C7.691 8.62867 8.04583 8.98858 8.403 9.41225C8.76 9.83608 9.05517 10.2442 9.2885 10.6365C9.52567 10.2442 9.82183 9.83608 10.177 9.41225C10.5322 8.98858 10.886 8.62867 11.2385 8.3325C11.218 7.3505 11.0369 6.32042 10.6953 5.24225C10.3536 4.16392 9.88467 3.1235 9.2885 2.121C8.69233 3.1235 8.22342 4.16225 7.88175 5.23725C7.54008 6.31225 7.359 7.344 7.3385 8.3325ZM10.1 12.2747C10.3 12.8081 10.4677 13.369 10.603 13.9575C10.7382 14.546 10.8474 15.2069 10.9308 15.9402C11.6141 15.7081 12.3019 15.3808 12.9942 14.9585C13.6866 14.536 14.3145 13.9867 14.878 13.3105C15.4413 12.6342 15.9217 11.8149 16.3192 10.8527C16.7167 9.89058 16.9591 8.7505 17.0462 7.4325C17.0462 7.39917 17.0462 7.39917 17.0462 7.4325C15.4539 7.66583 14.0468 8.21067 12.825 9.067C11.6032 9.9235 10.6948 10.9927 10.1 12.2747Z"
        fill={ICON}
      />
    </Svg>
  );
}

const FEATURES: { Icon: () => JSX.Element; label: string }[] = [
  { Icon: HeartRateIcon, label: "Heart Rate" },
  { Icon: VascularAgeIcon, label: "Vascular Age" },
  { Icon: StressIcon, label: "Stress Index" },
  { Icon: SpaIcon, label: "Wellness Score" },
];

// Shared visual layout for both the real PreScan screen and the carousel
// "teaser" slide that immediately precedes it. Keeping these identical so the
// swipe → navigate handoff has no visible swap.
export function PreScanView({
  onScan,
  onClose,
  onLogin,
  interactive = true,
}: {
  onScan: () => void;
  onClose: () => void;
  onLogin?: () => void;
  interactive?: boolean;
}) {
  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="preScanBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#preScanBg)" />
        </Svg>
      </View>

      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom"]}
        pointerEvents={interactive ? "auto" : "none"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          scrollEnabled={interactive}
        >
          <View style={styles.closeRow}>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeGlyph}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.graphicWrap}>
            <Image
              source={TYPES_GRAPHIC}
              style={{ width: GRAPHIC_W, height: GRAPHIC_H }}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.headline}>Ready to discover your type?</Text>
          <Text style={styles.subhead}>We'll start off with a scan to assess your:</Text>

          <View style={styles.grid}>
            <View style={styles.gridRow}>
              {FEATURES.slice(0, 2).map((f) => (
                <View key={f.label} style={styles.featureChip}>
                  <f.Icon />
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.gridRow}>
              {FEATURES.slice(2, 4).map((f) => (
                <View key={f.label} style={styles.featureChip}>
                  <f.Icon />
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.btnGroup}>
            <TouchableOpacity style={styles.scanBtn} onPress={onScan} activeOpacity={0.85}>
              <Text style={styles.scanBtnText}>Scan now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={onLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnText}>I already have an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function PreScanScreen({ navigation }: Props) {
  useEffect(() => {
    logEvent("onboarding_pre_scan");
  }, []);

  const handleScan = () => {
    logEvent("onboarding_pre_scan_scanNowCTA");
    // Pre-scan calibration (height/weight/age/sex) comes before the face
    // scan — it feeds ShenAI so the scan can return BMR/TDEE.
    navigation.navigate("Calibration");
  };

  const handleClose = () => {
    logEvent("onboarding_pre_scan_skip");
    navigation.navigate("NoScanEmptyState");
  };

  const handleLogin = () => {
    logEvent("onboarding_pre_scan_loginCTA");
    navigation.navigate("Login");
  };

  return (
    <PreScanView
      onScan={handleScan}
      onClose={handleClose}
      onLogin={handleLogin}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: "center",
    // 8px between every block — also gives the X an exact 8px gap to the
    // type-cards graphic without a margin hack.
    gap: 8,
  },
  // close — right-aligned, in flow directly above the type-cards graphic.
  closeRow: { alignItems: "flex-end" },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // Fanned type-cards graphic. The negative margin cancels the parent's side
  // padding so the full-screen-width image sits flush with the screen edges.
  graphicWrap: {
    marginHorizontal: -24,
    alignItems: "center",
  },
  // headline / subhead
  headline: {
    fontFamily: fonts.dmSans,
    fontSize: 40,
    lineHeight: 42,
    color: BONE,
    letterSpacing: -0.4,
  },
  subhead: {
    fontFamily: fonts.dmSans,
    fontSize: 17,
    lineHeight: 22,
    color: BONE,
    letterSpacing: -0.17,
  },
  // feature grid
  grid: { gap: 8 },
  gridRow: { flexDirection: "row", gap: 8 },
  featureChip: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#7E6869",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 10,
    paddingLeft: 12,
    paddingRight: 16,
    paddingBottom: 16,
    gap: 8,
  },
  featureLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: WHITE,
    letterSpacing: -0.16,
  },
  // scan button
  scanBtn: {
    backgroundColor: WHITE,
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  scanBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
  // "Scan now" + "I already have an account" grouped so the gap between
  // them is exactly 8px (independent of the content container's gap).
  btnGroup: { gap: 8 },
  // "I already have an account" — ghost button below "Scan now"
  loginBtn: {
    backgroundColor: "rgba(250,253,254,0.24)",
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: WHITE,
    letterSpacing: -0.2,
  },
  closeGlyph: { fontSize: 28, color: "rgba(250,253,254,0.7)", fontWeight: "300" },
});

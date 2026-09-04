import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path } from "react-native-svg";
import { K, toMetabolicType, type MetabolicType } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { getProfile } from "../../services/profile";
import { getCheckInHistory } from "../../services/checkIn";
import { useBiometricFreshness } from "../../hooks/useBiometricFreshness";
import { useAppPalette } from "../../hooks/useAppPalette";
import { useApp } from "../../context/AppContext";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";

// Ester message body color. Figma bone-surface/on-bone-subtle in day; a lighter
// version of the same warm tone in evening so it stays readable on the dark card.
const MIDDLE_TEXT_DAY = "#7E6869";
const MIDDLE_TEXT_EVENING = "#E6DCDC";

// Per-type mascot hero. The user's metabolic type drives which gradient logo
// bleeds off the card's top-left. (Ember's asset uses the "Restorer" name.)
const TYPE_MASCOT: Record<MetabolicType, ReturnType<typeof require>> = {
  Burner: require("../../../assets/images/type-mascots/Burner.png"),
  Rebounder: require("../../../assets/images/type-mascots/Rebounder.png"),
  Ember: require("../../../assets/images/type-mascots/Restorer.png"),
  Chameleon: require("../../../assets/images/type-mascots/Chameleon.png"),
  Explorer: require("../../../assets/images/type-mascots/Explorer.png"),
};

// Ester "typing" indicator — three pulsing dots shown while the message and
// option cards animate in.
function TypingDots({ color }: { color: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={styles.dots}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function DataGateScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const route = useRoute<RouteProp<AppOpenStackParamList, "DataGate">>();
  const debugForceShow = route.params?.debugForceShow === true;
  const insets = useSafeAreaInsets();
  const { outerBg, innerBg, textColor, subtleText, statusBarStyle, evening } =
    useAppPalette();
  const { state: appState } = useApp();

  // Narrow phones (e.g. Galaxy S24, ~360dp) don't leave the scan label room to
  // sit beside the arrow at the full 20px, so adjustsFontSizeToFit shrinks it
  // and it ends up smaller than the survey label. On those screens, give the
  // label the full card width (arrow overlaid) so both render at a matching
  // fixed size. Wider phones (iPhone 16 Pro, ~393dp) keep the original layout.
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;

  const middleText = evening ? MIDDLE_TEXT_EVENING : MIDDLE_TEXT_DAY;

  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [lastCheckInAt, setLastCheckInAt] = useState<string | null>(null);
  const [primaryBucket, setPrimaryBucket] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getProfile().catch(() => null),
      getCheckInHistory(5).catch(() => []),
    ]).then(([profile, history]) => {
      setLastScanAt(profile?.layer3?.latestScan?.scannedAt ?? null);
      setLastCheckInAt(history[0]?.date ?? null);
      setPrimaryBucket(profile?.layer1?.primaryBucket ?? null);
      setReady(true);
    });
  }, []);

  const metabolicType: MetabolicType =
    toMetabolicType(primaryBucket) ??
    toMetabolicType(appState.user.metabolicType) ??
    "Explorer";
  const mascotSource = TYPE_MASCOT[metabolicType];

  const { isFresh } = useBiometricFreshness(lastScanAt, lastCheckInAt);

  // Show the typing dots first, then crossfade to the message + option cards.
  const reveal = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      Animated.timing(reveal, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setRevealed(true));
    }, 900);
    return () => clearTimeout(t);
  }, [ready, reveal]);

  useEffect(() => {
    if (ready && isFresh && !debugForceShow) {
      navigation.replace("ScoreReveal");
    }
  }, [ready, isFresh, debugForceShow, navigation]);

  const handleScan = () => {
    const parent = navigation.getParent();
    parent?.navigate("Scan", {
      mode: "rescan",
      returnTo: "ScoreReveal",
      entry: "app_open_data_gate",
    });
  };

  const handleSurvey = () => {
    navigation.replace(
      appState.settings.useNewSurveyFlow ? "SurveyV2" : "Survey",
    );
  };

  if (!ready || (isFresh && !debugForceShow)) {
    return (
      <View style={[styles.root, { backgroundColor: outerBg }]}>
        <ActivityIndicator size="large" color={textColor} style={styles.loader} />
      </View>
    );
  }

  // "Best option" (scan) banner inverts against the card so it always reads as
  // the primary CTA in both day and evening palettes.
  const scanBg = textColor;
  const scanText = innerBg;

  return (
    <View style={[styles.root, { backgroundColor: outerBg }]}>
      <StatusBar barStyle={statusBarStyle} translucent />
      <View
        style={[
          styles.safe,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={[styles.card, { backgroundColor: innerBg }]}>
          {/* Hero — bleeds off the top-left, clipped by the card. */}
          <View style={styles.mascotWrap} pointerEvents="none">
            <Image
              source={mascotSource}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.cardBody}>
            {/* Ester message — dots show first, then crossfade to the text. */}
            <View style={styles.message}>
              {!revealed && (
                <Animated.View
                  style={[
                    styles.dotsOverlay,
                    { opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
                  ]}
                  pointerEvents="none"
                >
                  <TypingDots color={subtleText} />
                </Animated.View>
              )}
              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [
                    { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                  ],
                }}
              >
                <Text style={[styles.body, { color: middleText }]}>
                  Let's start with a{" "}
                  <Text style={[styles.bodyStrong, { color: textColor }]}>quick scan</Text>{" "}
                  to get your bio-signatures in check. That'll allow me to work
                  with the absolute latest version of you.
                </Text>
              </Animated.View>
            </View>

            {/* Two-option banner row */}
            <Animated.View style={[styles.bannerRow, { opacity: reveal }]}>
              <TouchableOpacity
                style={[styles.banner, styles.surveyBanner]}
                onPress={handleSurvey}
                activeOpacity={0.85}
              >
                <View style={styles.bannerTop}>
                  <Text style={[styles.bannerKicker, { color: K.brown }]}>Quick option</Text>
                  <ArrowForward color={K.brown} size={14} />
                </View>
                <Text
                  style={[
                    styles.bannerLabel,
                    isSmallScreen && styles.bannerLabelSmall,
                    { color: K.brown },
                  ]}
                >
                  Do the survey instead today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.banner, styles.scanBanner, { backgroundColor: scanBg }]}
                onPress={handleScan}
                activeOpacity={0.85}
              >
                <View style={styles.bannerTop}>
                  <Text style={[styles.bannerKicker, { color: scanText }]}>Best option</Text>
                  <ArrowForward color={scanText} size={14} />
                </View>
                <View style={styles.scanBottom}>
                  <Text
                    style={[
                      styles.bannerLabel,
                      isSmallScreen && styles.bannerLabelSmall,
                      styles.scanLabelFlex,
                      { color: scanText },
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit={!isSmallScreen}
                  >
                    I'm ready to scan in
                  </Text>
                  <View style={[styles.scanArrow, { backgroundColor: innerBg }]}>
                    <ArrowForward color={textColor} size={22} />
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

function ArrowForward({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12h14M13 6l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const CARD_RADIUS = 40;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 12 },
  loader: { flex: 1, alignSelf: "center" },
  card: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    shadowColor: "#220A0A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.38,
    shadowRadius: 6,
    elevation: 6,
  },
  mascotWrap: {
    position: "absolute",
    top: -90,
    left: -105,
    width: 426,
    height: 426,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotImage: {
    width: "100%",
    height: "100%",
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 330,
    paddingBottom: spacing.xl,
    justifyContent: "space-between",
  },
  message: {
    gap: 6,
  },
  dotsOverlay: {
    position: "absolute",
    top: 4,
    left: 0,
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 2,
    paddingLeft: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  body: {
    // The Greeting screen's middle-text style (dmSans 16/22/-0.16), scaled +25%.
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  bodyStrong: {
    fontFamily: fonts.dmSansBold,
  },
  bannerRow: {
    flexDirection: "row",
    gap: 4,
    height: 144,
  },
  banner: {
    flex: 1,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: "space-between",
  },
  surveyBanner: {
    backgroundColor: K.blue,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 4,
  },
  scanBanner: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 64,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 24,
  },
  bannerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  bannerKicker: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  bannerLabel: {
    // Figma: Style/Sans serif (Catalogue), Title-3 20px, weight 400,
    // line-height normal, letter-spacing -0.2.
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
  },
  bannerLabelSmall: {
    // Narrow phones (e.g. S24, 360dp): the scan label has to share its row
    // with the arrow, so 15px is the largest it fits in two lines. The survey
    // label uses the same size so the two cards stay matched.
    fontSize: 15,
  },
  // Wide screens: label sits beside the arrow and auto-shrinks to fit.
  scanBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  scanLabelFlex: {
    flex: 1,
  },
  scanArrow: {
    width: 36,
    height: 36,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
});

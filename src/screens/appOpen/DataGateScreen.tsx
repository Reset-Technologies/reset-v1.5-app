import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, CommonActions, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import { getProfile } from "../../services/profile";
import { getCheckInHistory } from "../../services/checkIn";
import { useBiometricFreshness } from "../../hooks/useBiometricFreshness";
import { useAppPalette } from "../../hooks/useAppPalette";
import { useSwipeToAdvance } from "../../hooks/useSwipeToAdvance";
import { useApp } from "../../context/AppContext";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";

export function DataGateScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const route = useRoute<RouteProp<AppOpenStackParamList, "DataGate">>();
  const debugForceShow = route.params?.debugForceShow === true;
  const insets = useSafeAreaInsets();
  const { outerBg, innerBg, nestedBg, textColor, subtleText, borderColor, statusBarStyle } =
    useAppPalette();
  const { state: appState } = useApp();

  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [lastCheckInAt, setLastCheckInAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getProfile().catch(() => null),
      getCheckInHistory(5).catch(() => []),
    ]).then(([profile, history]) => {
      setLastScanAt(profile?.layer3?.latestScan?.scannedAt ?? null);
      setLastCheckInAt(history[0]?.date ?? null);
      setReady(true);
    });
  }, []);

  const { isFresh } = useBiometricFreshness(lastScanAt, lastCheckInAt);

  useEffect(() => {
    if (ready && isFresh && !debugForceShow) {
      navigation.replace("ScoreReveal");
    }
  }, [ready, isFresh, debugForceShow, navigation]);

  const exitToHome = () => {
    const parent = navigation.getParent();
    parent?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Tabs" }],
      }),
    );
  };

  const handleScan = () => {
    const parent = navigation.getParent();
    parent?.navigate("Scan", { mode: "rescan", returnTo: "ScoreReveal" });
  };

  const handleAskEster = () => {
    const parent = navigation.getParent();
    parent?.navigate("EsterChat", { context: "general" });
  };

  const handleSurvey = () => {
    navigation.replace(
      appState.settings.useNewSurveyFlow ? "SurveyV2" : "Survey",
    );
  };

  const handleSkipToScore = () => {
    navigation.replace("ScoreReveal");
  };

  const swipeHandlers = useSwipeToAdvance({
    axis: "down",
    onAdvance: handleSkipToScore,
    enabled: ready && (debugForceShow || !isFresh),
  });

  if (!ready || (isFresh && !debugForceShow)) {
    return (
      <View style={[styles.root, { backgroundColor: outerBg }]}>
        <ActivityIndicator
          size="large"
          color={textColor}
          style={styles.loader}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { backgroundColor: outerBg }]}
      {...swipeHandlers}
    >
      <StatusBar barStyle={statusBarStyle} translucent />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={[styles.card, { backgroundColor: innerBg }]}>
          <View style={styles.cardInner}>
            <View style={styles.cardTop}>
              <View style={styles.header}>
                <View style={styles.brandLogo}>
                  <Image
                    source={require("../../../assets/images/quick-scan-mascot.png")}
                    style={[styles.brandLogoImage, { tintColor: textColor }]}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.title, { color: textColor }]} pointerEvents="none">
                  Quick scan
                </Text>
              </View>

              <Text style={[styles.intro, { color: textColor }]}>
                We'll start with a quick scan to get your bio-signatures in
                check. That'll allow me to work with the absolute latest
                version of you.
              </Text>

              <View style={styles.cardRow}>
                <TouchableOpacity
                  style={[styles.optionCard, styles.optionCardLeft, { backgroundColor: nestedBg }]}
                  onPress={handleScan}
                  activeOpacity={0.85}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, { color: textColor }]}>
                      I'm ready to scan in
                    </Text>
                    <Text style={[styles.optionMeta, { color: textColor }]}>Best option</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionCard, styles.optionCardRight, { backgroundColor: nestedBg }]}
                  onPress={handleSurvey}
                  activeOpacity={0.85}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, { color: textColor }]}>
                      Do the survey instead today
                    </Text>
                    <Text style={[styles.optionMeta, { color: textColor }]}>Quickest option</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.skipPill, { borderColor }]}
                onPress={handleSkipToScore}
                activeOpacity={0.8}
              >
                <Text style={[styles.skipLabel, { color: subtleText }]}>
                  Skip to my score →
                </Text>
              </TouchableOpacity>

            </View>

            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={[styles.askEsterPill, { backgroundColor: innerBg, borderColor }]}
                onPress={handleAskEster}
                activeOpacity={0.8}
              >
                <View style={styles.askEsterAvatar}>
                  <Image
                    source={require("../../../assets/images/ester-logo.png")}
                    style={styles.askEsterAvatarImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.askEsterLabel, { color: textColor }]}>Ask Ester</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, { backgroundColor: innerBg, borderColor: textColor }]}
                onPress={exitToHome}
                activeOpacity={0.8}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 5v14M5 12l7 7 7-7"
                    stroke={textColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  loader: { flex: 1, alignSelf: "center" },
  card: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 28,
    overflow: "hidden",
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cardTop: {
    flex: 1,
    gap: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  brandLogo: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoImage: {
    width: "100%",
    height: "100%",
  },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: fonts.dmSansBold,
    fontSize: 26,
    letterSpacing: -0.3,
  },
  intro: {
    fontFamily: fonts.dmSans,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
  },
  cardRow: {
    flexDirection: "row",
    gap: spacing.sm,
    height: 160,
  },
  optionCard: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionCardLeft: {
    borderTopLeftRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  optionCardRight: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
  },
  optionTextWrap: {
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  optionLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.2,
    textAlign: "left",
  },
  optionMeta: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    opacity: 0.7,
    textAlign: "left",
  },
  skipPill: {
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: K.border,
    borderRadius: radius.full,
    alignItems: "center",
  },
  skipLabel: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: K.sub,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  askEsterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: 7,
    paddingRight: 16,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  askEsterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: K.brown,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  askEsterAvatarLabel: {
    fontFamily: fonts.dmSansBold,
    fontSize: 15,
    color: K.bone,
  },
  askEsterAvatarImage: {
    width: "108%",
    height: "108%",
  },
  askEsterLabel: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
  },
  arrowButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowIcon: {
    fontSize: 22,
    fontWeight: "400",
  },
});

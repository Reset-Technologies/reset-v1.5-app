import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { SurveyHeader } from "../../components/survey/SurveyHeader";
import { ContinueButton } from "../../components/survey/ContinueButton";
import { getProfile } from "../../services/profile";
import { useApp } from "../../context/AppContext";
import { useSwipeToAdvance } from "../../hooks/useSwipeToAdvance";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";

const PIE_SIZE = 24;
const PIE_RADIUS = 10;
const PIE_CENTER = PIE_SIZE / 2;

function buildPieSlicePath(fraction: number): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0) return "";
  if (clamped >= 1) {
    return `M ${PIE_CENTER} ${PIE_CENTER - PIE_RADIUS}
            A ${PIE_RADIUS} ${PIE_RADIUS} 0 1 1 ${PIE_CENTER} ${PIE_CENTER + PIE_RADIUS}
            A ${PIE_RADIUS} ${PIE_RADIUS} 0 1 1 ${PIE_CENTER} ${PIE_CENTER - PIE_RADIUS} Z`;
  }
  const angle = clamped * 2 * Math.PI;
  const endX = PIE_CENTER + PIE_RADIUS * Math.sin(angle);
  const endY = PIE_CENTER - PIE_RADIUS * Math.cos(angle);
  const largeArc = clamped > 0.5 ? 1 : 0;
  return `M ${PIE_CENTER} ${PIE_CENTER}
          L ${PIE_CENTER} ${PIE_CENTER - PIE_RADIUS}
          A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function ConfidencePie({ fraction, color }: { fraction: number; color: string }) {
  const path = buildPieSlicePath(fraction);
  return (
    <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
      <Circle
        cx={PIE_CENTER}
        cy={PIE_CENTER}
        r={PIE_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      {path ? <Path d={path} fill={color} /> : null}
    </Svg>
  );
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function EncourageScanScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const [confidence, setConfidence] = useState<number | null>(null);

  useEffect(() => {
    // If the user has already scanned today, skip the nudge entirely.
    if (state.biometrics) {
      navigation.replace("ScoreReveal");
      return;
    }
    getProfile()
      .then((p) => {
        if (isToday(p?.layer3?.latestScan?.scannedAt)) {
          navigation.replace("ScoreReveal");
          return;
        }
        setConfidence(p?.confidence?.composite ?? null);
      })
      .catch(() => {});
  }, [navigation, state.biometrics]);

  const exitToHome = () => {
    const parent = navigation.getParent();
    parent?.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Tabs" }] }),
    );
  };

  const handleScan = () => {
    const parent = navigation.getParent();
    parent?.navigate("Scan", { mode: "rescan", returnTo: "ScoreReveal" });
  };

  const handleSkip = () => {
    navigation.replace("ScoreReveal");
  };

  const swipeHandlers = useSwipeToAdvance({
    axis: "down",
    onAdvance: handleSkip,
  });

  const confidencePct =
    confidence !== null ? Math.max(0, Math.min(100, Math.round(confidence))) : 50;
  const daysToFull =
    confidence !== null && confidence < 100
      ? Math.max(1, Math.ceil(100 - confidence))
      : 0;

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top", "bottom"]}
      {...swipeHandlers}
    >
      <StatusBar barStyle="dark-content" translucent />

      <View style={styles.content}>
        <SurveyHeader
          step={3}
          totalSteps={3}
          title={"Your score's almost ready!\n\nWe've got a good read on you, but completing a face scan can make your results even more accurate."}
          canGoBack
          onBack={() => navigation.goBack()}
          onClose={exitToHome}
        />

        <View style={styles.confidenceCard}>
          <View style={styles.confidenceLeft}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>
            <ConfidencePie fraction={confidencePct / 100} color={K.brown} />
          </View>
          <View style={styles.confidenceRight}>
            <Text style={styles.confidenceHint}>
              We're still learning your signals.
            </Text>
            {daysToFull > 0 ? (
              <Text style={styles.confidenceSub}>
                Estimated {daysToFull} days til near 100% confidence
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.footer, { bottom: insets.bottom + 16 }]}>
        <ContinueButton label="Complete scan" onPress={handleScan} />
        <ContinueButton
          label="No thanks, show me my score"
          variant="ghost"
          onPress={handleSkip}
          style={styles.skipBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: K.bone,
  },
  content: {
    gap: 30,
  },
  confidenceCard: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    backgroundColor: "#E9F0F2",
    borderRadius: 4,
    padding: 16,
    marginHorizontal: 34,
  },
  confidenceLeft: {
    gap: 8,
  },
  confidenceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confidenceLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  confidenceValue: {
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
  },
  confidenceRight: {
    flex: 1,
    gap: 7,
  },
  confidenceHint: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
  },
  confidenceSub: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.sub,
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    gap: 8,
  },
  skipBtn: {
    marginTop: 0,
  },
});

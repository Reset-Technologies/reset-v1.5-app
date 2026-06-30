import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { ContinueButton } from "../../components/survey/ContinueButton";
import { ScoreRing } from "../../components/survey/ScoreRing";
import { getProfile } from "../../services/profile";
import { getResetScore } from "../../services/resetScore";
import { setCustomAttribute } from "../../services/braze";
import { useSwipeToAdvance } from "../../hooks/useSwipeToAdvance";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";

export function ScoreRevealScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [trendDelta, setTrendDelta] = useState<number | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setConfidence(p?.confidence?.composite ?? null);
      })
      .catch(() => {});

    getResetScore()
      .then((res) => {
        if (res.status === "active" && res.score) {
          setScore(res.score.score);
          setCustomAttribute("latest_score", Math.round(res.score.score));
          if (res.score.previousDayScore !== null) {
            setTrendDelta(
              Math.round(res.score.score - res.score.previousDayScore),
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  const advanceToMeal = () => {
    navigation.replace("NextMeal");
  };

  const handleScanAgain = () => {
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate("Scan", {
        mode: "rescan",
        returnTo: "ScoreReveal",
      });
    }
  };

  const handleCheckIn = () => {
    navigation.replace("SurveyV2");
  };

  const swipeHandlers = useSwipeToAdvance({
    axis: "down",
    onAdvance: advanceToMeal,
  });

  const hasScore = score !== null && score > 0;
  const displayedScore = hasScore ? Math.round(score!) : 0;
  const confidencePct =
    confidence !== null ? Math.max(0, Math.min(100, Math.round(confidence))) : 50;
  const daysToFull =
    confidence !== null && confidence < 100
      ? Math.max(1, Math.ceil(100 - confidence))
      : 0;

  const scoreMood = (() => {
    if (!hasScore) return "Waiting on today's signal.";
    if (displayedScore >= 80) return "Looking good, looking good!";
    if (displayedScore >= 60) return "Trending in the right direction.";
    if (displayedScore >= 40) return "A steady read on you.";
    return "We're still getting to know you.";
  })();

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top", "bottom"]}
      {...swipeHandlers}
    >
      <StatusBar barStyle="dark-content" translucent />

      <View style={styles.content}>
        <Text style={styles.heading}>
          {hasScore ? "Thanks for checking in." : "Welcome back."}
        </Text>

        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <View style={styles.scoreHeaderText}>
              <Text style={styles.scoreTitle}>Today's Reset Score</Text>
              <Text style={styles.scoreSub}>{scoreMood}</Text>
            </View>
          </View>

          {hasScore ? (
            <View style={styles.ringWrap}>
              <ScoreRing
                score={displayedScore}
                previousScore={
                  trendDelta !== null ? Math.max(0, displayedScore - trendDelta) : undefined
                }
              />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No score yet today</Text>
              <Text style={styles.emptyBody}>
                Take a quick scan or check in below and I'll have a read on you
                in seconds.
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={handleScanAgain}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBtnText}>Scan Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={handleCheckIn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBtnText}>Check In</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {hasScore && trendDelta !== null ? (
            <View style={styles.trendWrap}>
              <View style={styles.trendRow}>
                <Text style={styles.trendArrow}>{trendDelta >= 0 ? "▲" : "▼"}</Text>
                <Text style={styles.trendText}>
                  {trendDelta >= 0 ? "up" : "down"} by {Math.abs(trendDelta)}
                </Text>
              </View>
              <Text style={styles.trendCaption}>since yesterday</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.confidenceCard}>
          <View style={styles.confidenceRight}>
            <Text style={styles.confidenceHint}>
              We're still learning your signals so continue to scan each day.
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
        <ContinueButton label="See today's meal" onPress={advanceToMeal} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: K.white,
  },
  content: {
    paddingTop: 32,
    paddingHorizontal: 28,
    gap: 8,
  },
  heading: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    color: K.brown,
    marginBottom: 16,
  },
  scoreCard: {
    backgroundColor: "#E9F0F2",
    borderRadius: 4,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 24,
    alignItems: "center",
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: "100%",
  },
  scoreHeaderText: {
    flex: 1,
    gap: 4,
  },
  scoreTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  scoreSub: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  ringWrap: {
    alignItems: "center",
    width: "100%",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 8,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.14,
    color: K.brown,
    textAlign: "center",
  },
  emptyActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  emptyBtn: {
    minHeight: 32,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.white,
  },
  emptyBtnText: {
    fontFamily: fonts.dmSansBold,
    fontSize: 14,
    color: K.brown,
  },
  trendWrap: {
    alignItems: "center",
    gap: 4,
    marginTop: -12,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendArrow: {
    fontSize: 14,
    color: K.ochre,
  },
  trendText: {
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#323E41",
  },
  trendCaption: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.sub,
  },
  confidenceCard: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    backgroundColor: "#E9F0F2",
    borderRadius: 4,
    padding: 16,
    marginTop: 8,
  },
  confidenceLeft: {
    gap: 8,
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
    left: 36,
    right: 36,
  },
});

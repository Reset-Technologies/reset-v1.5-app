import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import { K, toMetabolicType } from "../../constants/colors";
import { fonts, typography, spacing } from "../../constants/typography";
import {
  getDailyPlan,
  getCachedDailyPlan,
  cacheDailyPlan,
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../../services/meals";
import type { DailyPlan } from "../../services/meals";
import {
  getTodayCheckIn,
  getCheckInHistory,
} from "../../services/checkIn";
import type { CheckInEntry } from "../../services/checkIn";
import { getProfile, type UserProfile } from "../../services/profile";
import { getResetScore, type ResetScore } from "../../services/resetScore";
import {
  generateGreeting,
  generateSimpleGreeting,
  getDayNumber,
  detectLapseTier,
  computeDaysSinceLastCheckIn,
  scoreBand,
} from "../../services/greetings";
import type {
  GreetingContext,
  GreetingResult,
} from "../../services/greetings";
import { useApp } from "../../context/AppContext";
import { useAppPalette } from "../../hooks/useAppPalette";
import { logEvent, setCustomAttribute } from "../../services/braze";
import { maybePrimePushOnce } from "../../services/pushNotifications";
import { useAiConsentGate } from "../../hooks/useAiConsentGate";
import {
  MealTabsSection,
  HomeHeader,
  CheckInCard,
  ScoreCard,
  ConfidenceCard,
  GreetingBlock,
  SavedMealsCard,
} from "../../components/homeV2";
import type { Meal } from "../../components";

export function HomeScreenV2() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { state } = useApp();
  const { runWithAiConsent } = useAiConsentGate();
  const { innerBg, textColor } = useAppPalette();

  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [favoritedMeals, setFavoritedMeals] = useState<Set<string>>(new Set());
  const [checkInHistory, setCheckInHistory] = useState<CheckInEntry[]>([]);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resetScore, setResetScore] = useState<ResetScore | null>(null);

  // Re-fetch every time Home regains focus so a fresh scan or survey
  // (which calls refreshDailyPlan() on the way back) shows up immediately.
  useFocusEffect(
    useCallback(() => {
      getDailyPlan()
        .then((plan) => {
          setDailyPlan(plan);
          cacheDailyPlan(plan);
        })
        .catch(async () => {
          const cached = await getCachedDailyPlan();
          if (cached) setDailyPlan(cached);
        });

      getFavorites()
        .then((favs) => setFavoritedMeals(new Set(favs.map((f) => f.id))))
        .catch(() => {});

      getCheckInHistory(30)
        .then((history) => setCheckInHistory(history))
        .catch(() => {});

      getTodayCheckIn()
        .then((res) => {
          setCheckedInToday(!!res.checkIn);
        })
        .catch(() => {});

      getProfile()
        .then(setProfile)
        .catch(() => {});

      getResetScore()
        .then((res) => {
          if (res.status === "active" && res.score) {
            setResetScore(res.score);
            setCustomAttribute("latest_score", Math.round(res.score.score));
          }
        })
        .catch(() => {});
    }, []),
  );

  React.useEffect(() => {
    logEvent("home_main");
    // RES-188 — prime the push soft-ask here (after the first meal card),
    // not at signup where it stacked with the AI-consent screen. No-op after
    // the first time.
    maybePrimePushOnce();
  }, []);

  const handleMealPress = useCallback(
    (meal: Meal) => {
      logEvent("home_meal_recipeCTA", { mealId: meal.id });
      navigation.navigate("RecipeDetail", { meal });
    },
    [navigation],
  );

  const handleDeepRead = useCallback(
    (meal: Meal) => {
      logEvent("home_meal_askEsterCTA", { mealId: meal.id });
      runWithAiConsent(() =>
        navigation.navigate("EsterChat", { context: "meal", meal }),
      );
    },
    [navigation, runWithAiConsent],
  );

  const handleScanAgain = useCallback(() => {
    navigation.navigate("Scan", { mode: "rescan", returnTo: "ScoreReveal" });
  }, [navigation]);

  const handleExplainScore = useCallback(() => {
    navigation.navigate("ScanInsights");
  }, [navigation]);

  const handleStartCheckIn = useCallback(() => {
    (navigation as any).navigate("AppOpenFlow", { screen: "SurveyV2" });
  }, [navigation]);

  const userName =
    state.auth.authUser?.firstName || state.user.name || undefined;
  const dayNumber = getDayNumber(state.auth.authUser?.createdAt);
  const hasScanLocal = !!state.biometrics;
  const metabolicType =
    toMetabolicType(profile?.layer1?.primaryBucket) ??
    toMetabolicType(state.user.metabolicType) ??
    "Explorer";

  const greeting: GreetingResult = (() => {
    const hasScan = hasScanLocal || (profile?.layer3?.scanCount ?? 0) > 0;
    const base = { metabolicType, hasScan, dayNumber, userName };
    if (!profile) return generateSimpleGreeting(base);

    const daysSinceLastCheckIn = computeDaysSinceLastCheckIn(checkInHistory);
    const checkInCount = profile.layer2.energyLog.length;
    const mealFeedbackCount = profile.layer2.mealFeedback.length;
    // Source the latest check-in signals from checkInHistory (which preserves
    // empty stressTags) rather than profile.layer2.*, which the API filters
    // by non-empty entries. Without this, a "no-stress today" check-in is
    // silently overridden by yesterday's stress tag.
    const latestCheckIn = checkInHistory.length > 0 ? checkInHistory[0] : null;
    const lastEnergy = latestCheckIn?.energy ?? null;
    const lastStress = latestCheckIn?.stressTags ?? [];
    const lastCheckInAt = latestCheckIn?.date ?? null;
    const lastScanAt = profile.layer3.latestScan?.scannedAt ?? null;

    const todayScore = resetScore?.score ?? null;
    const priorScore = resetScore?.previousDayScore ?? null;
    const computedDelta =
      todayScore !== null && priorScore !== null
        ? Math.round(todayScore - priorScore)
        : null;

    const ctx: GreetingContext = {
      ...base,
      checkInCount,
      latestEnergy: lastEnergy,
      latestStressTags: lastStress,
      latestSleepQuality: latestCheckIn?.sleepQuality ?? null,
      latestSleepHours: latestCheckIn?.sleepHours ?? null,
      scanCount: profile.layer3.scanCount,
      latestScan: profile.layer3.latestScan,
      esterTier: profile.confidence.esterTier ?? "Pattern Acknowledgment",
      compositeConfidence: profile.confidence.composite,
      lastCheckInAt,
      lastScanAt,
      score: todayScore,
      scoreBand: scoreBand(todayScore),
      scoreDelta: computedDelta,
      daysSinceLastCheckIn,
      isGlanceOnly:
        dayNumber >= 5 && checkInCount === 0 && mealFeedbackCount === 0,
      lapseTier: detectLapseTier(daysSinceLastCheckIn),
      mealFeedbackCount,
    };

    return generateGreeting(ctx);
  })();

  const score = resetScore?.score ?? null;
  const confidence = profile?.confidence?.composite ?? null;
  const daysToFullConfidence =
    confidence !== null && confidence < 100
      ? Math.max(1, Math.ceil(100 - confidence))
      : 0;
  const latestScanAt = profile?.layer3?.latestScan?.scannedAt ?? null;
  const trendDelta =
    resetScore && resetScore.previousDayScore !== null
      ? Math.round(resetScore.score - resetScore.previousDayScore)
      : null;

  const handleFavoriteToggle = useCallback(async (mealId: string) => {
    const wasFavorited = favoritedMeals.has(mealId);
    logEvent("home_meal_favoriteCTA", {
      mealId,
      action: wasFavorited ? "unfavorite" : "favorite",
    });
    setFavoritedMeals((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
    try {
      if (wasFavorited) await removeFavorite(mealId);
      else await addFavorite(mealId);
    } catch {
      setFavoritedMeals((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(mealId);
        else next.delete(mealId);
        return next;
      });
    }
  }, [favoritedMeals]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: innerBg }]} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader
          dateLabel={new Date().toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
          })}
        />

        <GreetingBlock
          nameGreeting={greeting.nameGreeting}
          message={greeting.message}
        />

        <ScoreCard
          score={score}
          latestScanAt={latestScanAt}
          latestCheckInAt={checkInHistory[0]?.createdAt ?? checkInHistory[0]?.date ?? null}
          trendDelta={trendDelta}
          onScanAgain={handleScanAgain}
          onExplain={handleExplainScore}
          onCheckIn={handleStartCheckIn}
        />

        <ConfidenceCard confidence={confidence} daysToFull={daysToFullConfidence} />

        <Text style={[styles.sectionHeading, { color: textColor }]}>
          Based on your scan, here are meals for you
        </Text>

        <MealTabsSection
          breakfast={dailyPlan?.breakfast ?? []}
          lunch={dailyPlan?.lunch ?? []}
          dinner={dailyPlan?.dinner ?? []}
          favoritedMealIds={favoritedMeals}
          onMealPress={handleMealPress}
          onFavoriteToggle={handleFavoriteToggle}
          onDeepRead={handleDeepRead}
        />

        <SavedMealsCard onPress={() => navigation.navigate("SavedMeals")} />

        {!checkedInToday ? (
          <CheckInCard onPress={handleStartCheckIn} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  placeholder: {
    padding: spacing.xl,
    alignItems: "center",
  },
  placeholderLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: K.textMuted,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  placeholderText: {
    ...typography.body,
    color: K.textMuted,
    textAlign: "center",
  },
  sectionHeading: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -0.32,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  checkInSlot: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
});

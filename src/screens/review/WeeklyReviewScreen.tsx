import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import { K, CardColors } from "../../constants/colors";
import { typography, spacing, radius, fonts } from "../../constants/typography";
import {
  getLatestWeeklyReview,
  WeeklyReview,
  WeeklyReviewData,
} from "../../services/weeklyReview";

function TrendArrow({ trend }: { trend: string }) {
  if (trend === "up") return <Text style={styles.trendUp}>+</Text>;
  if (trend === "down") return <Text style={styles.trendDown}>-</Text>;
  return <Text style={styles.trendStable}>=</Text>;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ScoreSummary({ summary }: { summary: WeeklyReviewData["summary"] }) {
  return (
    <Card title="Your Week">
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{summary.checkInCount}</Text>
          <Text style={styles.statLabel}>Check-ins</Text>
        </View>
        {summary.scoreEnd != null && (
          <View style={styles.stat}>
            <View style={styles.scoreRow}>
              <Text style={styles.statNumber}>{summary.scoreEnd}</Text>
              <TrendArrow trend={summary.scoreTrend} />
            </View>
            <Text style={styles.statLabel}>Reset Score</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function EnergyCard({ energy }: { energy: WeeklyReviewData["energy"] }) {
  if (!energy.dominant) return null;
  const entries = Object.entries(energy.distribution);
  return (
    <Card title="Energy Pattern">
      <Text style={styles.cardBody}>
        Most common: <Text style={styles.bold}>{energy.dominant}</Text>
      </Text>
      <View style={styles.barChart}>
        {entries.map(([level, count]) => (
          <View key={level} style={styles.barRow}>
            <Text style={styles.barLabel}>{level}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { flex: count, maxWidth: `${(count / 7) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.barCount}>{count}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function StressCard({ stress }: { stress: WeeklyReviewData["stress"] }) {
  if (stress.totalOccurrences === 0) return null;
  return (
    <Card title="Stress Signals">
      <Text style={styles.cardBody}>
        {stress.totalOccurrences} stress tag{stress.totalOccurrences !== 1 ? "s" : ""}{" "}
        this week
      </Text>
      {stress.topTags.length > 0 && (
        <View style={styles.tagRow}>
          {stress.topTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function SleepCard({ sleep }: { sleep: WeeklyReviewData["sleep"] }) {
  if (!sleep.avgHours && !sleep.dominantQuality) return null;
  return (
    <Card title="Sleep">
      {sleep.avgHours != null && (
        <Text style={styles.cardBody}>
          Average: <Text style={styles.bold}>{sleep.avgHours}h</Text>
        </Text>
      )}
      {sleep.dominantQuality && (
        <Text style={styles.cardBody}>
          Most common quality:{" "}
          <Text style={styles.bold}>{sleep.dominantQuality}</Text>
        </Text>
      )}
    </Card>
  );
}

function MealsCard({ meals }: { meals: WeeklyReviewData["meals"] }) {
  const adherence =
    meals.mealsPlanned > 0
      ? Math.round((meals.mealsEaten / meals.mealsPlanned) * 100)
      : null;

  return (
    <Card title="Meal Performance">
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{meals.thumbsUp}</Text>
          <Text style={styles.statLabel}>Liked</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{meals.thumbsDown}</Text>
          <Text style={styles.statLabel}>Disliked</Text>
        </View>
        {adherence != null && (
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{adherence}%</Text>
            <Text style={styles.statLabel}>Eaten</Text>
          </View>
        )}
      </View>
      {meals.topFeedbackTags.length > 0 && (
        <View style={styles.tagRow}>
          {meals.topFeedbackTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function WeeklyInsightCard({ insight }: { insight: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightTitle}>Weekly Insight</Text>
      <Text style={styles.insightBody}>{insight}</Text>
    </View>
  );
}

function SignalGapCard({
  total,
  used,
}: {
  total: number;
  used: number;
}) {
  return (
    <View style={styles.gapCard}>
      <Text style={styles.gapText}>
        You gave me {total} signal{total !== 1 ? "s" : ""}. I used {used}.
      </Text>
      <Text style={styles.gapSubtext}>
        With Pro, every signal sharpens your picture.
      </Text>
    </View>
  );
}

export function WeeklyReviewScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReview = useCallback(async () => {
    try {
      const data = await getLatestWeeklyReview();
      setReview(data);
    } catch {
      // No review available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={K.brown} />
      </SafeAreaView>
    );
  }

  if (!review) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={typography.h2}>No review yet</Text>
          <Text style={[typography.body, { marginTop: spacing.sm, textAlign: "center" }]}>
            Your first weekly review will arrive Sunday evening.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={typography.button}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { data, tier, dayNumber } = review;
  const showSignalGap = tier === "free" && dayNumber >= 14;
  const showInsight = data.weeklyInsight != null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Weekly Review</Text>
        <Text style={styles.weekDate}>
          Week of{" "}
          {new Date(review.weekStartDate + "T00:00:00").toLocaleDateString(
            "en-US",
            { month: "long", day: "numeric" },
          )}
        </Text>

        <ScoreSummary summary={data.summary} />
        <EnergyCard energy={data.energy} />
        <StressCard stress={data.stress} />
        <SleepCard sleep={data.sleep} />
        <MealsCard meals={data.meals} />

        {showInsight && <WeeklyInsightCard insight={data.weeklyInsight!} />}

        {showSignalGap && (
          <SignalGapCard
            total={data.summary.totalSignals}
            used={data.summary.usedSignals}
          />
        )}

        {data.scanPromptShown && (
          <TouchableOpacity
            style={styles.scanPrompt}
            onPress={() => navigation.navigate("Scan", { mode: "rescan" })}
          >
            <Text style={styles.scanPromptText}>
              A scan would sharpen next week's picture.
            </Text>
            <Text style={styles.scanPromptCta}>Scan now</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={typography.button}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heading: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  weekDate: {
    ...typography.bodySmall,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: K.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: K.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  cardBody: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  bold: {
    fontFamily: fonts.dmSansBold,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statNumber: {
    fontFamily: fonts.playfairBold,
    fontSize: 28,
    color: K.text,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  trendUp: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    color: K.ok,
    marginLeft: 4,
  },
  trendDown: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    color: K.err,
    marginLeft: 4,
  },
  trendStable: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    color: K.faded,
    marginLeft: 4,
  },
  barChart: {
    marginTop: spacing.sm,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  barLabel: {
    ...typography.caption,
    width: 50,
    textTransform: "capitalize",
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: K.border,
    borderRadius: 4,
    marginHorizontal: spacing.sm,
  },
  barFill: {
    height: 8,
    backgroundColor: K.ochre,
    borderRadius: 4,
    minWidth: 4,
  },
  barCount: {
    ...typography.caption,
    width: 20,
    textAlign: "right",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: K.bone,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    ...typography.caption,
    color: K.text,
  },
  insightCard: {
    backgroundColor: K.blue,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  insightTitle: {
    ...typography.h3,
    color: K.brown,
    marginBottom: spacing.sm,
  },
  insightBody: {
    ...typography.body,
    color: K.brown,
  },
  gapCard: {
    backgroundColor: K.bone,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  gapText: {
    ...typography.bodyMedium,
  },
  gapSubtext: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  scanPrompt: {
    backgroundColor: K.brown,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  scanPromptText: {
    ...typography.body,
    color: K.bone,
    textAlign: "center",
  },
  scanPromptCta: {
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    color: K.ochre,
    marginTop: spacing.sm,
  },
  closeButton: {
    backgroundColor: K.brown,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  backButton: {
    backgroundColor: K.brown,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
});

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { K, TC, toMetabolicType, MetabolicType } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import { TYPE_CONFIGS } from "../../constants/types";
import { useApp } from "../../context/AppContext";
import { getProfile, UserProfile } from "../../services/profile";
import { useBiometricFreshness } from "../../hooks/useBiometricFreshness";
import { useAppPalette } from "../../hooks/useAppPalette";
import { logEvent, setCustomAttribute } from "../../services/braze";


// Per-type R-block logos. "Ember" alias = the Figma "Restorer" art.
const TYPE_LOGO = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
} as const;

// Per-type radial gradient stops, approximating the Figma .Gradient assets.
// All five share the dark anchor at center-bottom; the outer ring picks up the
// type's accent. "Ember" alias here = the "Restorer" gradient in Figma.
const TYPE_GRADIENT_STOPS: Record<
  MetabolicType,
  { anchor: string; mid: string; outer: string }
> = {
  Burner: { anchor: "#361416", mid: "#A45937", outer: "#D6B5A5" },
  Rebounder: { anchor: "#2D2435", mid: "#5D5470", outer: "#A89DC0" },
  Ember: { anchor: "#3A1A1F", mid: "#4F5760", outer: "#A8B8BE" },
  Chameleon: { anchor: "#4A1E2D", mid: "#6B5A4A", outer: "#A8B585" },
  Explorer: { anchor: "#4A2A4F", mid: "#8A7060", outer: "#D8B247" },
};

// Primary accent color per type, sampled from each logo's dominant hue. Used
// for the headline type word, section-title dots, and confidence accents.
const TYPE_PRIMARY: Record<MetabolicType, string> = {
  Burner: "#C2774A", // terracotta / copper-orange
  Rebounder: "#9479A6", // muted mauve-purple
  Ember: "#6F949D", // slate blue (Restorer)
  Chameleon: "#7E8C63", // sage / olive green
  Explorer: "#BF9B33", // warm gold / amber
};

// Light tint of each primary — confidence card background.
const TYPE_TINT: Record<MetabolicType, string> = {
  Burner: "#F5E9E1",
  Rebounder: "#F0EBF3",
  Ember: "#E9F0F2",
  Chameleon: "#EDEFE6",
  Explorer: "#F4EFDE",
};

// Display names (Ember's Kiln-facing name is "Restorer").
const TYPE_DISPLAY: Record<MetabolicType, string> = {
  Burner: "Burner",
  Rebounder: "Rebounder",
  Ember: "Restorer",
  Chameleon: "Chameleon",
  Explorer: "Explorer",
};

// RES-139: interim goal / strength / weakness copy per type. Confirm final
// wording with Alex before launch — this is the single place to edit it.
const PROFILE_COPY: Record<
  MetabolicType,
  { goal: string; strength: string; weakness: string }
> = {
  Burner: {
    goal: "Keep your afternoons steady — protein-forward meals head off the stress crash.",
    strength: "Drive",
    weakness: "Crashes",
  },
  Rebounder: {
    goal: "Eat enough, consistently. Your metabolism rebuilds when it feels safe.",
    strength: "Resilience",
    weakness: "Restriction",
  },
  Ember: {
    goal: "Focus on consistent eating habits — your body does best when it's nourished, not restricted.",
    strength: "Consistency",
    weakness: "Recovery",
  },
  Chameleon: {
    goal: "Time meals to your rhythm — work with your cycle, not against it.",
    strength: "Adaptability",
    weakness: "Consistency",
  },
  Explorer: {
    goal: "Keep a balanced baseline and check in daily so I can learn your pattern fast.",
    strength: "Adaptability",
    weakness: "Quiet signals",
  },
};

// RES-139: the "Your goal" card now reflects the user's actual onboarding goal
// answer (layer1.goal slug from onboardingSurvey.ts), sprucified into Ester's
// voice. Falls back to the per-type PROFILE_COPY.goal when no goal is stored
// (older accounts). Single place to edit this wording.
const GOAL_COPY: Record<string, string> = {
  weight_loss:
    "Lose weight in a way that lasts — I'll keep your meals satisfying so the change actually sticks.",
  training:
    "Train with purpose — I'll time your meals to fuel the work and sharpen your recovery.",
  maintain_weight:
    "Hold your steady state — balanced, consistent meals to keep you right where you want to be.",
  understand_food_impact:
    "Tune into your body — I'll help you see how different foods really move your energy and recovery.",
};

const HEADER_HEIGHT = 344;

type TrendDirection = "up" | "down" | "same" | null;

function dirFromNumbers(current: number | null, previous: number | null): TrendDirection {
  if (current === null || previous === null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

function deltaText(dir: TrendDirection): string {
  switch (dir) {
    case "up":
      return "Up from last week";
    case "down":
      return "Down from last week";
    case "same":
      return "Same as last week";
    default:
      return "Building your baseline";
  }
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// Energy words ordered low → high. Check-in values (low/off/steady/good/high)
// share the rank space with typeConfig fallback words (okay/moderate/...).
const ENERGY_RANK: Record<string, number> = {
  low: 1,
  off: 1.5,
  okay: 2,
  moderate: 2,
  fluctuating: 2.5,
  steady: 3,
  stable: 3,
  good: 3.5,
  high: 4,
};

function energyRank(word: string | null | undefined): number | null {
  if (!word) return null;
  return ENERGY_RANK[word.toLowerCase()] ?? null;
}

type SubscriptionTier = "pro" | "free" | "none";

// Weekly "living pattern" timeline entries (weekday + MM.DD + Ester note),
// derived from the user's check-ins. Falls back to an empty list handled by
// the caller. Limited to the most recent 5 days.
function buildTimeline(
  profile: UserProfile,
): Array<{ weekday: string; dateShort: string; note: string }> {
  const rows: Array<{
    weekday: string;
    dateShort: string;
    note: string;
    sortKey: number;
  }> = [];

  const energyNote: Record<string, string> = {
    high: "Your energy ran high — meals are fueling you well.",
    good: "Energy held strong through the day.",
    steady: "Steady energy. Your pattern is holding.",
    stable: "Steady energy. Your pattern is holding.",
    okay: "Moderate energy. I'm watching for the pattern.",
    off: "Energy dipped a little — I adjusted your plan.",
    low: "Low energy flagged. I'll tune tomorrow's meals.",
  };

  for (const entry of profile.layer2.energyLog) {
    const d = new Date(entry.date);
    rows.push({
      weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
      dateShort: d
        .toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
        .replace("/", "."),
      note: energyNote[entry.energy?.toLowerCase()] || `Energy: ${entry.energy}`,
      sortKey: d.getTime(),
    });
  }

  for (const entry of profile.layer2.stressTags) {
    const real = entry.tags.filter((t) => t.toLowerCase() !== "none");
    if (real.length > 0) {
      const d = new Date(entry.date);
      rows.push({
        weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
        dateShort: d
          .toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
          .replace("/", "."),
        note: `I linked your stress signals to ${real.join(", ").toLowerCase()}.`,
        sortKey: d.getTime(),
      });
    }
  }

  return rows
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 5)
    .map(({ weekday, dateShort, note }) => ({ weekday, dateShort, note }));
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { state, resetState } = useApp();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const insets = useSafeAreaInsets();
  const palette = useAppPalette();
  // Neutral surface tokens for the body content (the type-gradient header is
  // unaffected). Accent surfaces (blue cards) use the design colors directly.
  const surfaces = palette.evening
    ? {
        body: "#3D1F22",
        card: "#2A0E10",
        confidence: "#1F3D52",
        textStrong: K.bone,
        textSubtle: "#B8A7A8",
        // Lighter warm tone so outlines + timeline lines read on the dark
        // maroon body (#3D1F22); the old #4F2A2D was nearly invisible.
        divider: "#7A565A",
        outlineBorder: "#5A2F32",
      }
    : {
        body: K.white,
        card: K.bone,
        confidence: "#E9F0F2",
        textStrong: K.brown,
        textSubtle: "#7e6869",
        divider: "#C3B9BA",
        outlineBorder: "#9C8E8E",
      };

  const metabolicType =
    toMetabolicType(profile?.layer1?.primaryBucket) ??
    toMetabolicType(state.user.metabolicType) ??
    "Explorer";
  const typeConfig = TYPE_CONFIGS[metabolicType];
  const typeDisplay = TYPE_DISPLAY[metabolicType];
  const copy = PROFILE_COPY[metabolicType];
  // Prefer the user's actual onboarding goal answer; fall back to per-type copy.
  const goalText = GOAL_COPY[profile?.layer1?.goal ?? ""] ?? copy.goal;
  const primary = TYPE_PRIMARY[metabolicType];
  const tint = TYPE_TINT[metabolicType];

  const loadProfile = useCallback(() => {
    getProfile().then(setProfile).catch(() => null);
  }, []);

  useEffect(() => {
    logEvent("profile_main");
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadProfile);
    return unsubscribe;
  }, [navigation, loadProfile]);

  const tier: SubscriptionTier =
    state.biometrics || (profile?.layer3.scanCount ?? 0) > 0 ? "pro" : "free";
  const hasScan = !!state.biometrics || (profile?.layer3.scanCount ?? 0) > 0;

  useEffect(() => {
    if (!profile) return;
    setCustomAttribute("metabolic_type", metabolicType);
    setCustomAttribute("paid_user", tier === "pro");
  }, [profile, metabolicType, tier]);

  const timeline =
    profile && profile.layer2.energyLog.length > 0 ? buildTimeline(profile) : [];

  const lastScanAt = profile?.layer3?.latestScan?.scannedAt ?? null;
  const lastCheckInDate = profile?.layer2?.energyLog?.length
    ? profile.layer2.energyLog[0].date
    : null;
  const { isFresh: biometricsFresh } = useBiometricFreshness(
    lastScanAt,
    lastCheckInDate,
  );

  const latestScan = biometricsFresh ? profile?.layer3.latestScan : null;

  // --- Signals (stress / energy / recovery) -------------------------------
  const stressTagsSorted = [...(profile?.layer2?.stressTags ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const stressLevelFromTags = (tags: string[] | undefined) => {
    if (!tags || tags.length === 0) return null;
    const onlyNone = tags.every((t) => t.toLowerCase() === "none");
    return onlyNone ? "low" : "high";
  };
  const currentStressLevel = stressLevelFromTags(stressTagsSorted[0]?.tags);
  const priorStressLevel = stressLevelFromTags(stressTagsSorted[1]?.tags);
  const stressWord =
    currentStressLevel === "low"
      ? "Stable"
      : currentStressLevel === "high"
        ? "Elevated"
        : cap(String(typeConfig.signals.stress));

  const energyLogSorted = [...(profile?.layer2?.energyLog ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const energyWord = cap(
    String(energyLogSorted[0]?.energy ?? typeConfig.signals.energy),
  );

  const scanHistorySorted = [...(profile?.layer3?.scanHistory ?? [])].sort(
    (a: any, b: any) =>
      new Date(a.scannedAt ?? a.timestamp ?? a.date).getTime() -
      new Date(b.scannedAt ?? b.timestamp ?? b.date).getTime(),
  );
  const para = (s: any): number | null =>
    s?.parasympatheticActivity ?? s?.parasympathetic_activity ?? null;
  const stressIdx = (s: any): number | null =>
    s?.stressIndex ?? s?.stress_index ?? null;

  const recoveryCurrent = latestScan ? para(latestScan) : null;
  const recoveryPrior =
    scanHistorySorted.length >= 2
      ? para(scanHistorySorted[scanHistorySorted.length - 2])
      : null;
  const recoveryWord =
    recoveryCurrent != null
      ? recoveryCurrent >= 45
        ? "Strong"
        : recoveryCurrent >= 30
          ? "Building"
          : "Slow"
      : cap(String(typeConfig.signals.recovery));

  // Sparkline series (chronological, last 7 points).
  const stressSeries = scanHistorySorted
    .map(stressIdx)
    .filter((n): n is number => n != null)
    .slice(-7);
  const recoverySeries = scanHistorySorted
    .map(para)
    .filter((n): n is number => n != null)
    .slice(-7);
  const energySeries = [...energyLogSorted]
    .reverse()
    .map((e) => energyRank(e.energy))
    .filter((n): n is number => n != null)
    .slice(-7);
  const latestStressIdx = stressSeries.length ? stressSeries[stressSeries.length - 1] : null;

  // Normalized 0–1 value level per signal — drives the single-data-point line
  // slope (up = high, down = low, flat = middle). Ranges are the plausible
  // span for each metric (stress/recovery indices, energy rank 1–4).
  const norm01 = (v: number | null, lo: number, hi: number) =>
    v == null ? 0.5 : Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const stressLevel = norm01(latestStressIdx, 20, 80);
  const recoveryLevel = norm01(recoveryCurrent, 20, 60);
  const energyLevel = norm01(energyRank(energyLogSorted[0]?.energy ?? null), 1, 4);

  // Trends
  const STRESS_RANK = { low: 0, high: 1 } as const;
  const stressTrendDir = dirFromNumbers(
    currentStressLevel ? STRESS_RANK[currentStressLevel] : null,
    priorStressLevel ? STRESS_RANK[priorStressLevel] : null,
  );
  const recoveryTrendDir = dirFromNumbers(recoveryCurrent, recoveryPrior);
  const energyTrendDir = dirFromNumbers(
    energyRank(energyLogSorted[0]?.energy ?? null),
    energyRank(energyLogSorted[1]?.energy ?? null),
  );

  const confidencePct = Math.round(profile?.confidence?.composite ?? 0);
  const daysToFull = profile?.confidence
    ? Math.max(5, Math.min(120, 100 - confidencePct))
    : 0;

  const authFullName = [
    state.auth.authUser?.firstName,
    state.auth.authUser?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const userName = authFullName || state.user.name?.trim() || "You";

  const handleResetProfile = () => {
    logEvent("profile_resetProfileCTA");
    Alert.alert(
      "Reset Profile",
      "This will clear all your data and restart the onboarding process. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetState },
      ],
    );
  };

  const handleSettingsPress = () => {
    logEvent("profile_settingsCTA");
    (navigation as any).navigate("Settings");
  };

  const goScan = () =>
    hasScan
      ? navigation.navigate("Scan", { mode: "rescan" })
      : navigation.navigate("Scan", { mode: "rescan" });

  return (
    <View style={[styles.container, { backgroundColor: surfaces.body }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top-bounce sentinel keeps the iOS overscroll reading as gradient. */}
        <View
          style={[
            styles.topBounceSentinel,
            { backgroundColor: TYPE_GRADIENT_STOPS[metabolicType].outer },
          ]}
        />
        {/* Gradient header: per-type radial (dark anchor → type accent) */}
        <View style={styles.headerWrap}>
          <HeaderTypeGradient type={metabolicType} />
          <TouchableOpacity
            style={[styles.headerCogWrap, { top: insets.top + 12 }]}
            onPress={handleSettingsPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SettingsIcon color={K.white} />
          </TouchableOpacity>
          <View style={styles.headerInner}>
            <Image
              source={TYPE_LOGO[metabolicType]}
              style={styles.headerAvatar}
              resizeMode="contain"
            />
            <Text style={styles.headerName}>{userName}</Text>
            <View style={styles.headerTag}>
              <Text style={styles.headerTagText}>{typeDisplay}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.bodyWrap, { backgroundColor: surfaces.body }]}>
          {/* Headline: "As a {Type}, {tagline}" */}
          <Text style={[styles.headline, { color: surfaces.textStrong }]}>
            As {article(typeDisplay)}{" "}
            <Text style={[styles.headlineType, { color: primary }]}>{typeDisplay},</Text>{" "}
            {typeConfig.tagline.replace(/\.$/, "")}.
          </Text>

          {/* Your Goal */}
          <Section eyebrow="Your goal" eyebrowColor={surfaces.textStrong} dotColor={primary}>
            <View style={styles.blueCard}>
              <TypeGradientFill type={metabolicType} idKey="goal" />
              <Text style={styles.blueCardBody}>{goalText}</Text>
              <View style={styles.ghostArrowButton}>
                <ArrowForwardIcon />
              </View>
            </View>
          </Section>

          {/* Strength + weakness */}
          <View style={styles.strengthRow}>
            <View style={styles.strengthCol}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.eyebrowDot, { backgroundColor: primary }]} />
                <Text style={[styles.eyebrowText, { color: surfaces.textStrong }]}>
                  Your biggest strength
                </Text>
              </View>
              <View style={[styles.blueCard, { alignItems: "center" }]}>
                <TypeGradientFill type={metabolicType} idKey="strength" />
                <Text style={styles.blueCardTitle}>{copy.strength}</Text>
                <View style={styles.ghostArrowButton}>
                  <ArrowForwardIcon />
                </View>
              </View>
            </View>
            <View style={styles.strengthCol}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.eyebrowDot, { backgroundColor: primary }]} />
                <Text style={[styles.eyebrowText, { color: surfaces.textStrong }]}>
                  Your weakness
                </Text>
              </View>
              <View style={[styles.outlineCard, { borderColor: surfaces.divider }]}>
                <Text style={[styles.outlineCardTitle, { color: surfaces.textSubtle }]}>
                  {copy.weakness}
                </Text>
                <View style={[styles.outlineArrowButton, { borderColor: surfaces.textSubtle }]}>
                  <ArrowForwardIcon color={surfaces.textSubtle} />
                </View>
              </View>
            </View>
          </View>

          {/* Today's signals */}
          <Section eyebrow="Today's signals" eyebrowColor={surfaces.textStrong} dotColor={primary}>
            {biometricsFresh ? (
              <View style={styles.signalStack}>
                <SignalBanner
                  title="Stress Index"
                  delta={deltaText(stressTrendDir)}
                  value={stressWord}
                  series={stressSeries}
                  today={latestStressIdx}
                  surfaces={surfaces}
                  accent={primary}
                  level={stressLevel}
                  evening={palette.evening}
                  onPress={goScan}
                />
                <SignalBanner
                  title="Energy"
                  delta={deltaText(energyTrendDir)}
                  value={energyWord}
                  series={energySeries}
                  today={null}
                  surfaces={surfaces}
                  accent={primary}
                  level={energyLevel}
                  evening={palette.evening}
                  onPress={goScan}
                />
                <SignalBanner
                  title="Recovery"
                  delta={deltaText(recoveryTrendDir)}
                  value={recoveryWord}
                  series={recoverySeries}
                  today={recoveryCurrent}
                  surfaces={surfaces}
                  accent={primary}
                  level={recoveryLevel}
                  evening={palette.evening}
                  onPress={goScan}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.staleNudge, { backgroundColor: surfaces.card }]}
                onPress={() =>
                  hasScan
                    ? navigation.navigate("Scan", { mode: "rescan" })
                    : navigation.navigate("EsterChat", { context: "general" })
                }
              >
                <Text style={[styles.staleNudgeTitle, { color: surfaces.textStrong }]}>
                  {hasScan ? "Refresh your signals" : "No recent signals"}
                </Text>
                <Text style={[styles.staleNudgeBody, { color: surfaces.textSubtle }]}>
                  {hasScan
                    ? "A fresh scan sharpens your meal recommendations. Tap to scan."
                    : "A quick check-in helps Ester tune your meals. Tap to start."}
                </Text>
              </TouchableOpacity>
            )}
          </Section>

          {/* Living pattern document (no eyebrow/title per design) */}
          <View style={styles.lpdWrap}>
              {/* Weekly observations card */}
              <View style={[styles.timelineCard, { borderColor: surfaces.divider }]}>
                <Image source={TYPE_LOGO[metabolicType]} style={styles.timelineEster} resizeMode="contain" />
                <View style={styles.timelineBody}>
                  <Text style={[styles.timelineHeading, { color: surfaces.textStrong }]}>
                    Here's what I noticed about you this week!
                  </Text>
                  {timeline.length > 0 ? (
                    timeline.map((row, i) => (
                      <View key={i} style={styles.timelineRow}>
                        <View style={styles.timelineRail}>
                          <TimelineNode />
                          {i < timeline.length - 1 ? (
                            <View style={[styles.timelineLine, { backgroundColor: surfaces.divider }]} />
                          ) : null}
                        </View>
                        <View style={styles.timelineRowText}>
                          <View style={styles.timelineDateRow}>
                            <Text style={[styles.timelineWeekday, { color: surfaces.textStrong }]}>
                              {row.weekday}
                            </Text>
                            <Text style={[styles.timelineDate, { color: surfaces.textSubtle }]}>
                              {row.dateShort}
                            </Text>
                          </View>
                          <Text style={[styles.timelineNote, { color: surfaces.textStrong }]}>
                            {row.note}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.timelineNote, { color: surfaces.textSubtle }]}>
                      Complete a daily check-in and I'll start building your weekly pattern here.
                    </Text>
                  )}
                </View>
              </View>

              {/* Scan CTA */}
              <TouchableOpacity
                style={styles.scanCta}
                onPress={goScan}
                activeOpacity={0.9}
              >
                <TypeGradientFill type={metabolicType} idKey="scan" />
                <Text style={styles.scanCtaText}>
                  Keep up the momentum.{"  "}
                  <Text style={styles.scanCtaTextBold}>
                    {hasScan ? "Start today's scan." : "Start your first scan."}
                  </Text>
                </Text>
                <View style={styles.scanCtaArrow}>
                  <ArrowForwardIcon />
                </View>
              </TouchableOpacity>

              {/* See previous scans */}
              <TouchableOpacity
                style={[styles.previousScans, { borderColor: surfaces.divider }]}
                onPress={() => (navigation as any).navigate("WeeklyReview")}
                activeOpacity={0.8}
              >
                <Text style={[styles.previousScansText, { color: surfaces.textStrong }]}>
                  Or see previous scans
                </Text>
              </TouchableOpacity>
          </View>

          {/* Ester confidence */}
          <Section eyebrow="Ester confidence" eyebrowColor={surfaces.textStrong} dotColor={primary}>
            <View
              style={[
                styles.confidenceCard,
                // A light tint of the type's primary (lighter than the primary
                // itself) in both day and evening — the confidence panel always
                // reads as a pale accent card, so its text stays fixed-dark.
                { backgroundColor: tint },
              ]}
            >
              <View style={styles.confidenceTopRow}>
                <View style={styles.confidencePctRow}>
                  <Text style={[styles.confidencePct, { color: K.brown }]}>
                    {confidencePct}%
                  </Text>
                  <ConfidencePie fraction={confidencePct / 100} color={K.brown} />
                </View>
                <Text style={[styles.confidenceCopy, { color: K.brown }]}>
                  We're still learning your signals so continue to scan each day.
                </Text>
              </View>
              <View style={styles.confidenceFooter}>
                <Text style={[styles.confidenceMeta, { color: "#513436" }]}>
                  Estimated {daysToFull} days til near 100% confidence
                </Text>
                <TouchableOpacity
                  style={[styles.confidenceButton, { backgroundColor: primary }]}
                  onPress={() => navigation.navigate("EsterChat", { context: "general" })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confidenceButtonText}>What does this mean?</Text>
                  <InfoIcon />
                </TouchableOpacity>
              </View>
            </View>
          </Section>

          {/* Reset (dev tool — tucked at the bottom) */}
          <TouchableOpacity style={styles.resetLink} onPress={handleResetProfile}>
            <Text style={styles.resetLinkText}>Reset profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

interface SectionProps {
  eyebrow: string;
  children: React.ReactNode;
  eyebrowColor?: string;
  dotColor?: string;
}

function Section({ eyebrow, children, eyebrowColor, dotColor }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <View style={[styles.eyebrowDot, dotColor ? { backgroundColor: dotColor } : null]} />
        <Text style={[styles.eyebrowText, eyebrowColor ? { color: eyebrowColor } : null]}>
          {eyebrow}
        </Text>
      </View>
      {children}
    </View>
  );
}

type Surfaces = {
  body: string;
  card: string;
  confidence: string;
  textStrong: string;
  textSubtle: string;
  divider: string;
  outlineBorder: string;
};

function SignalBanner({
  title,
  delta,
  value,
  series,
  today,
  surfaces,
  accent,
  level,
  evening,
  onPress,
}: {
  title: string;
  delta: string;
  value: string;
  series: number[];
  today: number | null;
  surfaces: Surfaces;
  accent: string;
  level: number;
  evening: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.signalBanner, { borderColor: surfaces.divider }]}>
      <View style={styles.signalBannerLeft}>
        <View style={styles.signalBannerHead}>
          <Text style={[styles.signalBannerTitle, { color: surfaces.textStrong }]}>{title}</Text>
          <Text style={[styles.signalBannerDelta, { color: surfaces.textSubtle }]}>{delta}</Text>
        </View>
        <View style={styles.signalBannerValueRow}>
          <Text style={[styles.signalBannerValue, { color: surfaces.textStrong }]} numberOfLines={1}>
            {value}
          </Text>
          <TouchableOpacity
            style={[styles.outlineArrowButton, { borderColor: surfaces.textSubtle }]}
            onPress={onPress}
            hitSlop={6}
          >
            <ArrowForwardIcon color={surfaces.textSubtle} />
          </TouchableOpacity>
        </View>
      </View>
      <MiniGraph data={series} today={today} accent={accent} level={level} evening={evening} />
    </View>
  );
}

const GRAPH_W = 116;
const GRAPH_H = 74;

function MiniGraph({
  data,
  today,
  accent,
  level,
  evening,
}: {
  data: number[];
  today: number | null;
  accent: string;
  // Normalized 0–1 position of the value within its plausible range. Only used
  // when there's a single data point (no real trend) to pick the line's slope.
  level: number;
  evening: boolean;
}) {
  // All graph elements are shades of the metabolic type's accent color.
  const fillId = `graphFill_${accent.replace("#", "")}`;
  // Inset horizontally so the endpoint dot (r=3) isn't clipped by the SVG edge.
  const padX = 4;
  // "Today: NN" pill inverts against the UI: light pill in dark mode, dark pill
  // in light mode, so it always reads against the background behind it.
  const pillBg = evening ? "rgba(243,239,227,0.92)" : "rgba(54,20,22,0.88)";
  const pillTextColor = evening ? K.brown : K.bone;

  // Single data point: no trend to draw, so show one straight accent line whose
  // slope reflects the value level — up for high, down for low, flat for middle.
  if (data.length === 1) {
    const x0 = padX;
    const x1 = GRAPH_W - padX;
    const midY = GRAPH_H / 2;
    const rise = 13;
    let y0 = midY;
    let y1 = midY;
    if (level >= 0.6) {
      y0 = midY + rise; // high value → ascending
      y1 = midY - rise;
    } else if (level <= 0.4) {
      y0 = midY - rise; // low value → descending
      y1 = midY + rise;
    }
    const line = `M${x0} ${y0.toFixed(1)} L ${x1} ${y1.toFixed(1)}`;
    const area = `${line} L ${x1} ${GRAPH_H} L ${x0} ${GRAPH_H} Z`;
    return (
      <View style={styles.graphWrap}>
        <Svg width={GRAPH_W} height={GRAPH_H}>
          <Defs>
            <RadialGradient id={fillId} cx="50%" cy="0%" rx="90%" ry="120%">
              <Stop offset="0" stopColor={accent} stopOpacity={0.5} />
              <Stop offset="1" stopColor={accent} stopOpacity={0.06} />
            </RadialGradient>
          </Defs>
          <Path d={area} fill={`url(#${fillId})`} />
          <Path
            d={`M${x0} ${GRAPH_H - 4} L ${x1} ${GRAPH_H - 4}`}
            stroke={accent}
            strokeOpacity={0.45}
            strokeWidth={1.8}
            strokeDasharray="0.5 4"
            strokeLinecap="round"
          />
          <Path d={line} stroke={accent} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x1} cy={y1} r={3} fill={accent} />
        </Svg>
        {today != null ? (
          <View style={[styles.graphTooltip, { backgroundColor: pillBg }]}>
            <Text style={[styles.graphTooltipText, { color: pillTextColor }]}>Today: {Math.round(today)}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (data.length === 0) {
    // No data at all — flat dashed baseline, no tooltip.
    return (
      <View style={styles.graphWrap}>
        <Svg width={GRAPH_W} height={GRAPH_H}>
          <Path
            d={`M0 ${GRAPH_H - 14} L ${GRAPH_W} ${GRAPH_H - 14}`}
            stroke={accent}
            strokeOpacity={0.4}
            strokeWidth={1.5}
            strokeDasharray="3 4"
          />
        </Svg>
      </View>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  // Reserve extra headroom at the top when the "Today: NN" pill is shown so the
  // line can't run under it (the pill sits top-right and recovery/stress peaks
  // land there). Graphs without a pill keep full amplitude.
  const padTop = today != null ? 24 : 12;
  const padBottom = 12;
  const usableH = GRAPH_H - padTop - padBottom;
  const usableW = GRAPH_W - padX * 2;
  const stepX = usableW / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: padX + i * stepX,
    y: padTop + (1 - (v - min) / span) * usableH,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = `${line} L ${last.x.toFixed(1)} ${GRAPH_H} L ${first.x.toFixed(1)} ${GRAPH_H} Z`;

  return (
    <View style={styles.graphWrap}>
      <Svg width={GRAPH_W} height={GRAPH_H}>
        <Defs>
          <RadialGradient id={fillId} cx="50%" cy="0%" rx="90%" ry="120%">
            <Stop offset="0" stopColor={accent} stopOpacity={0.5} />
            <Stop offset="1" stopColor={accent} stopOpacity={0.06} />
          </RadialGradient>
        </Defs>
        <Path d={area} fill={`url(#${fillId})`} />
        {/* Dotted baseline near the bottom of the fade (per Figma). */}
        <Path
          d={`M${first.x.toFixed(1)} ${GRAPH_H - 4} L ${last.x.toFixed(1)} ${GRAPH_H - 4}`}
          stroke={accent}
          strokeOpacity={0.45}
          strokeWidth={1.8}
          strokeDasharray="0.5 4"
          strokeLinecap="round"
        />
        <Path d={line} stroke={accent} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={3} fill={accent} />
      </Svg>
      {today != null ? (
        <View style={styles.graphTooltip}>
          <Text style={styles.graphTooltipText}>Today: {Math.round(today)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ArrowForwardIcon({ color = K.white }: { color?: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
      <Path
        d="M8.08467 5.29883H0.5C0.358111 5.29883 0.239333 5.25094 0.143667 5.15517C0.0478888 5.0595 0 4.94072 0 4.79883C0 4.65694 0.0478888 4.53817 0.143667 4.4425C0.239333 4.34672 0.358111 4.29883 0.5 4.29883H8.08467L4.6385 0.852666C4.53939 0.753555 4.49044 0.637555 4.49167 0.504666C4.493 0.371777 4.54533 0.253611 4.64867 0.150166C4.75211 0.0536109 4.86922 0.00361094 5 0.000166493C5.13078 -0.00327795 5.24789 0.0467221 5.35133 0.150166L9.57817 4.377C9.64061 4.43944 9.68461 4.50528 9.71017 4.5745C9.73583 4.64372 9.74867 4.7185 9.74867 4.79883C9.74867 4.87917 9.73583 4.95394 9.71017 5.02317C9.68461 5.09239 9.64061 5.15822 9.57817 5.22067L5.35133 9.4475C5.259 9.53983 5.14467 9.58705 5.00833 9.58917C4.872 9.59128 4.75211 9.54405 4.64867 9.4475C4.54533 9.34405 4.49367 9.22528 4.49367 9.09117C4.49367 8.95694 4.54533 8.83811 4.64867 8.73467L8.08467 5.29883Z"
        fill={color}
      />
    </Svg>
  );
}

function InfoIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={K.brown} strokeWidth={1.6} />
      <Path d="M12 11v5" stroke={K.brown} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={12} cy={8} r={1} fill={K.brown} />
    </Svg>
  );
}

const PIE_SIZE = 22;
const PIE_RADIUS = 9;
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

// Glossy "gem" bullet for the weekly-pattern timeline (per Figma): a #C3B9BA
// circle with a top-down white gloss at 50%, plus an approximated inner shadow
// (faint inner stroke) and a soft drop shadow (on the wrapping View).
function TimelineNode() {
  return (
    <View style={styles.timelineNode}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Defs>
          <LinearGradient id="timelineNodeGloss" x1="6" y1="0" x2="6" y2="12" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx={6} cy={6} r={6} fill="#C3B9BA" />
        <Circle cx={6} cy={6} r={6} fill="url(#timelineNodeGloss)" fillOpacity={0.5} />
        <Circle cx={6} cy={6} r={5.6} fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth={0.7} />
      </Svg>
    </View>
  );
}

function ConfidencePie({ fraction, color }: { fraction: number; color: string }) {
  const path = buildPieSlicePath(fraction);
  return (
    <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
      <Circle cx={PIE_CENTER} cy={PIE_CENTER} r={PIE_RADIUS} fill="none" stroke={color} strokeWidth={1.5} />
      {path ? <Path d={path} fill={color} /> : null}
    </Svg>
  );
}

function HeaderTypeGradient({ type }: { type: MetabolicType }) {
  const stops = TYPE_GRADIENT_STOPS[type];
  const gradientId = `headerBg_${type}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="100%" rx="80%" ry="105%" fx="50%" fy="100%">
            <Stop offset="0" stopColor={stops.anchor} />
            <Stop offset="0.5" stopColor={stops.mid} />
            <Stop offset="1" stopColor={stops.outer} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

// Same per-type radial gradient as the header, sized to whatever card it fills
// (percentages scale to the card box). Unique id per use so multiple instances
// don't collide. Render as the first child of an overflow-hidden card.
function TypeGradientFill({ type, idKey }: { type: MetabolicType; idKey: string }) {
  const stops = TYPE_GRADIENT_STOPS[type];
  const id = `grad_${type}_${idKey}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="100%" rx="80%" ry="120%" fx="50%" fy="100%">
            <Stop offset="0" stopColor={stops.anchor} />
            <Stop offset="0.5" stopColor={stops.mid} />
            <Stop offset="1" stopColor={stops.outer} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={19} viewBox="0 0 18 19" fill="none">
      <Path
        d="M7.89078 19C7.54978 19 7.25528 18.8868 7.00728 18.6605C6.75911 18.4343 6.60811 18.1558 6.55428 17.825L6.31003 15.9538C6.0422 15.8641 5.76753 15.7385 5.48603 15.577C5.2047 15.4153 4.95311 15.2423 4.73128 15.0577L2.99853 15.7943C2.68436 15.9328 2.3687 15.9462 2.05153 15.8345C1.7342 15.723 1.4877 15.5205 1.31203 15.227L0.185029 13.273C0.00936264 12.9795 -0.0412207 12.6689 0.0332793 12.3413C0.107613 12.0138 0.278113 11.7436 0.544779 11.5308L2.04278 10.4058C2.01978 10.2571 2.00345 10.1077 1.99378 9.95775C1.98411 9.80775 1.97928 9.65833 1.97928 9.5095C1.97928 9.36733 1.98411 9.22283 1.99378 9.076C2.00345 8.92917 2.01978 8.76858 2.04278 8.59425L0.544779 7.46925C0.278113 7.25642 0.109196 6.98458 0.0380294 6.65375C-0.0331373 6.32308 0.0191126 6.01092 0.194779 5.71725L1.31203 3.79225C1.4877 3.50508 1.7342 3.30417 2.05153 3.1895C2.3687 3.07467 2.68436 3.0865 2.99853 3.225L4.72153 3.952C4.9627 3.761 5.22011 3.58633 5.49378 3.428C5.76745 3.26967 6.03636 3.14242 6.30053 3.04625L6.55428 1.175C6.60811 0.844167 6.75911 0.565667 7.00728 0.3395C7.25528 0.113167 7.54978 0 7.89078 0H10.1063C10.4473 0 10.7418 0.113167 10.9898 0.3395C11.2379 0.565667 11.3889 0.844167 11.4428 1.175L11.687 3.05575C11.987 3.16475 12.2584 3.292 12.5013 3.4375C12.7443 3.583 12.9895 3.7545 13.237 3.952L15.0083 3.225C15.3223 3.0865 15.6379 3.07467 15.9553 3.1895C16.2726 3.30417 16.519 3.50508 16.6945 3.79225L17.812 5.727C17.9877 6.0205 18.0383 6.33108 17.9638 6.65875C17.8894 6.98625 17.7189 7.25642 17.4523 7.46925L15.9158 8.623C15.9516 8.7845 15.9712 8.9355 15.9745 9.076C15.9777 9.21633 15.9793 9.35767 15.9793 9.5C15.9793 9.63583 15.976 9.774 15.9695 9.9145C15.9632 10.0548 15.9402 10.2154 15.9005 10.3963L17.408 11.5308C17.6747 11.7436 17.8469 12.0138 17.9245 12.3413C18.002 12.6689 17.9529 12.9795 17.7773 13.273L16.6445 15.2172C16.469 15.5109 16.221 15.7135 15.9005 15.825C15.58 15.9365 15.2627 15.923 14.9485 15.7845L13.237 15.048C12.9895 15.2455 12.7369 15.4202 12.4793 15.572C12.2216 15.724 11.9575 15.8481 11.687 15.9443L11.4428 17.825C11.3889 18.1558 11.2379 18.4343 10.9898 18.6605C10.7418 18.8868 10.4473 19 10.1063 19H7.89078ZM7.99853 17.5H9.96403L10.3235 14.8212C10.8339 14.6879 11.3002 14.4985 11.7225 14.253C12.145 14.0073 12.5524 13.6916 12.9448 13.3057L15.4293 14.35L16.414 12.65L14.2448 11.0155C14.3281 10.7565 14.3848 10.5026 14.4148 10.2537C14.4449 10.0051 14.46 9.75383 14.46 9.5C14.46 9.23967 14.4449 8.98842 14.4148 8.74625C14.3848 8.50392 14.3281 8.25642 14.2448 8.00375L16.433 6.35L15.4485 4.65L12.935 5.7095C12.6004 5.35183 12.1994 5.03583 11.7323 4.7615C11.2649 4.48717 10.7922 4.29292 10.314 4.17875L9.99853 1.5H8.01403L7.68303 4.16925C7.17286 4.28975 6.70178 4.47433 6.26978 4.723C5.83761 4.97183 5.42536 5.29233 5.03303 5.6845L2.54853 4.65L1.56403 6.35L3.72353 7.9595C3.6402 8.19683 3.58186 8.44367 3.54853 8.7C3.5152 8.95633 3.49853 9.22617 3.49853 9.5095C3.49853 9.76983 3.5152 10.025 3.54853 10.275C3.58186 10.525 3.63703 10.7718 3.71403 11.0155L1.56403 12.65L2.54853 14.35L5.02353 13.3C5.40303 13.6897 5.80878 14.0089 6.24078 14.2578C6.67295 14.5064 7.15053 14.6974 7.67353 14.8307L7.99853 17.5ZM9.01003 12.5C9.84203 12.5 10.55 12.208 11.134 11.624C11.718 11.04 12.01 10.332 12.01 9.5C12.01 8.668 11.718 7.96 11.134 7.376C10.55 6.792 9.84203 6.5 9.01003 6.5C8.1677 6.5 7.45711 6.792 6.87828 7.376C6.29945 7.96 6.01003 8.668 6.01003 9.5C6.01003 10.332 6.29945 11.04 6.87828 11.624C7.45711 12.208 8.1677 12.5 9.01003 12.5Z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.white },
  bodyWrap: {
    backgroundColor: K.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
    marginTop: -16,
  },
  topBounceSentinel: {
    position: "absolute",
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },
  headerWrap: {
    height: HEADER_HEIGHT,
    position: "relative",
  },
  headerInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerCogWrap: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  headerAvatar: {
    width: 132,
    height: 132,
    // The R-mark art sits left in its canvas (the antenna dot on the upper-right
    // widens the bounding box), so contain-centering leaves the body visually
    // left of center. Nudge right so the mark reads centered under the name.
    transform: [{ translateX: 7 }],
  },
  headerName: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    color: K.white,
    letterSpacing: -0.32,
    marginTop: 4,
  },
  headerTag: {
    backgroundColor: "rgba(250,253,254,0.24)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 5,
  },
  headerTagText: {
    fontFamily: fonts.quadrant,
    fontSize: 14,
    color: K.white,
    letterSpacing: -0.14,
  },
  headline: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    color: K.brown,
    letterSpacing: -0.24,
    lineHeight: 30,
  },
  headlineType: {
    color: "#5C7177",
  },
  section: {},
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingLeft: 4,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.blue,
  },
  eyebrowText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    color: K.brown,
    letterSpacing: -0.12,
  },
  // Blue accent card (goal / strength / scan CTA share the bubble shape).
  blueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: K.blue,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 12,
    paddingLeft: 10,
    overflow: "hidden",
  },
  blueCardBody: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.white,
    letterSpacing: -0.16,
    paddingLeft: 4,
  },
  blueCardTitle: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.white,
    letterSpacing: -0.2,
    paddingLeft: 4,
  },
  ghostArrowButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    flexDirection: "row",
    gap: 12,
  },
  strengthCol: {
    flex: 1,
  },
  outlineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 0.5,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 16,
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 12,
    paddingLeft: 10,
  },
  outlineCardTitle: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    paddingLeft: 4,
  },
  outlineArrowButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Signal banners
  signalStack: {
    gap: 8,
  },
  signalBanner: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    borderWidth: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 24,
    padding: 16,
    overflow: "hidden",
  },
  signalBannerLeft: {
    flex: 1,
    gap: 12,
  },
  signalBannerHead: {
    gap: 4,
  },
  signalBannerTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    letterSpacing: -0.14,
  },
  signalBannerDelta: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  signalBannerValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  signalBannerValue: {
    fontFamily: fonts.quadrant,
    fontSize: 32,
    letterSpacing: -0.32,
  },
  graphWrap: {
    width: GRAPH_W,
    height: GRAPH_H,
    justifyContent: "center",
  },
  graphTooltip: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "rgba(54,20,22,0.12)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  graphTooltipText: {
    fontFamily: fonts.quadrant,
    fontSize: 10,
    color: K.brown,
    letterSpacing: -0.1,
  },
  staleNudge: {
    backgroundColor: K.bone,
    borderRadius: 4,
    padding: 16,
    gap: 4,
  },
  staleNudgeTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.brown,
    letterSpacing: -0.16,
  },
  staleNudgeBody: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: "#7e6869",
    letterSpacing: -0.14,
  },
  // Living pattern document
  lpdWrap: {
    gap: 12,
  },
  timelineCard: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 0.5,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    paddingTop: 10,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 12,
  },
  timelineEster: {
    width: 44,
    height: 44,
  },
  timelineBody: {
    flex: 1,
    gap: 10,
    paddingTop: 2,
  },
  timelineHeading: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 8,
  },
  timelineRail: {
    alignItems: "center",
    width: 12,
  },
  timelineNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
    // Soft drop shadow per Figma: 0 -0.52px 1.04px rgba(0,0,0,0.16).
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 1.04,
    shadowOffset: { width: 0, height: -0.52 },
    elevation: 1,
  },
  timelineLine: {
    flex: 1,
    width: 0.5,
    marginTop: 4,
  },
  timelineRowText: {
    flex: 1,
    gap: 2,
    paddingBottom: 2,
  },
  timelineDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timelineWeekday: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.12,
  },
  timelineDate: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.12,
  },
  timelineNote: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    letterSpacing: -0.14,
    lineHeight: 19,
  },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: K.blue,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 16,
    paddingLeft: 16,
    overflow: "hidden",
  },
  scanCtaText: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.white,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  scanCtaTextBold: {
    fontFamily: fonts.catalogueBold,
  },
  scanCtaArrow: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  previousScans: {
    borderWidth: 0.5,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 40,
    paddingVertical: 14,
    alignItems: "center",
  },
  previousScansText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
  },
  // Confidence
  confidenceCard: {
    backgroundColor: "#E9F0F2",
    borderRadius: 4,
    padding: 16,
    gap: 16,
  },
  confidenceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  confidencePctRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  confidencePct: {
    fontFamily: fonts.catalogueBold,
    fontSize: 24,
    color: K.brown,
    letterSpacing: -0.24,
  },
  confidenceCopy: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: K.brown,
    letterSpacing: -0.14,
  },
  confidenceFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  confidenceMeta: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 12,
    color: "#513436",
    letterSpacing: -0.12,
  },
  confidenceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.blue,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  confidenceButtonText: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.brown,
    letterSpacing: -0.14,
  },
  resetLink: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetLinkText: {
    fontFamily: fonts.catalogue,
    fontSize: 13,
    color: K.faded,
    textDecorationLine: "underline",
  },
});

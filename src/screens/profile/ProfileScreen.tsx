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
import { K, TC, toMetabolicType } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import { TYPE_CONFIGS } from "../../constants/types";
import { useApp } from "../../context/AppContext";
import { getProfile, UserProfile } from "../../services/profile";
import { useBiometricFreshness } from "../../hooks/useBiometricFreshness";
import { useAppPalette } from "../../hooks/useAppPalette";
import { logEvent, setCustomAttribute } from "../../services/braze";

const ESTER_AVATAR = require("../../../assets/images/ester-avatar.png");

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
  "Burner" | "Rebounder" | "Ember" | "Chameleon" | "Explorer",
  { anchor: string; mid: string; outer: string }
> = {
  // Burner: Earth palette per Figma logo (rust-orange + brown anchor)
  Burner: { anchor: "#361416", mid: "#A45937", outer: "#D6B5A5" },
  // Rebounder: cool slate-purple (anchor → mid → soft lavender edge)
  Rebounder: { anchor: "#2D2435", mid: "#5D5470", outer: "#A89DC0" },
  // Ember (Restorer): blue-gray + dark maroon anchor
  Ember: { anchor: "#3A1A1F", mid: "#4F5760", outer: "#A8B8BE" },
  // Chameleon: wine-red anchor transitioning into sage / olive green
  Chameleon: { anchor: "#4A1E2D", mid: "#6B5A4A", outer: "#A8B585" },
  // Explorer: gold/yellow → muted plum anchor
  Explorer: { anchor: "#4A2A4F", mid: "#8A7060", outer: "#D8B247" },
};

const HEADER_HEIGHT = 250;

// Trend triangle path lifted from ScanInsightsScreen (Figma 950:20753-20776).
const TREND_TRIANGLE =
  "M9.35204 4.89235C10.1843 3.8104 11.8157 3.8104 12.648 4.89235L19.4256 13.7032C20.4773 15.0705 19.5026 17.05 17.7776 17.05H4.2224C2.49741 17.05 1.5227 15.0705 2.57444 13.7032L9.35204 4.89235Z";

type TrendDirection = "up" | "down" | "same" | null;

function dirFromNumbers(current: number | null, previous: number | null): TrendDirection {
  if (current === null || previous === null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

function trendPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Energy words ordered low → high. "Fluctuating" sits between okay and steady.
const ENERGY_RANK: Record<string, number> = {
  low: 1,
  okay: 2,
  moderate: 2,
  fluctuating: 2.5,
  steady: 3,
  stable: 3,
  high: 4,
};

function energyRank(word: string | null | undefined): number | null {
  if (!word) return null;
  return ENERGY_RANK[word.toLowerCase()] ?? null;
}

type SubscriptionTier = "pro" | "free" | "none";

function buildLpdEntries(profile: UserProfile): Array<{ date: string; note: string }> {
  const entries: Array<{ date: string; note: string; sortKey: number }> = [];

  for (const entry of profile.layer2.energyLog) {
    const d = new Date(entry.date);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const noteMap: Record<string, string> = {
      high: "High energy reported. Meals are fueling well.",
      steady: "Steady energy. Your pattern is holding.",
      okay: "Moderate energy. Watching for patterns.",
      low: "Low energy flagged. Adjusting tomorrow's meals.",
    };
    entries.push({ date: dateStr, note: noteMap[entry.energy] || `Energy: ${entry.energy}`, sortKey: d.getTime() });
  }

  for (const entry of profile.layer2.stressTags) {
    if (entry.tags.length > 0) {
      const d = new Date(entry.date);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      entries.push({ date: dateStr, note: `Stress signals: ${entry.tags.join(", ")}`, sortKey: d.getTime() });
    }
  }

  return entries
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 10)
    .map(({ date, note }) => ({ date, note }));
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { state, resetState } = useApp();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const insets = useSafeAreaInsets();
  const palette = useAppPalette();
  // Day/night surface tokens for the body content (header/gradient stays as-is).
  const surfaces = palette.evening
    ? {
        body: "#3D1F22",
        card: "#2A0E10",
        confidence: "#1F3D52",
        textStrong: K.bone,
        textSubtle: "#B8A7A8",
        divider: "#4F2A2D",
        outlineBorder: "#5A2F32",
      }
    : {
        body: K.white,
        card: K.bone,
        confidence: "#E9F0F2",
        textStrong: K.brown,
        textSubtle: "#7e6869",
        divider: "#C9BEBE",
        outlineBorder: "#9C8E8E",
      };

  const metabolicType =
    toMetabolicType(profile?.layer1?.primaryBucket) ??
    toMetabolicType(state.user.metabolicType) ??
    "Explorer";
  const typeConfig = TYPE_CONFIGS[metabolicType];
  const typeColors = TC[metabolicType];

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

  const lpdEntries =
    profile && profile.layer2.energyLog.length > 0
      ? buildLpdEntries(profile)
      : [
          {
            date: "—",
            note: "No check-in data yet. Complete a check-in to start building your pattern.",
          },
        ];

  const scanHistoryRaw = profile?.layer3.scanHistory ?? [];
  const scanEntries = scanHistoryRaw
    .slice(-10)
    .reverse()
    .map((scan: Record<string, any>, i: number) => {
      const raw = scan.scannedAt ?? scan.timestamp ?? scan.date;
      const dateLabel = raw
        ? new Date(raw).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : `Scan ${scanHistoryRaw.length - i}`;
      return {
        date: dateLabel,
        stressIndex: scan.stressIndex ?? scan.stress_index ?? 0,
        wellness:
          scan.wellness ??
          Math.round(
            (scan.parasympatheticActivity ?? 50) * 0.6 +
              ((scan.hrvSdnn ?? 40) / 80) * 40,
          ),
      };
    });

  const lastScanAt = profile?.layer3?.latestScan?.scannedAt ?? null;
  const lastCheckInDate = profile?.layer2?.energyLog?.length
    ? profile.layer2.energyLog[0].date
    : null;
  const { isFresh: biometricsFresh } = useBiometricFreshness(
    lastScanAt,
    lastCheckInDate,
  );

  const latestScan = biometricsFresh ? profile?.layer3.latestScan : null;
  const stressValue = latestScan
    ? `${latestScan.stressIndex ?? latestScan.stress_index}`
    : typeConfig.signals.stress;
  const recoveryValue = latestScan
    ? `${latestScan.parasympatheticActivity ?? latestScan.parasympathetic_activity ?? "—"}`
    : typeConfig.signals.recovery;
  const energyValue = typeConfig.signals.energy;

  // Prior scan = second-most-recent (by scannedAt). Used to compute trend
  // direction + delta for the live signal cells.
  const priorScan = (() => {
    const history = profile?.layer3?.scanHistory ?? [];
    if (history.length < 2) return null;
    const sorted = [...history].sort((a: any, b: any) => {
      const at = a.scannedAt ?? a.timestamp ?? a.date;
      const bt = b.scannedAt ?? b.timestamp ?? b.date;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
    return sorted[1] ?? null;
  })();

  const stressCurrent = latestScan
    ? (latestScan.stressIndex ?? latestScan.stress_index ?? null)
    : null;
  const stressPrior = priorScan
    ? (priorScan.stressIndex ?? priorScan.stress_index ?? null)
    : null;
  const stressTrendDir = dirFromNumbers(stressCurrent, stressPrior);
  const stressTrendDelta =
    stressCurrent !== null && stressPrior !== null
      ? stressCurrent - stressPrior
      : null;

  const recoveryCurrent = latestScan
    ? (latestScan.parasympatheticActivity ?? latestScan.parasympathetic_activity ?? null)
    : null;
  const recoveryPrior = priorScan
    ? (priorScan.parasympatheticActivity ?? priorScan.parasympathetic_activity ?? null)
    : null;
  const recoveryTrendDir = dirFromNumbers(recoveryCurrent, recoveryPrior);
  const recoveryTrendDelta =
    recoveryCurrent !== null && recoveryPrior !== null
      ? recoveryCurrent - recoveryPrior
      : null;

  // Energy trend uses the last two check-in entries ranked by ENERGY_RANK.
  const energyLogSorted = (() => {
    const log = profile?.layer2?.energyLog ?? [];
    return [...log].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  })();
  const energyCurrentRank = energyRank(energyLogSorted[0]?.energy ?? null);
  const energyPriorRank = energyRank(energyLogSorted[1]?.energy ?? null);
  const energyTrendDir = dirFromNumbers(energyCurrentRank, energyPriorRank);

  const confidencePct = Math.round(profile?.confidence?.composite ?? 0);
  // Crude projection: each 1% gain ≈ 1 day of typical engagement. Cap & floor.
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

  return (
    <View style={[styles.container, { backgroundColor: surfaces.body }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top-bounce sentinel: extends the gradient outer color above the
            header so the iOS overscroll bounce reads as a continuation of
            the gradient instead of revealing the body color. */}
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
            <Image source={TYPE_LOGO[metabolicType]} style={styles.headerAvatar} resizeMode="contain" />
            <Text style={styles.headerName}>{userName}</Text>
          </View>
        </View>

        <View style={[styles.bodyWrap, { backgroundColor: surfaces.body }]}>
        {/* Your type */}
        <Section eyebrow="Your type" eyebrowColor={surfaces.textStrong}>
          <View style={[styles.card, { backgroundColor: surfaces.card }]}>
            <Text style={[styles.typeTitle, { color: surfaces.textStrong }]}>{typeConfig.title}</Text>
            <Text style={[styles.typeTagline, { color: surfaces.textSubtle }]}>{typeConfig.tagline}</Text>
            <Text style={[styles.typeBody, { color: surfaces.textSubtle }]}>{typeConfig.description}</Text>
          </View>
        </Section>

        {/* Ester confidence */}
        <Section eyebrow="Ester confidence" eyebrowColor={surfaces.textStrong}>
          <View style={[styles.confidenceCard, { backgroundColor: surfaces.confidence }]}>
            <View style={styles.confidencePctRow}>
              <Text style={[styles.confidencePct, { color: surfaces.textStrong }]}>{confidencePct}%</Text>
              <ConfidencePie fraction={confidencePct / 100} color={surfaces.textStrong} />
            </View>
            <View style={styles.confidenceTextWrap}>
              <Text style={[styles.confidenceCopy, { color: surfaces.textStrong }]}>
                We're still learning your signals so continue to scan each day.
              </Text>
              <Text style={[styles.confidenceMeta, { color: surfaces.textSubtle }]}>
                Estimated {daysToFull} days til near 100% confidence
              </Text>
            </View>
          </View>
        </Section>

        {/* Your signals */}
        <Section eyebrow="Your signals" eyebrowColor={surfaces.textStrong}>
          {biometricsFresh ? (
            <View style={styles.signalGrid}>
              <SignalCell
                label="Stress"
                value={String(stressValue)}
                cardBg={surfaces.card}
                labelColor={surfaces.textSubtle}
                valueColor={surfaces.textStrong}
                trendDir={stressTrendDir}
                trendDelta={stressTrendDelta}
                trendTextColor={surfaces.textSubtle}
              />
              <SignalCell
                label="Energy"
                value={String(energyValue)}
                cardBg={surfaces.card}
                labelColor={surfaces.textSubtle}
                valueColor={surfaces.textStrong}
                trendDir={energyTrendDir}
                trendTextColor={surfaces.textSubtle}
              />
              <SignalCell
                label="Recovery"
                value={String(recoveryValue)}
                cardBg={surfaces.card}
                labelColor={surfaces.textSubtle}
                valueColor={surfaces.textStrong}
                trendDir={recoveryTrendDir}
                trendDelta={recoveryTrendDelta}
                trendTextColor={surfaces.textSubtle}
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

        {/* Living pattern document */}
        <Section eyebrow="Living pattern document" eyebrowColor={surfaces.textStrong}>
          <View style={[styles.listCard, { backgroundColor: surfaces.card }]}>
            {lpdEntries.map((entry, i) => (
              <View key={i}>
                <View style={styles.lpdRow}>
                  <Text style={[styles.lpdDate, { color: surfaces.textSubtle }]}>{entry.date}</Text>
                  <Text style={[styles.lpdNote, { color: surfaces.textStrong }]}>{entry.note}</Text>
                </View>
                {i < lpdEntries.length - 1 ? (
                  <View style={[styles.divider, { backgroundColor: surfaces.divider }]} />
                ) : null}
              </View>
            ))}
          </View>
        </Section>

        {/* Scan history */}
        {hasScan && scanEntries.length > 0 ? (
          <Section eyebrow="Scan history" eyebrowColor={surfaces.textStrong}>
            <View style={[styles.listCard, { backgroundColor: surfaces.card }]}>
              {scanEntries.map((scan, i) => (
                <View key={i}>
                  <View style={styles.scanRow}>
                    <Text style={[styles.scanDate, { color: surfaces.textStrong }]}>{scan.date}</Text>
                    <View style={styles.scanMetric}>
                      <Text style={[styles.scanMetricValue, { color: surfaces.textStrong }]}>{scan.stressIndex}</Text>
                      <Text style={[styles.scanMetricLabel, { color: surfaces.textSubtle }]}>Stress</Text>
                    </View>
                    <View style={styles.scanMetric}>
                      <Text style={[styles.scanMetricValue, { color: surfaces.textStrong }]}>{scan.wellness}</Text>
                      <Text style={[styles.scanMetricLabel, { color: surfaces.textSubtle }]}>Wellness</Text>
                    </View>
                  </View>
                  {i < scanEntries.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: surfaces.divider }]} />
                  ) : null}
                </View>
              ))}
              <TouchableOpacity
                style={styles.inlineEsterCta}
                onPress={() => navigation.navigate("Scan", { mode: "rescan" })}
                activeOpacity={0.9}
              >
                <EsterCtaGradient />
                <Image
                  source={ESTER_AVATAR}
                  style={styles.inlineEsterAvatar}
                  resizeMode="contain"
                />
                <View style={styles.inlineEsterTextWrap}>
                  <Text style={styles.inlineEsterTitle}>
                    Keep up the momentum.
                  </Text>
                  <Text style={styles.inlineEsterBody}>
                    Start today's scan.
                  </Text>
                </View>
                <View style={styles.inlineEsterArrowButton}>
                  <ArrowForwardIcon />
                </View>
              </TouchableOpacity>
            </View>
          </Section>
        ) : null}

        {/* Quick links */}
        <View style={[styles.quickLinks, { borderColor: surfaces.outlineBorder }]}>
          <QuickLinkRow
            icon="📊"
            label="Weekly review"
            labelColor={surfaces.textStrong}
            chevronColor={surfaces.textSubtle}
            onPress={() => (navigation as any).navigate("WeeklyReview")}
          />
          <View style={[styles.quickLinkDivider, { backgroundColor: surfaces.divider }]} />
          <QuickLinkRow
            icon="🍲"
            label="Saved meals"
            labelColor={surfaces.textStrong}
            chevronColor={surfaces.textSubtle}
            onPress={() => (navigation as any).navigate("SavedMeals")}
          />
          <View style={[styles.quickLinkDivider, { backgroundColor: surfaces.divider }]} />
          <QuickLinkRow
            icon="⚙"
            label="Settings"
            labelColor={surfaces.textStrong}
            chevronColor={surfaces.textSubtle}
            onPress={handleSettingsPress}
          />
        </View>

        {/* Reset (dev only — kept tucked at bottom) */}
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
}

function Section({ eyebrow, children, eyebrowColor }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowDot} />
        <Text style={[styles.eyebrowText, eyebrowColor ? { color: eyebrowColor } : null]}>
          {eyebrow}
        </Text>
      </View>
      {children}
    </View>
  );
}

function SignalCell({
  label,
  value,
  cardBg,
  labelColor,
  valueColor,
  trendDir,
  trendDelta,
  trendTextColor,
}: {
  label: string;
  value: string;
  cardBg?: string;
  labelColor?: string;
  valueColor?: string;
  trendDir?: TrendDirection;
  trendDelta?: number | null;
  trendTextColor?: string;
}) {
  return (
    <View style={[styles.signalCell, cardBg ? { backgroundColor: cardBg } : null]}>
      <Text style={[styles.signalCellLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
      <View style={styles.signalCellContent}>
        <Text
          style={[styles.signalCellValue, valueColor ? { color: valueColor } : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {value}
        </Text>
        {trendDir ? (
          <View style={styles.signalTrend}>
            <TrendIcon direction={trendDir} />
            {trendDelta !== null && trendDelta !== undefined ? (
              <Text
                style={[
                  styles.signalTrendText,
                  trendTextColor ? { color: trendTextColor } : null,
                ]}
              >
                {Math.abs(trendDelta)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TrendIcon({ direction }: { direction: "up" | "down" | "same" }) {
  if (direction === "same") {
    return (
      <Svg width={12} height={12} viewBox="0 0 22 22" fill="none">
        <Rect x={1.55957} y={8.31641} width={17.6725} height={5.19779} rx={2.07912} fill={K.faded} />
      </Svg>
    );
  }
  return (
    <Svg width={12} height={12} viewBox="0 0 22 22" fill="none">
      <Path
        d={TREND_TRIANGLE}
        fill={direction === "up" ? K.ochre : K.blue}
        transform={direction === "down" ? "rotate(180 11 11)" : undefined}
      />
    </Svg>
  );
}

function QuickLinkRow({
  icon,
  label,
  onPress,
  labelColor,
  chevronColor,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  labelColor?: string;
  chevronColor?: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLinkRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.quickLinkIcon}>{icon}</Text>
      <Text style={[styles.quickLinkLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
      <Text style={[styles.quickLinkChevron, chevronColor ? { color: chevronColor } : null]}>›</Text>
    </TouchableOpacity>
  );
}

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

function ConfidencePie({
  fraction,
  color,
}: {
  fraction: number;
  color: string;
}) {
  const path = buildPieSlicePath(fraction);
  return (
    <Svg
      width={PIE_SIZE}
      height={PIE_SIZE}
      viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
    >
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

function ArrowForwardIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
      <Path
        d="M8.08467 5.29883H0.5C0.358111 5.29883 0.239333 5.25094 0.143667 5.15517C0.0478888 5.0595 0 4.94072 0 4.79883C0 4.65694 0.0478888 4.53817 0.143667 4.4425C0.239333 4.34672 0.358111 4.29883 0.5 4.29883H8.08467L4.6385 0.852666C4.53939 0.753555 4.49044 0.637555 4.49167 0.504666C4.493 0.371777 4.54533 0.253611 4.64867 0.150166C4.75211 0.0536109 4.86922 0.00361094 5 0.000166493C5.13078 -0.00327795 5.24789 0.0467221 5.35133 0.150166L9.57817 4.377C9.64061 4.43944 9.68461 4.50528 9.71017 4.5745C9.73583 4.64372 9.74867 4.7185 9.74867 4.79883C9.74867 4.87917 9.73583 4.95394 9.71017 5.02317C9.68461 5.09239 9.64061 5.15822 9.57817 5.22067L5.35133 9.4475C5.259 9.53983 5.14467 9.58705 5.00833 9.58917C4.872 9.59128 4.75211 9.54405 4.64867 9.4475C4.54533 9.34405 4.49367 9.22528 4.49367 9.09117C4.49367 8.95694 4.54533 8.83811 4.64867 8.73467L8.08467 5.29883Z"
        fill={K.white}
      />
    </Svg>
  );
}

function EsterCtaGradient() {
  // blue/800 across most of the container, with dark brown anchored at the
  // bottom-middle (radial focal point) to keep that brown highlight area.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id="esterCtaBg"
            cx="50%"
            cy="100%"
            rx="70%"
            ry="120%"
            fx="50%"
            fy="100%"
          >
            <Stop offset="0" stopColor="#2E2422" />
            <Stop offset="0.2" stopColor="#4A4443" />
            <Stop offset="0.4" stopColor="#5C5756" />
            <Stop offset="0.6" stopColor="#737574" />
            <Stop offset="0.8" stopColor="#8C9090" />
            <Stop offset="1" stopColor="#B8BCBC" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#esterCtaBg)" />
      </Svg>
    </View>
  );
}

function HeaderTypeGradient({
  type,
}: {
  type: keyof typeof TYPE_GRADIENT_STOPS;
}) {
  const stops = TYPE_GRADIENT_STOPS[type];
  const gradientId = `headerBg_${type}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient
            id={gradientId}
            cx="50%"
            cy="100%"
            rx="80%"
            ry="105%"
            fx="50%"
            fy="100%"
          >
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
  container: {
    flex: 1,
    backgroundColor: K.white,
  },
  bodyWrap: {
    backgroundColor: K.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
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
  },
  headerCogWrap: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 88,
    height: 88,
  },
  headerName: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    color: K.white,
    letterSpacing: -0.32,
    marginTop: 0,
  },
  section: {
    // padding + gap are provided by bodyWrap
  },
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
    backgroundColor: "#92B4BD",
  },
  eyebrowText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    color: K.brown,
    letterSpacing: -0.12,
  },
  card: {
    backgroundColor: K.bone,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    paddingTop: 10,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 12,
    alignItems: "flex-start",
    alignSelf: "stretch",
    gap: 4,
  },
  typeTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    color: K.brown,
    letterSpacing: -0.24,
  },
  typeTagline: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: "#7e6869",
    letterSpacing: -0.16,
  },
  typeBody: {
    marginTop: 8,
    fontFamily: fonts.quadrant,
    fontSize: 14,
    color: "#7e6869",
    letterSpacing: -0.14,
  },
  confidenceCard: {
    backgroundColor: "#E9F0F2",
    borderRadius: 4,
    padding: 16,
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
  confidenceTextWrap: {
    flex: 1,
    gap: 4,
  },
  confidenceCopy: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: K.brown,
    letterSpacing: -0.14,
  },
  confidenceMeta: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    color: "#513436",
    letterSpacing: -0.12,
  },
  signalGrid: {
    flexDirection: "row",
    gap: 8,
  },
  signalCell: {
    flex: 1,
    backgroundColor: K.bone,
    borderRadius: 4,
    padding: 16,
    alignItems: "flex-start",
    gap: 16,
  },
  signalCellLabel: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    color: "#7e6869",
    letterSpacing: -0.12,
  },
  signalCellContent: {
    flex: 1,
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: 4,
  },
  signalTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  signalTrendText: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  signalCellValue: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 24,
    color: K.brown,
    letterSpacing: -0.24,
    textTransform: "capitalize",
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
  listCard: {
    backgroundColor: K.bone,
    borderRadius: 4,
    paddingVertical: 4,
  },
  lpdRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  lpdDate: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    color: "#7e6869",
    letterSpacing: -0.12,
  },
  lpdNote: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.brown,
    letterSpacing: -0.16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#C3B9BA",
    marginHorizontal: 16,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  scanDate: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.brown,
    letterSpacing: -0.16,
  },
  scanMetric: {
    alignItems: "center",
    minWidth: 44,
  },
  scanMetricValue: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.brown,
    letterSpacing: -0.20,
  },
  scanMetricLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    color: "#7e6869",
    letterSpacing: -0.12,
  },
  inlineEsterCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 12,
    padding: 12,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  inlineEsterAvatar: {
    width: 33,
    height: 33,
  },
  inlineEsterTextWrap: {
    flex: 1,
  },
  inlineEsterArrowButton: {
    width: 23,
    height: 23,
    borderRadius: 999,
    backgroundColor: "rgba(250, 253, 254, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineEsterTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.bone,
    letterSpacing: -0.20,
  },
  inlineEsterBody: {
    fontFamily: fonts.catalogueBold,
    fontSize: 20,
    color: K.bone,
    letterSpacing: -0.20,
  },
  quickLinks: {
    backgroundColor: "transparent",
    borderRadius: radius.lg,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#9C8E8E",
    overflow: "hidden",
  },
  quickLinkDivider: {
    height: 1,
    backgroundColor: "#C9BEBE",
  },
  quickLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  quickLinkIcon: {
    fontSize: 20,
    width: 24,
    textAlign: "center",
  },
  quickLinkLabel: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.brown,
    letterSpacing: -0.20,
  },
  quickLinkChevron: {
    fontSize: 22,
    color: K.textMuted,
    fontWeight: "300",
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

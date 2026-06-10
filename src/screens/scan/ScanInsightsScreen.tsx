import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSwipeToAdvance } from "../../hooks/useSwipeToAdvance";
import { K, toMetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { useAppPalette } from "../../hooks/useAppPalette";
import { getProfile, UserProfile } from "../../services/profile";
import { getCachedDailyPlan, type DailyPlan } from "../../services/meals";
import { getScanInsightsMessage } from "../../services/scanInsights";
import { getCheckInHistory, type CheckInEntry } from "../../services/checkIn";
import type { MainStackParamList } from "../../navigation/MainNavigator";

const FALLBACK_BLURB =
  "Your score reflects what your scan picked up today. Here's the breakdown.";

const TYPE_LOGO = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
};

type ScanRecord = {
  scannedAt?: string;
  stressIndex?: number | null;
  hrvSdnn?: number | null;
  ageEstimate?: number | null;
  vascularAge?: number | null;
  heartRate?: number | null;
  wellness?: number | null;
} & Record<string, unknown>;

interface MetricValue {
  current: number | null;
  previous: number | null;
}

function pickStress(scan: ScanRecord | null): number | null {
  if (!scan) return null;
  const v = scan.stressIndex;
  return typeof v === "number" ? Math.round(v) : null;
}

function pickHrv(scan: ScanRecord | null): number | null {
  if (!scan) return null;
  const v = scan.hrvSdnn;
  return typeof v === "number" ? Math.round(v) : null;
}

function pickVascularAge(scan: ScanRecord | null): number | null {
  if (!scan) return null;
  // Prefer the derived offset stored locally, fall back to raw ageEstimate
  // minus a 30-year baseline (matches deriveBiometrics in ScanScreen).
  if (typeof scan.vascularAge === "number") return Math.round(scan.vascularAge);
  if (typeof scan.ageEstimate === "number")
    return Math.max(0, Math.round(scan.ageEstimate - 30));
  return null;
}

function trendPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function formatLabel(s: string | null): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatEnergy(s: string | null): string {
  return formatLabel(s);
}

function formatSleepHours(h: number | null): string {
  if (h === null || h === undefined) return "—";
  return `${h}h`;
}

function formatStressTags(tags: string[]): string {
  if (!tags || tags.length === 0) return "None";
  // The CheckInV2 form lets users pick "none" explicitly; the legacy survey
  // also stores ["none"] in that case. Treat both the same.
  if (tags.length === 1 && tags[0].toLowerCase() === "none") return "None";
  return tags
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(", ");
}

const ENERGY_RANK: Record<string, number> = {
  low: 1,
  okay: 2,
  steady: 3,
  high: 4,
};

const SLEEP_QUALITY_RANK: Record<string, number> = {
  poor: 1,
  okay: 2,
  good: 3,
  great: 4,
};

type Direction = "up" | "down" | "same" | null;

function rank(map: Record<string, number>, value: string | null): number | null {
  if (!value) return null;
  return map[value.toLowerCase()] ?? null;
}

function dirFromNumbers(current: number | null, previous: number | null): Direction {
  if (current === null || previous === null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

function effectiveStressCount(tags: string[] | null | undefined): number {
  if (!tags || tags.length === 0) return 0;
  if (tags.length === 1 && tags[0].toLowerCase() === "none") return 0;
  return tags.length;
}

// Trend indicator icons sourced from Figma node 950:20753-20776 (Icon/Trend).
// Up: ochre triangle. Down: muted blue triangle (same path, rotated 180°).
// Same: bone-toned pill. K palette already matches Figma fills exactly.
const TREND_TRIANGLE =
  "M9.35204 4.89235C10.1843 3.8104 11.8157 3.8104 12.648 4.89235L19.4256 13.7032C20.4773 15.0705 19.5026 17.05 17.7776 17.05H4.2224C2.49741 17.05 1.5227 15.0705 2.57444 13.7032L9.35204 4.89235Z";

function TrendIcon({ direction }: { direction: "up" | "down" | "same" }) {
  if (direction === "same") {
    return (
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Rect
          x={1.55957}
          y={8.31641}
          width={17.6725}
          height={5.19779}
          rx={2.07912}
          fill={K.faded}
        />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d={TREND_TRIANGLE}
        fill={direction === "up" ? K.ochre : K.blue}
        transform={direction === "down" ? "rotate(180 11 11)" : undefined}
      />
    </Svg>
  );
}

export function ScanInsightsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "ScanInsights">>();
  const fromAppOpen = !!route.params?.fromAppOpen;
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const { innerBg, nestedBg, textColor, subtleText, statusBarStyle } =
    useAppPalette();
  const metabolicType =
    toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
  const [blurb, setBlurb] = useState<string | null>(null);
  const [blurbLoading, setBlurbLoading] = useState(true);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {});
    getCheckInHistory(2)
      .then(setCheckIns)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let plan: DailyPlan | null = null;
      try {
        plan = await getCachedDailyPlan();
      } catch {
        plan = null;
      }
      const mealSlots = plan
        ? {
            breakfast: plan.breakfast.map((m) => ({ name: m.name, whyLine: m.whyLine })),
            lunch: plan.lunch.map((m) => ({ name: m.name, whyLine: m.whyLine })),
            dinner: plan.dinner.map((m) => ({ name: m.name, whyLine: m.whyLine })),
          }
        : undefined;
      try {
        const res = await getScanInsightsMessage(mealSlots);
        if (!cancelled) setBlurb(res.text || FALLBACK_BLURB);
      } catch {
        if (!cancelled) setBlurb(FALLBACK_BLURB);
      } finally {
        if (!cancelled) setBlurbLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const history = (profile?.layer3?.scanHistory ?? []) as ScanRecord[];
  // History is appended in service.recordScan, so the last entry is freshest.
  const latestFromHistory = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;

  // Local biometrics (from the in-memory ShenAI result) is the most up-to-date
  // source for the *current* scan; fall back to the persisted history if the
  // user landed here without a session-cached scan (e.g. after relaunch).
  const currentSource: ScanRecord | null = state.biometrics
    ? {
        stressIndex: state.biometrics.stressIndex,
        hrvSdnn: state.biometrics.raw?.hrvSdnn ?? null,
        vascularAge: state.biometrics.vascularAge,
        heartRate: state.biometrics.heartRate,
        wellness: state.biometrics.wellness,
      }
    : latestFromHistory;

  const stress: MetricValue = {
    current: pickStress(currentSource),
    previous: pickStress(previous),
  };
  const hrv: MetricValue = {
    current: pickHrv(currentSource),
    previous: pickHrv(previous),
  };
  const vasc: MetricValue = {
    current: pickVascularAge(currentSource),
    previous: pickVascularAge(previous),
  };

  // Mode: "survey" if the user's most-recent action is a check-in (rather than
  // a scan). Falls back to "scan" so existing scan-anchored users see no
  // change. Ties go to scan since a same-day scan is the higher-fidelity read.
  const lastScanAt = profile?.layer3?.latestScan?.scannedAt ?? null;
  const lastCheckInAt = checkIns[0]?.date ?? null;
  const hasAnyData = !!currentSource || !!lastCheckInAt;
  const mode: "scan" | "survey" = (() => {
    if (lastCheckInAt && !lastScanAt) return "survey";
    if (lastCheckInAt && lastScanAt) {
      return new Date(lastCheckInAt).getTime() >
        new Date(lastScanAt).getTime()
        ? "survey"
        : "scan";
    }
    return "scan";
  })();

  const latestCheckIn = checkIns[0] ?? null;
  const prevCheckIn = checkIns[1] ?? null;

  const energyLabel = formatEnergy(latestCheckIn?.energy ?? null);
  const sleepHoursLabel = formatSleepHours(latestCheckIn?.sleepHours ?? null);
  const sleepQualityLabel = formatLabel(latestCheckIn?.sleepQuality ?? null);
  const stressTagsLabel = formatStressTags(latestCheckIn?.stressTags ?? []);

  const energyDir = dirFromNumbers(
    rank(ENERGY_RANK, latestCheckIn?.energy ?? null),
    rank(ENERGY_RANK, prevCheckIn?.energy ?? null),
  );
  const sleepHoursDir = dirFromNumbers(
    latestCheckIn?.sleepHours ?? null,
    prevCheckIn?.sleepHours ?? null,
  );
  const sleepQualityDir = dirFromNumbers(
    rank(SLEEP_QUALITY_RANK, latestCheckIn?.sleepQuality ?? null),
    rank(SLEEP_QUALITY_RANK, prevCheckIn?.sleepQuality ?? null),
  );
  // Stress is "less is better" — invert the count comparison so None (0
  // sources) reads as an improvement over any tagged day, and a day with
  // fewer tags than yesterday still reads as an improvement.
  const stressDir = prevCheckIn
    ? dirFromNumbers(
        effectiveStressCount(prevCheckIn?.stressTags),
        effectiveStressCount(latestCheckIn?.stressTags),
      )
    : null;

  const energyPrev = prevCheckIn ? formatEnergy(prevCheckIn.energy ?? null) : null;
  const sleepHoursPrev = prevCheckIn
    ? formatSleepHours(prevCheckIn.sleepHours ?? null)
    : null;
  const sleepQualityPrev = prevCheckIn
    ? formatLabel(prevCheckIn.sleepQuality ?? null)
    : null;
  const stressPrev = prevCheckIn
    ? formatStressTags(prevCheckIn.stressTags ?? [])
    : null;

  const handleClose = () => navigation.goBack();
  const advanceToHome = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const swipeHandlers = useSwipeToAdvance({
    axis: "down",
    onAdvance: advanceToHome,
  });
  const handleScanAgain = () => {
    navigation.navigate("Scan", { mode: "rescan", returnTo: "ScoreReveal" });
  };
  const handleCheckIn = () => {
    (navigation as any).navigate("AppOpenFlow", { screen: "SurveyV2" });
  };

  return (
    <View
      style={[styles.root, { backgroundColor: innerBg }]}
      {...(fromAppOpen ? swipeHandlers : {})}
    >
      <StatusBar barStyle={statusBarStyle} translucent />
      <SafeAreaView
        edges={["top"]}
        style={[styles.headerSafe, { backgroundColor: innerBg }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleClose}
            hitSlop={8}
            accessibilityLabel="Close"
          >
            <Text style={[styles.headerIconGlyph, { color: textColor }]}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: textColor }]}>
              {!hasAnyData
                ? "Insights"
                : mode === "survey"
                ? "Check-in Insights"
                : "Scan Insights"}
            </Text>
          </View>

          {/* Right-side actions in design (share/bookmark) are visual only for v1 */}
          <View style={styles.headerRightSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ester message */}
        <View style={styles.esterBlock}>
          <View style={styles.esterEyebrowRow}>
            <View style={styles.esterEyebrowDot} />
            <Text style={[styles.esterEyebrowText, { color: textColor }]}>
              Message from Ester
            </Text>
          </View>
          <View style={[styles.esterCard, { backgroundColor: nestedBg }]}>
            <Image
              source={TYPE_LOGO[metabolicType]}
              style={styles.esterAvatar}
              resizeMode="contain"
            />
            <View style={styles.esterTextWrap}>
              {!hasAnyData ? (
                <Text style={[styles.esterText, { color: textColor }]}>
                  Once you scan or check in, this is where I'll break down what
                  your signals are saying.
                </Text>
              ) : blurbLoading ? (
                <View style={styles.esterLoadingRow}>
                  <ActivityIndicator size="small" color={textColor} />
                  <Text style={[styles.esterLoadingText, { color: subtleText }]}>
                    Thinking through your scan…
                  </Text>
                </View>
              ) : (
                <Text style={[styles.esterText, { color: textColor }]}>
                  {blurb ?? FALLBACK_BLURB}
                </Text>
              )}
            </View>
          </View>
        </View>

        {!hasAnyData ? (
          <View style={[styles.emptyCard, { backgroundColor: nestedBg }]}>
            <Text style={[styles.emptyTitle, { color: textColor }]}>
              No score yet today
            </Text>
            <Text style={[styles.emptyBody, { color: subtleText }]}>
              Take a quick scan or check in and I'll have a read on you in
              seconds.
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
        ) : mode === "survey" ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              About today's check-in
            </Text>
            <Text style={[styles.sectionBody, { color: textColor }]}>
              These signals come from how you reported feeling today. They feed
              into your Reset score and help me understand what your body needs.
            </Text>

            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <SurveyCard
                  label="Energy"
                  value={energyLabel}
                  previous={energyPrev}
                  direction={energyDir}
                />
                <SurveyCard
                  label="Sleep"
                  value={sleepHoursLabel}
                  previous={sleepHoursPrev}
                  direction={sleepHoursDir}
                />
              </View>
              <View style={styles.metricsRow}>
                <SurveyCard
                  label="Sleep Quality"
                  value={sleepQualityLabel}
                  previous={sleepQualityPrev}
                  direction={sleepQualityDir}
                />
                <SurveyCard
                  label="Stress Sources"
                  value={stressTagsLabel}
                  previous={stressPrev}
                  direction={stressDir}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              About today's scan
            </Text>
            <Text style={[styles.sectionBody, { color: textColor }]}>
              These signals come straight from your latest face scan. They feed
              into your Reset score and help me understand how you're doing today.
            </Text>

            <View style={styles.metricsGrid}>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Stress Index"
                  current={stress.current}
                  previous={stress.previous}
                  betterDirection="down"
                />
                <MetricCard
                  label="Heart Rate Variability"
                  unit="ms"
                  current={hrv.current}
                  previous={hrv.previous}
                  betterDirection="up"
                />
              </View>
              <View style={styles.metricsRow}>
                <MetricCard
                  label="Vascular Age"
                  unit="yrs"
                  current={vasc.current}
                  previous={vasc.previous}
                  betterDirection="down"
                  showPlus
                />
                <View style={styles.metricSpacer} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {fromAppOpen ? (
        <TouchableOpacity
          style={[
            styles.advanceButton,
            {
              bottom: insets.bottom + 16,
              backgroundColor: innerBg,
              borderColor: textColor,
            },
          ]}
          onPress={advanceToHome}
          activeOpacity={0.8}
          accessibilityLabel="Continue to home"
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
      ) : null}
    </View>
  );
}

interface MetricCardProps {
  label: string;
  current: number | null;
  previous: number | null;
  unit?: string;
  // For semantic coloring later if we want it; unused in v1 (gray neutral).
  betterDirection?: "up" | "down";
  showPlus?: boolean;
}

function SurveyCard({
  label,
  value,
  previous,
  direction,
}: {
  label: string;
  value: string;
  previous: string | null;
  direction: Direction;
}) {
  const { nestedBg, textColor } = useAppPalette();
  return (
    <View style={[styles.metricCard, { backgroundColor: nestedBg }]}>
      <Text style={[styles.metricLabel, { color: textColor }]}>{label}</Text>
      <View style={styles.metricBottomRow}>
        <Text style={[styles.surveyValue, { color: textColor }]} numberOfLines={2}>
          {value}
        </Text>
        <View style={styles.metricTrend}>
          {direction !== null ? <TrendIcon direction={direction} /> : null}
          <Text style={[styles.metricTrendText, { color: textColor }]}>
            {previous ?? "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MetricCard({
  label,
  current,
  previous,
  unit,
  showPlus,
}: MetricCardProps) {
  const { nestedBg, textColor, subtleText } = useAppPalette();
  const delta = trendPercent(current, previous);
  const valueDisplay = current === null ? "—" : `${showPlus ? "+" : ""}${current}`;

  return (
    <View style={[styles.metricCard, { backgroundColor: nestedBg }]}>
      <Text style={[styles.metricLabel, { color: textColor }]}>{label}</Text>
      <View style={styles.metricBottomRow}>
        <Text style={[styles.metricValue, { color: textColor }]}>
          {valueDisplay}
          {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
        </Text>
        <View style={styles.metricTrend}>
          {delta === null ? (
            <Text style={[styles.metricTrendNeutral, { color: subtleText }]}>
              —
            </Text>
          ) : (
            <>
              <TrendIcon
                direction={delta > 0 ? "up" : delta < 0 ? "down" : "same"}
              />
              <Text style={[styles.metricTrendText, { color: textColor }]}>
                {delta === 0 ? "0%" : `${Math.abs(delta)}%`}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: K.white,
  },
  // Header
  headerSafe: {
    backgroundColor: K.white,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 21,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconGlyph: {
    fontSize: 18,
    color: K.brown,
    fontFamily: fonts.dmSans,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
  },
  // Content
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    gap: 30,
  },
  // Ester message
  esterBlock: {
    gap: 6,
  },
  esterEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  esterEyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.ochre,
  },
  esterEyebrowText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  esterCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: K.bone,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  esterAvatar: {
    width: 48,
    height: 48,
  },
  esterTextWrap: {
    flex: 1,
    paddingTop: 2,
    paddingLeft: 4,
    justifyContent: "center",
  },
  esterText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: K.brown,
  },
  esterLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 22,
  },
  esterLoadingText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.sub,
  },
  // Section
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.brown,
  },
  sectionBody: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: K.brown,
  },
  metricsGrid: {
    gap: 8,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: K.bone,
    borderRadius: 4,
    padding: 16,
    gap: 16,
    minHeight: 110,
  },
  metricSpacer: {
    flex: 1,
  },
  metricLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
  },
  metricBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  metricValue: {
    fontFamily: fonts.dmSansBold,
    fontSize: 32,
    letterSpacing: -0.32,
    color: K.brown,
    lineHeight: 36,
  },
  surveyValue: {
    fontFamily: fonts.dmSansBold,
    fontSize: 22,
    letterSpacing: -0.22,
    color: K.brown,
    lineHeight: 28,
    flex: 1,
  },
  metricUnit: {
    fontFamily: fonts.dmSansBold,
    fontSize: 14,
    letterSpacing: -0.14,
  },
  metricTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingBottom: 3,
  },
  metricTrendText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
  },
  metricTrendNeutral: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.sub,
  },
  emptyCard: {
    backgroundColor: K.bone,
    borderRadius: 4,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
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
    color: K.sub,
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
  advanceButton: {
    position: "absolute",
    right: 24,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  advanceArrow: {
    fontSize: 22,
    fontWeight: "400",
  },
});

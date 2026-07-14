import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { K, toMetabolicType, MetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { useAppPalette } from "../../hooks/useAppPalette";
import {
  getScoreHistory,
  ScoreHistory,
  ScanHistoryItem,
  SurveyHistoryItem,
  ScoreDayItem,
} from "../../services/profile";
import { logEvent } from "../../services/braze";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import { stressBand } from "../../utils/stress";

// Per-type gradient stops (kept in sync with ProfileScreen's TYPE_GRADIENT_STOPS).
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

type Tab = "scores" | "scans" | "surveys";

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
      <Path
        d="M2.496 7.9356L7.66525 13.1049C7.81392 13.2535 7.88733 13.4275 7.8855 13.6269C7.8835 13.8262 7.805 14.0034 7.65 14.1586C7.49483 14.3034 7.31917 14.3784 7.123 14.3836C6.92683 14.3888 6.75117 14.3138 6.596 14.1586L0.25575 7.81835C0.162083 7.72468 0.0960833 7.62593 0.0577499 7.5221C0.0192499 7.41827 0 7.3061 0 7.1856C0 7.0651 0.0192499 6.95293 0.0577499 6.8491C0.0960833 6.74527 0.162083 6.64652 0.25575 6.55285L6.596 0.212602C6.7345 0.0741016 6.906 0.0032683 7.1105 0.000101633C7.315 -0.00306503 7.49483 0.0677683 7.65 0.212602C7.805 0.367768 7.8825 0.545935 7.8825 0.747102C7.8825 0.948435 7.805 1.12668 7.65 1.28185L2.496 6.4356H13.873C14.0858 6.4356 14.264 6.50743 14.4075 6.6511C14.5512 6.7946 14.623 6.97277 14.623 7.1856C14.623 7.39843 14.5512 7.5766 14.4075 7.7201C14.264 7.86377 14.0858 7.9356 13.873 7.9356H2.496Z"
        fill={color}
      />
    </Svg>
  );
}

function HeaderGradient({ type }: { type: MetabolicType }) {
  const stops = TYPE_GRADIENT_STOPS[type];
  const id = `scanHistHdr_${type}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="120%" rx="90%" ry="120%" fx="50%" fy="120%">
            <Stop offset="0" stopColor={stops.anchor} />
            <Stop offset="0.55" stopColor={stops.mid} />
            <Stop offset="1" stopColor={stops.outer} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

type MonthGroup<T> = { key: string; label: string; items: T[] };

// Group by the user's LOCAL month/day (formatting happens off the raw `at`
// timestamp so it matches the device timezone). Items arrive newest-first.
function groupByLocalMonth<T extends { at: string }>(items: T[]): MonthGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, MonthGroup<T>>();
  for (const it of items) {
    const d = new Date(it.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        items: [],
      };
      map.set(key, g);
      order.push(key);
    }
    g.items.push(it);
  }
  return order.map((k) => map.get(k)!);
}

// Scores carry a bare `YYYY-MM-DD` (the user's local day). Parse the parts
// directly — `new Date("2026-07-01")` is UTC midnight, which renders as the
// previous day in negative-UTC timezones.
function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function groupScoreDaysByMonth(items: ScoreDayItem[]): MonthGroup<ScoreDayItem>[] {
  const order: string[] = [];
  const map = new Map<string, MonthGroup<ScoreDayItem>>();
  for (const it of items) {
    const d = parseYMD(it.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        items: [],
      };
      map.set(key, g);
      order.push(key);
    }
    g.items.push(it);
  }
  return order.map((k) => map.get(k)!);
}

const fmtDay = (ymd: string) =>
  parseYMD(ymd).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const fmtDate = (at: string) =>
  new Date(at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const fmtTime = (at: string) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const cap = (s: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
const numText = (v: number | null, digits = 0) =>
  v == null ? "—" : v.toFixed(digits);

function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

// Signal chips shown under each scan (nulls dropped so we never render "—").
function scanChips(s: ScanHistoryItem): string[] {
  const chips: string[] = [];
  if (s.heartRate != null) chips.push(`HR ${Math.round(s.heartRate)}`);
  if (s.hrvSdnn != null) chips.push(`HRV ${Math.round(s.hrvSdnn)}ms`);
  if (s.breathingRate != null) chips.push(`Br ${Math.round(s.breathingRate)}/min`);
  const band = stressBand(s.stressIndex);
  if (band) chips.push(`Stress ${band}`);
  return chips;
}

// Answer chips shown under each survey.
function surveyChips(s: SurveyHistoryItem): string[] {
  const chips: string[] = [];
  const sleepParts: string[] = [];
  if (s.sleepQuality) sleepParts.push(cap(s.sleepQuality));
  if (s.sleepHours != null) sleepParts.push(`${s.sleepHours}h`);
  if (sleepParts.length) chips.push(`Sleep: ${sleepParts.join(" ")}`);
  const tags = s.stressTags ?? [];
  if (tags.length) chips.push(`Stress: ${tags.map(cap).join(", ")}`);
  return chips;
}

// Estimated days until ~100% confidence — mirrors ProfileScreen's clamped
// formula (min 5, max 120) so a row lines up with the Profile confidence card.
function daysToFullConfidence(confidence: number): number {
  return Math.max(5, Math.min(120, 100 - Math.round(confidence)));
}

// Secondary chip shown under each daily score: days-to-full-confidence, matching
// how confidence is surfaced elsewhere in the app (not a raw percentage).
function scoreChips(s: ScoreDayItem): string[] {
  if (s.confidence == null) return [];
  const pct = Math.round(s.confidence);
  if (pct >= 100) return ["Full confidence"];
  return [`${daysToFullConfidence(pct)} days til 100% confidence`];
}

export function ScanHistoryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const { evening } = useAppPalette();
  const [tab, setTab] = useState<Tab>("scores");

  // Day/evening theming — mirrors the StatDetailSheet tooltip tokens so the
  // Score History body matches the rest of RES-145. The gradient header stays
  // dark (per-type) in both modes, so only the body surfaces re-theme.
  const screenBg = evening ? "#513436" : K.white;
  const textStrong = evening ? K.bone : K.brown;
  const textSubtle = evening ? "#B8A7A8" : "#7e6869";
  const cardBorder = evening ? "#7A565A" : "#C3B9BA";
  const rowDivider = evening ? "#7A565A" : "#D8CFC4";
  const [history, setHistory] = useState<ScoreHistory | null>(null);
  const [loading, setLoading] = useState(true);

  const metabolicType: MetabolicType =
    toMetabolicType(state.user.metabolicType) ?? "Explorer";

  useEffect(() => {
    logEvent("scanHistory_main");
    let alive = true;
    getScoreHistory()
      .then((h) => {
        if (alive) setHistory(h);
      })
      .catch(() => {
        if (alive) setHistory({ scans: [], surveys: [], scores: [] });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const scanGroups = useMemo(
    () => groupByLocalMonth(history?.scans ?? []),
    [history],
  );
  const surveyGroups = useMemo(
    () => groupByLocalMonth(history?.surveys ?? []),
    [history],
  );
  const scoreGroups = useMemo(
    () => groupScoreDaysByMonth(history?.scores ?? []),
    [history],
  );
  const groups =
    tab === "scans" ? scanGroups : tab === "surveys" ? surveyGroups : scoreGroups;
  const noun = tab === "scans" ? "scan" : tab === "surveys" ? "survey" : "score";

  const chipBg = evening ? "rgba(255,255,255,0.10)" : "rgba(54,20,22,0.06)";
  const chipText = textSubtle;

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      {/* Gradient header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <HeaderGradient type={metabolicType} />
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <BackIcon color={K.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Score History</Text>
          <View style={styles.headerIconBtn} />
        </View>

        {/* Segmented toggle */}
        <View style={styles.toggle}>
          {(["scores", "scans", "surveys"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.toggleItem, active && styles.toggleItemActive]}
                onPress={() => setTab(t)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: active ? K.brown : K.white },
                  ]}
                >
                  {t === "scores" ? "Scores" : t === "scans" ? "Scans" : "Surveys"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={TYPE_GRADIENT_STOPS[metabolicType].mid} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: textStrong }]}>
            No {noun}s yet
          </Text>
          <Text style={[styles.emptyBody, { color: textSubtle }]}>
            {tab === "scans"
              ? "Your face scans will show up here once you start scanning."
              : tab === "surveys"
                ? "Your daily check-ins will show up here once you start logging."
                : "Your daily scores will show up here once you start scanning or checking in."}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollBody,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {groups.map((group) => (
            <View key={group.key} style={styles.monthBlock}>
              <View style={styles.monthHead}>
                <Text style={[styles.monthName, { color: textStrong }]}>
                  {group.label}
                </Text>
                <Text style={[styles.monthCount, { color: textSubtle }]}>
                  {group.items.length} {noun}
                  {group.items.length === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={[styles.card, { borderColor: cardBorder }]}>
                {group.items.map((item, i) => {
                  const isScore = tab === "scores";
                  const scan = item as ScanHistoryItem;
                  const survey = item as SurveyHistoryItem;
                  const score = item as ScoreDayItem;
                  const key = isScore ? score.date : (item as { at: string }).at;
                  const chips =
                    tab === "scans"
                      ? scanChips(scan)
                      : tab === "surveys"
                        ? surveyChips(survey)
                        : scoreChips(score);
                  return (
                    <View key={key}>
                      {i > 0 ? (
                        <View
                          style={[styles.divider, { backgroundColor: rowDivider }]}
                        />
                      ) : null}
                      <View style={styles.row}>
                        <View style={styles.rowMain}>
                          <Text style={[styles.rowDate, { color: textStrong }]}>
                            {isScore ? fmtDay(score.date) : fmtDate(scan.at)}
                          </Text>
                          {!isScore ? (
                            <Text style={[styles.rowTime, { color: textSubtle }]}>
                              {fmtTime(scan.at)}
                            </Text>
                          ) : null}
                          {chips.length ? (
                            <View style={styles.chipsRow}>
                              {chips.map((c, ci) => (
                                <Chip key={ci} label={c} bg={chipBg} color={chipText} />
                              ))}
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.headlineWrap}>
                          {tab === "surveys" ? (
                            <Text style={[styles.headlineWord, { color: textStrong }]}>
                              {cap(survey.energy)}
                            </Text>
                          ) : (
                            <Text style={[styles.headlineNum, { color: textStrong }]}>
                              {tab === "scans"
                                ? numText(scan.wellness)
                                : String(score.score)}
                            </Text>
                          )}
                          <Text style={[styles.headlineLabel, { color: textSubtle }]}>
                            {tab === "scans"
                              ? "Wellness"
                              : tab === "surveys"
                                ? "Energy"
                                : "Score"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    overflow: "hidden",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 18,
    color: K.white,
    letterSpacing: -0.18,
  },
  toggle: {
    flexDirection: "row",
    marginTop: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    padding: 4,
  },
  toggleItem: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleItemActive: { backgroundColor: K.bone },
  toggleText: { fontFamily: fonts.catalogueMedium, fontSize: 15 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
  },
  emptyBody: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  scrollBody: { padding: 24, gap: 24 },
  monthBlock: { gap: 12 },
  monthHead: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  monthName: {
    fontFamily: fonts.catalogue,
    fontSize: 18,
    letterSpacing: -0.18,
  },
  monthCount: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
  },
  card: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  divider: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
  },
  rowMain: {
    flex: 1,
    gap: 6,
  },
  rowDate: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 15,
  },
  rowTime: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    marginTop: -2,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  headlineWrap: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  headlineNum: {
    fontFamily: fonts.quadrant,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: -0.28,
  },
  headlineWord: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  headlineLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

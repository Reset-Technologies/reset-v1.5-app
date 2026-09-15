import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import { useResetWindow } from "../../hooks/useResetWindow";
import { logEvent } from "../../services/braze";
import {
  getWindowHistory,
  type WeeklyUpdate,
  type WindowHistoryDay,
} from "../../services/resetWindow";
import { ArrowIcon } from "../../components/resetWindow/icons";
import { windowColors, type WindowColors } from "../../components/resetWindow/palette";
import { WindowUpdateSheet } from "../../components/resetWindow/WindowUpdateSheet";
import { durationShort, hoursTotal, windowLabel } from "../../utils/resetWindow";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Window Progress (handoff STREAKS + PROGRESS): actual behaviour only — the
 * current Window, averages and totals, streaks, the 30-day comparison and a
 * calendar of Resets. No level bar. "Try a longer Window" asks Ester, who may
 * offer one or say why not (decision order 8).
 *
 * PLACEHOLDER UI: no Lang design yet.
 */
export function WindowProgressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { evening } = useAppPalette();
  const c = windowColors(evening);
  const controller = useResetWindow();
  const { state } = controller;

  const [days, setDays] = useState<WindowHistoryDay[] | null>(null);
  const [selected, setSelected] = useState<WindowHistoryDay | null>(null);
  const [update, setUpdate] = useState<WeeklyUpdate | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    getWindowHistory()
      .then((res) => setDays(res.days))
      .catch(() => setDays([]));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const askLonger = async () => {
    logEvent("window_longerCTA");
    setAsking(true);
    setError(null);
    try {
      const next = await controller.askLonger();
      setUpdate(next.weeklyUpdate);
    } catch (err: any) {
      setError(err?.message || "Couldn’t reach Reset. Try again in a moment.");
    } finally {
      setAsking(false);
    }
  };

  const bg = evening ? "#513436" : K.white;
  const progress = state?.progress;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityLabel="Back"
        >
          <View style={styles.flip}>
            <ArrowIcon color={c.text} size={22} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Your Window</Text>
        <View style={styles.headerIconBtn} />
      </View>

      {!state || !progress ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        >
          <View style={styles.hero}>
            <Text style={[styles.eyebrow, { color: c.textAlt }]}>Current Window</Text>
            <Text style={[styles.heroValue, { color: c.text }]}>
              {state.plan ? windowLabel(state.plan.assignedDurationMin) : "Not set"}
            </Text>
          </View>

          <View style={styles.grid}>
            <Stat label="7-day average" value={progress.sevenDayAvgMin != null ? durationShort(progress.sevenDayAvgMin) : "—"} colors={c} />
            <Stat label="Total fasting hours" value={hoursTotal(progress.totalFastingMin)} colors={c} />
            <Stat label="Longest Reset" value={progress.longestResetMin != null ? durationShort(progress.longestResetMin) : "—"} colors={c} />
            <Stat label="Completed Resets" value={plural(progress.completedResets, "Reset", "Resets")} colors={c} />
            <Stat label="Current streak" value={plural(progress.currentStreak, "day", "days")} colors={c} />
            <Stat label="Longest streak" value={plural(progress.longestStreak, "day", "days")} colors={c} />
          </View>

          <View style={[styles.card, { borderColor: c.divider }]}>
            <Text style={[styles.eyebrow, { color: c.textAlt }]}>Last 30 days</Text>
            <Text style={[styles.statValue, { color: c.text }]}>
              {`${hoursTotal(progress.last30DaysFastingMin)} vs ${hoursTotal(progress.prior30DaysFastingMin)}`}
            </Text>
            <Text style={[styles.caption, { color: c.textAlt }]}>
              Fasting hours compared with the 30 days before
            </Text>
          </View>

          <View style={[styles.card, { borderColor: c.divider }]}>
            <Text style={[styles.eyebrow, { color: c.textAlt }]}>Your Resets</Text>
            {days === null ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <Calendar
                days={days}
                selected={selected}
                onSelect={setSelected}
                colors={c}
              />
            )}
            <Text style={[styles.caption, { color: c.text }]}>
              {selected ? dayDetail(selected) : "Tap a day to see that Reset."}
            </Text>
            <Legend colors={c} />
          </View>

          {state.plan && state.status !== "HOLD" ? (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.ghostBtn, { backgroundColor: c.ghost }]}
                onPress={askLonger}
                disabled={asking}
                activeOpacity={0.85}
              >
                {asking ? (
                  <ActivityIndicator color={c.text} />
                ) : (
                  <Text style={[styles.ghostBtnText, { color: c.text }]}>Try a longer Window</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      )}

      <WindowUpdateSheet
        update={update}
        onAccept={async (id) => {
          await controller.acceptUpdate(id);
          loadHistory();
        }}
        onDecline={controller.declineUpdate}
        onClose={() => setUpdate(null)}
      />
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: WindowColors }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.eyebrow, { color: colors.textAlt }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function localDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayDetail(day: WindowHistoryDay): string {
  const label = localDate(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  switch (day.state) {
    case "complete":
    case "short":
      return `${label}: ${durationShort(day.actualDurationMin ?? 0)} Reset`;
    case "running":
      return `${label}: Reset in progress`;
    case "hold":
      return `${label}: Window paused`;
    default:
      return `${label}: No Reset`;
  }
}

function Calendar({
  days,
  selected,
  onSelect,
  colors,
}: {
  days: WindowHistoryDay[];
  selected: WindowHistoryDay | null;
  onSelect: (day: WindowHistoryDay) => void;
  colors: WindowColors;
}) {
  if (days.length === 0) {
    return <Text style={[styles.caption, { color: colors.textAlt }]}>No Resets yet.</Text>;
  }
  // Pad the first week so every day sits under its weekday, and the last so
  // every row has seven slots. Explicit rows of flex cells: seven 14.2857%
  // widths round past 100% and the seventh wrapped, emptying Saturday.
  const lead = localDate(days[0].date).getDay();
  const cells: (WindowHistoryDay | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  // The cells show day numbers only, so name the span they cover.
  const span = (ymd: string) =>
    localDate(ymd).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View>
      <Text style={[styles.caption, styles.span, { color: colors.textAlt }]}>
        {`${span(days[0].date)} – ${span(days[days.length - 1].date)}`}
      </Text>
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.textAlt }]}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, w) => (
      <View key={w} style={styles.week}>
        {week.map((day, i) => (
          <View key={day?.date ?? `pad-${w}-${i}`} style={styles.cellSlot}>
            {day ? (
              <TouchableOpacity
                onPress={() => onSelect(day)}
                style={[
                  styles.cell,
                  dayStyle(day, colors),
                  selected?.date === day.date && { borderColor: colors.text, borderWidth: 2 },
                ]}
                accessibilityLabel={dayDetail(day)}
              >
                <Text
                  style={[
                    styles.cellText,
                    { color: day.state === "complete" ? K.brown : colors.text },
                  ]}
                >
                  {Number(day.date.slice(8))}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
      ))}
    </View>
  );
}

function dayStyle(day: WindowHistoryDay, colors: WindowColors) {
  switch (day.state) {
    case "complete":
      return { backgroundColor: K.blue, borderColor: K.blue };
    case "short":
      return { borderColor: K.blue, borderWidth: 2 };
    case "running":
      return { borderColor: K.blue, borderWidth: 2, borderStyle: "dashed" as const };
    case "hold":
      return { backgroundColor: colors.ghost, borderColor: "transparent" };
    default:
      return { borderColor: "transparent", opacity: 0.55 };
  }
}

function Legend({ colors }: { colors: WindowColors }) {
  const items: { label: string; day: WindowHistoryDay["state"] }[] = [
    { label: "Complete", day: "complete" },
    { label: "Short", day: "short" },
    { label: "Paused", day: "hold" },
  ];
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              dayStyle({ state: item.day } as WindowHistoryDay, colors),
            ]}
          />
          <Text style={[styles.caption, { color: colors.textAlt }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerIconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  flip: { transform: [{ rotate: "180deg" }] },
  headerTitle: { fontFamily: fonts.catalogue, fontSize: 18, letterSpacing: -0.18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 24 },
  hero: { gap: 4 },
  heroValue: { fontFamily: fonts.quadrant, fontSize: 56, letterSpacing: -0.56 },
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 20 },
  stat: { width: "50%", gap: 4 },
  statValue: { fontFamily: fonts.quadrant, fontSize: 28, letterSpacing: -0.28 },
  caption: { fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontFamily: fonts.quadrant, fontSize: 12, marginBottom: 8 },
  cellSlot: { flex: 1, aspectRatio: 1, padding: 3 },
  span: { marginBottom: 12 },
  cell: { flex: 1, borderRadius: 100, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cellText: { fontFamily: fonts.catalogue, fontSize: 13 },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  error: { fontFamily: fonts.catalogue, fontSize: 14, color: K.err },
  ghostBtn: { minHeight: 48, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 16 },
});

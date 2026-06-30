import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import {
  getProfileInsight,
  ProfileMetric,
} from "../../services/profile";
import { TrendIcon } from "../../components/TrendIcon";
import { ConfidencePie } from "../../components/ConfidencePie";


export type StatDetailVariant = "signal" | "confidence" | "simple";

export interface StatDetailData {
  metric: ProfileMetric;
  variant: StatDetailVariant;
  eyebrow: string; // "About Today's Signals"
  title: string; // "Stress Index" | "Confidence Score" | "Drive"
  // The qualitative value/label shown on the profile card — forwarded to the
  // insight endpoint so the blurb matches what the user tapped.
  value?: string | null;
  trend?: "up" | "down" | "same" | null;
  trendText?: string | null; // "Down from last week"
  // signal variant
  number?: number | null; // big "32 out of 100"
  valueBig?: string | null; // big qualitative word when no number (energy)
  series?: number[];
  level?: number; // 0–1, single-point slope
  // confidence variant
  pct?: number | null; // 50
}

interface Props {
  visible: boolean;
  data: StatDetailData | null;
  accent: string;
  evening: boolean;
  // The user's metabolic-type logo, shown on the Ester insight card.
  typeLogo: ImageSourcePropType;
  onClose: () => void;
  onStartChat: (topic: { kind: ProfileMetric; label?: string | null }) => void;
}

// Render an LLM blurb, turning **double-asterisk** spans into bold runs (the
// generate_profile_insight tool highlights key phrases this way).
function renderBold(
  text: string,
  regularColor: string,
  boldColor: string,
): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p.length > 0)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <Text key={i} style={{ fontFamily: fonts.catalogueBold, color: boldColor }}>
          {part.slice(2, -2)}
        </Text>
      ) : (
        <Text key={i} style={{ color: regularColor }}>
          {part}
        </Text>
      ),
    );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Weekday labels for the last `n` days ending today (approximate x-axis — the
// detail chart mirrors the Figma's Mon–Sun strip).
function recentWeekdayLabels(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(WEEKDAYS[d.getDay()]);
  }
  return out;
}

const CHART_H = 174;

function AreaChart({
  series,
  level,
  accent,
}: {
  series: number[];
  level: number;
  accent: string;
}) {
  const [w, setW] = useState(0);
  const fillId = `statFill_${accent.replace("#", "")}`;
  const padX = 6;
  const padTop = 14;
  const padBottom = 6;

  let line = "";
  let area = "";
  let dotX = 0;
  let dotY = 0;

  if (w > 0) {
    const usableW = w - padX * 2;
    const usableH = CHART_H - padTop - padBottom;
    if (series.length >= 2) {
      const min = Math.min(...series);
      const max = Math.max(...series);
      const span = max - min || 1;
      const stepX = usableW / (series.length - 1);
      const pts = series.map((v, i) => ({
        x: padX + i * stepX,
        y: padTop + (1 - (v - min) / span) * usableH,
      }));
      line = pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
      const last = pts[pts.length - 1];
      const first = pts[0];
      area = `${line} L ${last.x.toFixed(1)} ${CHART_H} L ${first.x.toFixed(1)} ${CHART_H} Z`;
      dotX = last.x;
      dotY = last.y;
    } else {
      // Single / no point: one sloped line whose direction reflects the level.
      const x0 = padX;
      const x1 = w - padX;
      const midY = CHART_H / 2;
      const rise = 22;
      let y0 = midY;
      let y1 = midY;
      if (level >= 0.6) {
        y0 = midY + rise;
        y1 = midY - rise;
      } else if (level <= 0.4) {
        y0 = midY - rise;
        y1 = midY + rise;
      }
      line = `M${x0} ${y0.toFixed(1)} L ${x1} ${y1.toFixed(1)}`;
      area = `${line} L ${x1} ${CHART_H} L ${x0} ${CHART_H} Z`;
      dotX = x1;
      dotY = y1;
    }
  }

  const labels = recentWeekdayLabels(Math.max(series.length, 7) > 7 ? 7 : Math.max(series.length, 7));

  return (
    <View style={styles.chartWrap}>
      <View
        style={{ width: "100%", height: CHART_H }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        {w > 0 ? (
          <Svg width={w} height={CHART_H}>
            <Defs>
              <RadialGradient id={fillId} cx="50%" cy="0%" rx="90%" ry="120%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.45} />
                <Stop offset="1" stopColor={accent} stopOpacity={0.05} />
              </RadialGradient>
            </Defs>
            {area ? <Path d={area} fill={`url(#${fillId})`} /> : null}
            {line ? (
              <Path
                d={line}
                stroke={accent}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {dotX ? <Circle cx={dotX} cy={dotY} r={5} fill={accent} /> : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.chartLabels}>
        {labels.map((l, i) => (
          <Text key={i} style={styles.chartLabel}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function StatDetailSheet({
  visible,
  data,
  accent,
  evening,
  typeLogo,
  onClose,
  onStartChat,
}: Props) {
  const insets = useSafeAreaInsets();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Theme: light bone sheet in day, dark maroon sheet in evening.
  const sheetBg = evening ? "#2A0E10" : K.bone;
  const textStrong = evening ? K.bone : K.brown;
  const textSubtle = evening ? "#B8A7A8" : "#7e6869";
  const divider = evening ? "#7A565A" : "#C3B9BA";
  const cardBg = evening ? "#3D1F22" : K.bone;

  useEffect(() => {
    if (!visible || !data) return;
    let alive = true;
    setInsight(null);
    setLoading(true);
    getProfileInsight(data.metric, {
      title: data.title,
      value: data.value ?? data.valueBig ?? null,
      trend: data.trend ?? null,
    })
      .then((res) => {
        if (alive) setInsight(res.text);
      })
      .catch(() => {
        if (alive)
          setInsight(
            "I'm still learning your pattern here — keep scanning and checking in and this sharpens up.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, data]);

  if (!data) return null;

  const showNumber = data.variant === "signal" && data.number != null;
  const showValueBig =
    data.variant === "signal" && data.number == null && !!data.valueBig;
  // Stress is the only metric here where a downward trend is the good one; all
  // others (energy, recovery, confidence) improve as they rise. Drives the
  // valence-aware trend icon color.
  const betterDirection = data.metric === "stress" ? "down" : "up";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableOpacity
          style={styles.scrimTop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, paddingBottom: insets.bottom + 24 },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: textStrong }]} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* Title block */}
            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowDot, { backgroundColor: accent }]} />
              <Text style={[styles.eyebrowText, { color: textStrong }]}>
                {data.eyebrow}
              </Text>
            </View>
            <Text style={[styles.title, { color: textStrong }]}>{data.title}</Text>
            {data.trendText ? (
              <View style={styles.trendRow}>
                <TrendIcon
                  direction={data.trend ?? null}
                  betterDirection={betterDirection}
                  size={18}
                />
                <Text style={[styles.trendText, { color: textSubtle }]}>
                  {data.trendText}
                </Text>
              </View>
            ) : null}

            {/* Big stat */}
            {showNumber ? (
              <View style={styles.statRow}>
                <Text style={[styles.statNumber, { color: textStrong }]}>
                  {Math.round(data.number as number)}
                </Text>
                <Text style={[styles.statUnit, { color: textSubtle }]}>
                  out of 100
                </Text>
              </View>
            ) : null}
            {showValueBig ? (
              <Text style={[styles.statWord, { color: textStrong }]}>
                {data.valueBig}
              </Text>
            ) : null}
            {/* RES-157: pie only (no %); empty slice = days left to 100%. */}
            {data.variant === "confidence" && data.pct != null ? (
              <View style={styles.confidenceStatRow}>
                <ConfidencePie
                  fraction={data.pct / 100}
                  color={textStrong}
                  size={24}
                />
              </View>
            ) : null}

            {/* Area chart (signal only) */}
            {data.variant === "signal" ? (
              <AreaChart
                series={data.series ?? []}
                level={data.level ?? 0.5}
                accent={accent}
              />
            ) : null}

            {/* Ester insight card */}
            <View style={styles.insightBlock}>
              <View style={[styles.eyebrowRow, styles.insightEyebrow]}>
                <View
                  style={[styles.eyebrowDot, { backgroundColor: accent }]}
                />
                <Text style={[styles.eyebrowText, { color: textStrong }]}>
                  What this means for you
                </Text>
              </View>
              <View
                style={[
                  styles.insightCard,
                  { borderColor: divider, backgroundColor: cardBg },
                ]}
              >
                <Image
                  source={typeLogo}
                  style={styles.esterAvatar}
                  resizeMode="contain"
                />
                <View style={styles.insightTextWrap}>
                  {loading ? (
                    <View style={styles.skeletonWrap}>
                      <ActivityIndicator size="small" color={accent} />
                      <Text
                        style={[styles.skeletonText, { color: textSubtle }]}
                      >
                        Ester is thinking…
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.insightText}>
                        {renderBold(insight ?? "", textSubtle, textStrong)}
                      </Text>
                      <Text
                        style={[styles.insightFollow, { color: textSubtle }]}
                      >
                        Want to talk more about this?
                      </Text>
                    </>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.chatBtn, { backgroundColor: accent }]}
                onPress={() =>
                  onStartChat({
                    kind: data.metric,
                    label: data.value ?? data.title,
                  })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.chatBtnText}>Start a chat</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Close — direct child of the sheet (a large container) so the full
              touch target registers; rendered last so it sits above the scroll. */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <CloseIcon color={textStrong} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  scrimTop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  handleRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 100,
    opacity: 0.2,
  },
  closeBtn: {
    position: "absolute",
    top: 8,
    right: 12,
    padding: 12,
    zIndex: 10,
  },
  content: {
    paddingTop: 16,
    gap: 24,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4 },
  eyebrowText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  title: {
    fontFamily: fonts.catalogue,
    fontSize: 38,
    letterSpacing: -0.4,
    marginTop: -16,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -16,
  },
  trendText: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14 },
  statRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  confidenceStatRow: {
    flexDirection: "row",
    // Baseline-align so the pie's bottom edge lands on the percentage's
    // baseline (its visible bottom — "45%" has no descenders) rather than the
    // font box bottom, which sits lower.
    alignItems: "baseline",
    gap: 8,
  },
  statNumber: {
    fontFamily: fonts.quadrant,
    fontSize: 64,
    letterSpacing: -0.64,
  },
  statUnit: { fontFamily: fonts.dmSans, fontSize: 12, opacity: 0.7 },
  statWord: {
    fontFamily: fonts.quadrant,
    fontSize: 56,
    letterSpacing: -0.5,
  },
  chartWrap: { width: "100%", gap: 12 },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
    color: "#9C8E8E",
  },
  insightBlock: { width: "100%", gap: 12, alignItems: "flex-end" },
  // Counter the block's flex-end so the eyebrow stays at the container start
  // (only the "Start a chat" button should hug the right).
  insightEyebrow: { alignSelf: "flex-start" },
  insightCard: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    borderWidth: 0.5,
    paddingTop: 10,
    paddingBottom: 16,
    paddingLeft: 12,
    paddingRight: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  esterAvatar: { width: 44, height: 44, borderRadius: 22 },
  insightTextWrap: { flex: 1, justifyContent: "center", paddingTop: 2 },
  insightText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
  },
  insightFollow: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  skeletonWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  skeletonText: { fontFamily: fonts.catalogue, fontSize: 14 },
  chatBtn: {
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtnText: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.brown,
  },
});

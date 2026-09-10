import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import { logEvent } from "../../services/braze";
import {
  markPayoffShown,
  type PayoffCopyId,
  type WindowInstance,
  type WindowState,
} from "../../services/resetWindow";
import {
  COPY,
  durationShort,
  durationWords,
  payoffLine,
  relativeDayTime,
} from "../../utils/resetWindow";
import { CloseIcon, MinusIcon, PencilIcon, PlusIcon } from "./icons";
import { windowColors } from "./palette";

const MINUTE_MS = 60_000;
const ADJUST_STEP_MIN = 15;

export type PendingPayoff = WindowInstance & { copyId: PayoffCopyId; currentStreak: number };

interface Props {
  payoff: PendingPayoff | null;
  windowText: string | null; // "14:10"
  nextStartText: string | null; // "Tonight, 8:00pm"
  onDone: () => void;
  onCorrect: (
    instanceId: string,
    times: { actualStartAt?: string; actualEndAt?: string },
  ) => Promise<WindowState>;
}

/**
 * The Morning Payoff — the habit spine. Shown on the first open after a Reset
 * ends; the actual duration leads, then the current Window and what's next,
 * then Adjust (handoff FLIP + PAYOFF). A short Reset gets the same truth with no
 * failure copy; a correction updates the numbers but never replays the Payoff.
 */
export function MorningPayoffSheet({ payoff, windowText, nextStartText, onDone, onCorrect }: Props) {
  const insets = useSafeAreaInsets();
  const { evening } = useAppPalette();
  const c = windowColors(evening);

  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [adjusted, setAdjusted] = useState(false);
  const [editing, setEditing] = useState<"start" | "end" | null>(null);
  const [draft, setDraft] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mark it shown the moment it is on screen — "shown once" is about being
  // seen, not about the member pressing Done.
  useEffect(() => {
    if (!payoff) return;
    setStartAt(payoff.actualStartAt);
    setEndAt(payoff.actualEndAt);
    setStreak(payoff.currentStreak);
    setAdjusted(false);
    setEditing(null);
    setError(null);
    markPayoffShown(payoff.id).catch(() => {});
    logEvent("morning_payoff_shown", {
      variant: payoff.copyId,
      actualDurationMin: payoff.actualDurationMin ?? 0,
    });
  }, [payoff?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!payoff || !startAt || !endAt) return null;

  const durationMin = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / MINUTE_MS,
  );
  const short = payoff.copyId === "W_PAYOFF_04";
  const headline = adjusted
    ? `You reset for ${durationWords(durationMin)}.`
    : payoffLine(payoff.copyId, durationMin, streak);

  const beginEdit = (field: "start" | "end") => {
    setEditing(field);
    setDraft(new Date(field === "start" ? startAt : endAt));
    setError(null);
  };

  const saveEdit = async () => {
    if (!editing || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const times =
        editing === "start"
          ? { actualStartAt: draft.toISOString() }
          : { actualEndAt: draft.toISOString() };
      const next = await onCorrect(payoff.id, times);
      if (editing === "start") setStartAt(draft.toISOString());
      else setEndAt(draft.toISOString());
      setStreak(next.progress.currentStreak);
      setAdjusted(true);
      setEditing(null);
      logEvent("window_adjusted", { field: editing });
    } catch (err: any) {
      setError(err?.message || "Couldn’t save that time. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onDone}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onDone} />
        <View style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: c.text }]} />
          </View>

          <View style={styles.content}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: c.text }]}>{headline}</Text>
              <Text style={[styles.subtitle, { color: c.textAlt }]}>
                {adjusted
                  ? "Updated."
                  : short
                    ? COPY.W_EARLY_01
                    : [windowText ? `Your Window: ${windowText}` : null, nextStartText ? `Next Reset ${nextStartText}` : null]
                        .filter(Boolean)
                        .join(" · ")}
              </Text>
            </View>

            <View style={[styles.rule, { backgroundColor: c.divider }]} />

            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={[styles.statLabel, { color: c.textAlt }]}>Total Reset</Text>
                <Text style={[styles.statValue, { color: c.text }]}>{durationShort(durationMin)}</Text>
              </View>
              {!short && streak > 0 ? (
                <View style={styles.stat}>
                  <Text style={[styles.statLabel, { color: c.textAlt }]}>Current streak</Text>
                  <Text style={[styles.statValue, { color: c.text }]}>{`${streak} in a row`}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.timesRow}>
              <TimeField
                label="Started"
                value={relativeDayTime(startAt)}
                colors={c}
                onEdit={() => beginEdit("start")}
              />
              <TimeField
                label="Ended"
                value={relativeDayTime(endAt)}
                colors={c}
                onEdit={() => beginEdit("end")}
              />
            </View>

            {editing && draft ? (
              <View style={[styles.editCard, { borderColor: c.divider }]}>
                <Text style={[styles.statLabel, { color: c.textAlt }]}>
                  {editing === "start" ? "When did your Reset start?" : "When did your Reset end?"}
                </Text>
                <View style={styles.editRow}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, { backgroundColor: c.ghost }]}
                    onPress={() => setDraft((d) => d && new Date(d.getTime() - ADJUST_STEP_MIN * MINUTE_MS))}
                  >
                    <MinusIcon color={c.text} />
                  </TouchableOpacity>
                  <Text style={[styles.editValue, { color: c.text }]}>{relativeDayTime(draft.toISOString())}</Text>
                  <TouchableOpacity
                    style={[styles.stepperBtn, { backgroundColor: c.ghost }]}
                    onPress={() => setDraft((d) => d && new Date(d.getTime() + ADJUST_STEP_MIN * MINUTE_MS))}
                  >
                    <PlusIcon color={c.text} />
                  </TouchableOpacity>
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setEditing(null)} style={[styles.ghostBtn, { backgroundColor: c.ghost }]}>
                    <Text style={[styles.ghostBtnText, { color: c.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveEdit} disabled={saving} style={[styles.ghostBtn, { backgroundColor: K.blue }]}>
                    {saving ? (
                      <ActivityIndicator color={K.brown} />
                    ) : (
                      <Text style={[styles.ghostBtnText, { color: K.brown }]}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDone}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <CloseIcon color={c.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function TimeField({
  label,
  value,
  colors,
  onEdit,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof windowColors>;
  onEdit: () => void;
}) {
  return (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: colors.textAlt }]}>{label}</Text>
      <TouchableOpacity style={styles.timeValueRow} onPress={onEdit} hitSlop={{ top: 8, bottom: 8 }}>
        <Text style={[styles.timeValue, { color: colors.text }]}>{value}</Text>
        <PencilIcon color={colors.text} size={16} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  scrim: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  handleRow: { alignItems: "center", marginBottom: 8 },
  handle: { width: 36, height: 5, borderRadius: 100, opacity: 0.2 },
  closeBtn: { position: "absolute", top: 8, right: 12, padding: 12, zIndex: 10 },
  content: { paddingTop: 16, gap: 24 },
  titleBlock: { gap: 8, paddingRight: 32 },
  title: { fontFamily: fonts.catalogue, fontSize: 32, lineHeight: 36, letterSpacing: -0.32 },
  subtitle: { fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  rule: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: "row", gap: 40 },
  stat: { gap: 4 },
  statLabel: { fontFamily: fonts.quadrant, fontSize: 14, letterSpacing: -0.14 },
  statValue: { fontFamily: fonts.quadrant, fontSize: 40, letterSpacing: -0.4 },
  timesRow: { flexDirection: "row", gap: 40 },
  timeField: { gap: 4, minWidth: 128 },
  timeLabel: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  timeValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeValue: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14 },
  editCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  editRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editValue: { fontFamily: fonts.quadrant, fontSize: 22, letterSpacing: -0.22, flex: 1, textAlign: "center" },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  stepperBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  ghostBtn: { minHeight: 32, minWidth: 72, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
  error: { fontFamily: fonts.catalogue, fontSize: 14, color: K.err },
  primaryBtn: { minHeight: 56, borderRadius: 4, backgroundColor: K.blue, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: K.brown },
});

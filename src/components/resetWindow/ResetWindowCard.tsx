import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import type { ResetWindowController } from "../../hooks/useResetWindow";
import { logEvent } from "../../services/braze";
import { markFlipShown } from "../../services/resetWindow";
import {
  COPY,
  clockFace,
  localTimeLabel,
  relativeDayTime,
  resetStage,
  windowLabel,
} from "../../utils/resetWindow";
import { WindowRing } from "./WindowRing";
import { WindowPlanSheet } from "./WindowPlanSheet";
import { MorningPayoffSheet, type PendingPayoff } from "./MorningPayoffSheet";
import { ArrowIcon, PencilIcon } from "./icons";
import { windowColors } from "./palette";

const MINUTE_MS = 60_000;
const NOTICE_MS = 6000;

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * The Window on Today: one object, two lives. While the eating window is open
 * it is a quiet countdown to the next Reset; during the Reset it counts up and
 * shows the stage. Owns the Flip (one haptic + W_FLIP_01, once per Reset), the
 * plan picker and the Morning Payoff.
 */
export function ResetWindowCard({ controller }: { controller: ResetWindowController }) {
  const { state } = controller;
  const { evening } = useAppPalette();
  const c = windowColors(evening);

  const [planOpen, setPlanOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payoff, setPayoff] = useState<PendingPayoff | null>(null);
  const seenPayoffs = useRef(new Set<string>());
  const flipped = useRef(new Set<string>());

  const status = state?.status;
  const active = state?.activeInstance ?? null;
  const now = useNow(status === "EATING_OPEN" || status === "RESET_ACTIVE" || status === "RESET_SHIFTED");

  // The Flip: at the scheduled start if the app is open, otherwise once on the
  // next open while the Reset is still running (never a stale Flip after it).
  useEffect(() => {
    if (!active || active.flipShown || flipped.current.has(active.id)) return;
    flipped.current.add(active.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setNotice(COPY.W_FLIP_01);
    logEvent("flip_shown", { surface: "today" });
    markFlipShown(active.id).catch(() => {});
  }, [active]);

  // Hold the Payoff in local state: marking it shown clears it from the next
  // server read, and the sheet must not vanish while the member is reading it.
  useEffect(() => {
    const pending = state?.pendingPayoff;
    if (!pending || seenPayoffs.current.has(pending.id)) return;
    seenPayoffs.current.add(pending.id);
    setPayoff(pending);
  }, [state?.pendingPayoff]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!state) return null;

  const openPlan = () => {
    logEvent("home_window_editCTA", { status: state.status });
    setPlanOpen(true);
  };

  const handleImEating = () => {
    Alert.alert("I’m eating", "Let Ester know you’re eating now?", [
      { text: "Not yet", style: "cancel" },
      {
        text: "I’m eating",
        onPress: async () => {
          logEvent("window_im_eatingCTA");
          try {
            const next = await controller.imEating();
            if (next.status === "RESET_SHIFTED" && next.activeInstance) {
              setNotice(COPY.W_SHIFT_01(relativeDayTime(next.activeInstance.scheduledOpenAt).split(", ")[1]));
            } else if (next.status === "EATING_OPEN") {
              setNotice(COPY.W_EARLY_01);
            }
          } catch {
            setNotice("Couldn’t reach Reset. Try again in a moment.");
          }
        },
      },
    ]);
  };

  const handleResume = async () => {
    try {
      await controller.resume();
      setNotice(COPY.W_RESUME_01);
    } catch {
      setNotice("Couldn’t reach Reset. Try again in a moment.");
    }
  };

  const pill = state.plan ? (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: c.ghost }]}
      onPress={openPlan}
      activeOpacity={0.85}
      accessibilityLabel="Edit your Reset window"
    >
      <Text style={[styles.pillText, { color: c.text }]}>
        {`${windowLabel(state.plan.assignedDurationMin)} Fast`}
      </Text>
      <PencilIcon color={c.text} size={18} />
    </TouchableOpacity>
  ) : null;

  const streak = state.progress.currentStreak;
  let body: React.ReactNode;

  if (status === "UNASSIGNED") {
    body = (
      <View style={styles.setup}>
        <Text style={[styles.eyebrow, { color: c.textAlt }]}>Get Started</Text>
        <View style={styles.setupText}>
          <Text style={[styles.setupTitle, { color: c.text }]}>No fasting window set</Text>
          <Text style={[styles.body, { color: c.text }]}>
            Choose your fasting schedule to start your Reset.
          </Text>
        </View>
        <TouchableOpacity style={styles.blueBtn} onPress={openPlan} activeOpacity={0.85}>
          <Text style={styles.blueBtnText}>Set Window</Text>
          <ArrowIcon color={K.brown} />
        </TouchableOpacity>
      </View>
    );
  } else if (status === "HOLD") {
    body = (
      <>
        <Header title="Your Window is paused" subtitle={null} pill={pill} colors={c} />
        <Text style={[styles.body, { color: c.text }]}>{COPY.W_HOLD_01}</Text>
        <TouchableOpacity style={[styles.ghostBtn, { backgroundColor: c.ghost }]} onPress={handleResume}>
          <Text style={[styles.ghostBtnText, { color: c.text }]}>Resume</Text>
        </TouchableOpacity>
      </>
    );
  } else if ((status === "RESET_ACTIVE" || status === "RESET_SHIFTED") && active) {
    const startMs = new Date(active.actualStartAt).getTime();
    const openMs = new Date(active.scheduledOpenAt).getTime();
    const elapsed = Math.max(0, now - startMs);
    const fraction = openMs > startMs ? elapsed / (openMs - startMs) : 1;
    const pct = Math.min(100, Math.floor(fraction * 100));
    body = (
      <>
        <Header
          title="You’re in your Reset"
          subtitle={`Current stage: ${resetStage(fraction)}`}
          pill={pill}
          colors={c}
        />
        <WindowRing
          size={232}
          strokeWidth={8}
          fraction={fraction}
          trackColor={c.track}
          progressColor={K.blue}
          segments={3}
          gapDegrees={6}
        >
          <Text style={[styles.timerBig, { color: c.text }]}>{clockFace(elapsed)}</Text>
          <Text style={[styles.timerSub, { color: c.textAlt }]}>{`Spent in your Reset (${pct}%)`}</Text>
        </WindowRing>
        <View style={styles.timesRow}>
          <TimeCell label="Started" value={relativeDayTime(active.actualStartAt)} colors={c} />
          <TimeCell label="Eating window opens" value={relativeDayTime(active.scheduledOpenAt)} colors={c} />
        </View>
        <TouchableOpacity style={[styles.ghostBtn, { backgroundColor: c.ghost }]} onPress={handleImEating}>
          <Text style={[styles.ghostBtnText, { color: c.text }]}>I’m eating</Text>
        </TouchableOpacity>
      </>
    );
  } else {
    // EATING_OPEN — quiet countdown to the next Reset.
    const plan = state.plan;
    const nextMs = state.nextScheduledStartAt ? new Date(state.nextScheduledStartAt).getTime() : null;
    const remaining = nextMs ? Math.max(0, nextMs - now) : 0;
    const eatingMs = (plan?.eatingMin ?? 600) * MINUTE_MS;
    const fraction = nextMs ? 1 - Math.min(1, remaining / eatingMs) : 0;
    const startsLater = nextMs !== null && remaining > eatingMs;
    body = (
      <>
        <Header
          title="Eating Window Open"
          subtitle={
            streak > 0
              ? `${streak} Reset streak`
              : plan
                ? `Your Reset starts at ${localTimeLabel(plan.startLocalTime)}`
                : null
          }
          pill={pill}
          colors={c}
        />
        {startsLater && state.nextScheduledStartAt ? (
          // A new or changed plan whose first Reset is more than a window away.
          <Text style={[styles.body, { color: c.text }]}>
            {`Your first Reset starts ${relativeDayTime(state.nextScheduledStartAt)}.`}
          </Text>
        ) : (
          <WindowRing
            size={152}
            strokeWidth={5}
            fraction={fraction}
            trackColor={c.track}
            progressColor={c.progress}
          >
            <Text style={[styles.timerMid, { color: c.text }]}>{clockFace(remaining)}</Text>
            <Text style={[styles.timerSub, { color: c.textAlt }]}>until your Reset</Text>
          </WindowRing>
        )}
      </>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {notice ? <Text style={[styles.notice, { color: c.text }]}>{notice}</Text> : null}
      {body}

      <WindowPlanSheet
        visible={planOpen}
        state={state}
        onClose={() => setPlanOpen(false)}
        onSave={controller.savePlan}
      />
      <MorningPayoffSheet
        payoff={payoff}
        windowText={state.plan ? windowLabel(state.plan.assignedDurationMin) : null}
        nextStartText={state.nextScheduledStartAt ? relativeDayTime(state.nextScheduledStartAt) : null}
        onDone={() => setPayoff(null)}
        onCorrect={controller.correct}
      />
    </View>
  );
}

function Header({
  title,
  subtitle,
  pill,
  colors,
}: {
  title: string;
  subtitle: string | null;
  pill: React.ReactNode;
  colors: ReturnType<typeof windowColors>;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.caption, { color: colors.text }]}>{subtitle}</Text> : null}
      </View>
      {pill}
    </View>
  );
}

function TimeCell({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof windowColors>;
}) {
  return (
    <View style={styles.timeCell}>
      <Text style={[styles.timeLabel, { color: colors.textAlt }]}>{label}</Text>
      <Text style={[styles.timeValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    // The card moves between leading Today (above the score) and sitting below
    // it, so it carries its own gap on both sides rather than relying on its
    // neighbour's margin.
    marginBottom: spacing.md,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 32,
    alignItems: "center",
    gap: 24,
    overflow: "hidden",
  },
  notice: {
    alignSelf: "stretch",
    fontFamily: fonts.catalogue,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.14,
  },
  header: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, gap: 6 },
  title: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2 },
  caption: { fontFamily: fonts.catalogue, fontSize: 12, letterSpacing: -0.12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  pillText: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
  body: { alignSelf: "stretch", fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  setup: { alignSelf: "stretch", gap: 16 },
  setupText: { gap: 4 },
  setupTitle: { fontFamily: fonts.catalogue, fontSize: 24, letterSpacing: -0.24 },
  blueBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: K.blue,
  },
  blueBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: K.brown },
  timerBig: { fontFamily: fonts.quadrant, fontSize: 56, letterSpacing: -0.56 },
  timerMid: { fontFamily: fonts.quadrant, fontSize: 40, letterSpacing: -0.4 },
  timerSub: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14, opacity: 0.85 },
  timesRow: { alignSelf: "stretch", flexDirection: "row" },
  timeCell: { flex: 1, alignItems: "center", gap: 4 },
  timeLabel: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  timeValue: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14 },
  ghostBtn: {
    minHeight: 32,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
});

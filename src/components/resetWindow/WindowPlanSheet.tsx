import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
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
import type { WindowState } from "../../services/resetWindow";
import {
  COPY,
  REBOUNDER_ONRAMP,
  WINDOW_PRESETS,
  localTimeLabel,
  windowLabel,
} from "../../utils/resetWindow";
import { CloseIcon, MinusIcon, PlusIcon } from "./icons";
import { windowColors } from "./palette";

// Handoff CONFIG: 14h standard floor (12h on a Rebounder's on-ramp), 18h
// ceiling. The server enforces these too; the sheet just never offers more.
const STANDARD_FLOOR = 840;
const ONRAMP_FLOOR = 720;
const CEILING = 1080;
const CUSTOM_STEP = 15;
const START_STEP = 30;

function shiftClock(hhmm: string, deltaMin: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h} hrs`;
}

interface Props {
  visible: boolean;
  state: WindowState;
  onClose: () => void;
  onSave: (durationMin: number, startLocalTime: string) => Promise<unknown>;
}

/**
 * Choose or change the Window: Ester's recommendation preselected, the familiar
 * picker (14:10 / 15:9 / 16:8 / 18:6, plus 12:12 on a Rebounder's on-ramp), a
 * Custom length, and where it sits in the day. Both clock times are shown
 * before confirming (handoff STARTING WINDOW → Schedule placement).
 */
export function WindowPlanSheet({ visible, state, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const { evening } = useAppPalette();
  const c = windowColors(evening);

  const plan = state.plan;
  const initialDuration =
    plan?.assignedDurationMin ?? state.recommendation?.durationMin ?? STANDARD_FLOOR;
  const initialStart = plan?.startLocalTime ?? "20:00";
  const onRamp =
    state.recommendation?.copyId === "W_START_RB" ||
    plan?.assignedDurationMin === ONRAMP_FLOOR;
  const floor = onRamp ? ONRAMP_FLOOR : STANDARD_FLOOR;
  const presets = onRamp ? [REBOUNDER_ONRAMP, ...WINDOW_PRESETS] : [...WINDOW_PRESETS];
  const isPreset = (d: number) => presets.some((p) => p.durationMin === d);

  const [duration, setDuration] = useState(initialDuration);
  const [start, setStart] = useState(initialStart);
  const [custom, setCustom] = useState(!isPreset(initialDuration));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the draft each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setDuration(initialDuration);
    setStart(initialStart);
    setCustom(!isPreset(initialDuration));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(duration, start);
      logEvent("window_plan_saved", {
        durationMin: duration,
        first: !plan,
        custom: !isPreset(duration),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Couldn’t save your Window. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const subtitle =
    !plan && state.recommendation
      ? COPY[state.recommendation.copyId]
      : "Set the hours to eat and fast";

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: c.text }]} />
          </View>

          {/* The choices scroll; the footer below stays pinned so the primary
              button is always on screen, however tall the choices get. */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: c.text }]}>
                {plan ? "Edit your Reset window" : "Choose your Reset window"}
              </Text>
              <Text style={[styles.subtitle, { color: c.textAlt }]}>{subtitle}</Text>
            </View>

            <View style={styles.grid}>
              {presets.map((p) => {
                const selected = !custom && duration === p.durationMin;
                return (
                  <TouchableOpacity
                    key={p.durationMin}
                    activeOpacity={0.85}
                    onPress={() => {
                      setDuration(p.durationMin);
                      setCustom(false);
                    }}
                    style={[
                      styles.tile,
                      { borderColor: c.divider },
                      selected && styles.tileSelected,
                    ]}
                  >
                    <Text style={[styles.tileLabel, { color: selected ? K.brown : c.text }]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.tileSub, { color: selected ? K.brown : c.text }]}>
                      {`${p.durationMin / 60} hrs fasting\n${24 - p.durationMin / 60} hrs eating`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {custom ? (
              <View style={[styles.stepperCard, { borderColor: K.blue }]}>
                <Text style={[styles.stepperEyebrow, { color: c.textAlt }]}>Custom window</Text>
                <View style={styles.stepperRow}>
                  <Stepper
                    icon="minus"
                    color={c.text}
                    bg={c.ghost}
                    disabled={duration - CUSTOM_STEP < floor}
                    onPress={() => setDuration((d) => d - CUSTOM_STEP)}
                  />
                  <View style={styles.stepperValue}>
                    <Text style={[styles.stepperBig, { color: c.text }]}>{windowLabel(duration)}</Text>
                    <Text style={[styles.stepperSub, { color: c.textAlt }]}>
                      {`${hoursLabel(duration)} fasting · ${hoursLabel(1440 - duration)} eating`}
                    </Text>
                  </View>
                  <Stepper
                    icon="plus"
                    color={c.text}
                    bg={c.ghost}
                    disabled={duration + CUSTOM_STEP > CEILING}
                    onPress={() => setDuration((d) => d + CUSTOM_STEP)}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.ghostBtn, { backgroundColor: c.ghost }]}
                onPress={() => setCustom(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.ghostBtnText, { color: c.text }]}>Or choose a custom window</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.stepperCard, { borderColor: c.divider }]}>
              <Text style={[styles.stepperEyebrow, { color: c.textAlt }]}>Your Reset starts</Text>
              <View style={styles.stepperRow}>
                <Stepper icon="minus" color={c.text} bg={c.ghost} onPress={() => setStart((s) => shiftClock(s, -START_STEP))} />
                <View style={styles.stepperValue}>
                  <Text style={[styles.stepperBig, { color: c.text }]}>{localTimeLabel(start)}</Text>
                  <Text style={[styles.stepperSub, { color: c.textAlt }]}>
                    {`Eating window opens at ${localTimeLabel(shiftClock(start, duration))}`}
                  </Text>
                </View>
                <Stepper icon="plus" color={c.text} bg={c.ghost} onPress={() => setStart((s) => shiftClock(s, START_STEP))} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {plan ? (
              <Text style={[styles.footerNote, { color: c.text }]}>
                Changes apply from your next Reset
              </Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.primaryBtnBusy]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={K.brown} />
              ) : (
                <Text style={styles.primaryBtnText}>{plan ? "Save changes" : "Start my Window"}</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <CloseIcon color={c.text} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Stepper({
  icon,
  color,
  bg,
  disabled,
  onPress,
}: {
  icon: "minus" | "plus";
  color: string;
  bg: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.stepperBtn, { backgroundColor: bg, opacity: disabled ? 0.35 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {icon === "minus" ? <MinusIcon color={color} /> : <PlusIcon color={color} />}
    </TouchableOpacity>
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
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 24,
  },
  handleRow: { alignItems: "center", marginBottom: 8 },
  handle: { width: 36, height: 5, borderRadius: 100, opacity: 0.2 },
  closeBtn: { position: "absolute", top: 8, right: 12, padding: 12, zIndex: 10 },
  // Shrinks to fit so the pinned footer is never pushed off screen.
  scroll: { flexShrink: 1 },
  content: { paddingTop: 16, paddingBottom: 8, gap: 20 },
  titleBlock: { gap: 8, paddingRight: 32 },
  title: { fontFamily: fonts.catalogue, fontSize: 32, letterSpacing: -0.32 },
  subtitle: { fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    width: "48.5%",
    borderWidth: 1,
    padding: 16,
    gap: 16,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  tileSelected: { backgroundColor: K.blue, borderColor: "#77939A", borderWidth: 2 },
  tileLabel: { fontFamily: fonts.quadrant, fontSize: 32, letterSpacing: -0.32 },
  tileSub: { fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 17, letterSpacing: -0.14 },
  ghostBtn: {
    alignSelf: "center",
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    justifyContent: "center",
  },
  ghostBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
  stepperCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  stepperEyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stepperValue: { flex: 1, alignItems: "center", gap: 4 },
  stepperBig: { fontFamily: fonts.quadrant, fontSize: 32, letterSpacing: -0.32 },
  stepperSub: { fontFamily: fonts.catalogue, fontSize: 13, letterSpacing: -0.13, textAlign: "center" },
  footer: { gap: 12, alignItems: "center", paddingTop: 16 },
  footerNote: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14 },
  error: { fontFamily: fonts.catalogue, fontSize: 14, color: K.err, textAlign: "center" },
  primaryBtn: {
    alignSelf: "stretch",
    minHeight: 56,
    borderRadius: 4,
    backgroundColor: K.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnBusy: { opacity: 0.7 },
  primaryBtnText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: K.brown },
});

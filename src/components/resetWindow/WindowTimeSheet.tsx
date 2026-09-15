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
import { relativeDayTime } from "../../utils/resetWindow";
import { CloseIcon, MinusIcon, PlusIcon } from "./icons";
import { windowColors } from "./palette";

const MINUTE_MS = 60_000;

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  initial: string | null; // ISO
  saveLabel: string;
  stepMin?: number;
  onClose: () => void;
  onSave: (iso: string) => Promise<unknown>;
  secondary?: { label: string; onPress: () => Promise<unknown> } | null;
}

/**
 * One time, stepped: "Move tonight's Reset" and "Adjust start" during a Reset.
 * The server owns every limit (how far a night may move, overlaps, times in the
 * future) and its message is shown as-is.
 *
 * PLACEHOLDER UI: no Lang design yet.
 */
export function WindowTimeSheet({
  visible,
  title,
  subtitle,
  initial,
  saveLabel,
  stepMin = 15,
  onClose,
  onSave,
  secondary,
}: Props) {
  const insets = useSafeAreaInsets();
  const { evening } = useAppPalette();
  const c = windowColors(evening);
  const [draft, setDraft] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !initial) return;
    setDraft(new Date(initial));
    setError(null);
    setBusy(false);
  }, [visible, initial]);

  if (!visible || !draft) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Couldn’t save that time. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const step = (sign: 1 | -1) =>
    setDraft((d) => d && new Date(d.getTime() + sign * stepMin * MINUTE_MS));

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: c.text }]} />
          </View>
          <View style={styles.content}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: c.text }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: c.textAlt }]}>{subtitle}</Text>
              ) : null}
            </View>
            <View style={[styles.stepperCard, { borderColor: c.divider }]}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.ghost }]}
                onPress={() => step(-1)}
                accessibilityLabel={`${stepMin} minutes earlier`}
              >
                <MinusIcon color={c.text} />
              </TouchableOpacity>
              <Text style={[styles.value, { color: c.text }]}>
                {relativeDayTime(draft.toISOString())}
              </Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: c.ghost }]}
                onPress={() => step(1)}
                accessibilityLabel={`${stepMin} minutes later`}
              >
                <PlusIcon color={c.text} />
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => run(() => onSave(draft.toISOString()))}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={K.brown} />
              ) : (
                <Text style={styles.primaryBtnText}>{saveLabel}</Text>
              )}
            </TouchableOpacity>
            {secondary ? (
              <TouchableOpacity
                style={[styles.ghostBtn, { backgroundColor: c.ghost }]}
                onPress={() => run(secondary.onPress)}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text style={[styles.ghostBtnText, { color: c.text }]}>{secondary.label}</Text>
              </TouchableOpacity>
            ) : null}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  scrim: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  handleRow: { alignItems: "center", marginBottom: 8 },
  handle: { width: 36, height: 5, borderRadius: 100, opacity: 0.2 },
  closeBtn: { position: "absolute", top: 8, right: 12, padding: 12, zIndex: 10 },
  content: { paddingTop: 16, gap: 16 },
  titleBlock: { gap: 8, paddingRight: 32 },
  title: { fontFamily: fonts.catalogue, fontSize: 28, lineHeight: 32, letterSpacing: -0.28 },
  subtitle: { fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 19, letterSpacing: -0.14 },
  stepperCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepperBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  value: { flex: 1, textAlign: "center", fontFamily: fonts.quadrant, fontSize: 22, letterSpacing: -0.22 },
  error: { fontFamily: fonts.catalogue, fontSize: 14, color: K.err },
  primaryBtn: { minHeight: 56, borderRadius: 4, backgroundColor: K.blue, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: K.brown },
  ghostBtn: { minHeight: 48, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 16 },
});

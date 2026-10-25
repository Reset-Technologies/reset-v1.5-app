import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { K } from "../constants/colors";
import { fonts } from "../constants/typography";

export type ReasonOption = {
  reason: string;
  label: string;
};

type Props = {
  visible: boolean;
  /** Ours — the question. */
  title: string;
  /** The meal this is about, so the drawer is never ambiguous. */
  subtitle?: string;
  /** 🔴 Server-owned. `label` is the only string rendered; never `meaning`. */
  options: ReasonOption[];
  onPick: (reason: string) => void;
  onDismiss: () => void;
  /** Blocks double-taps while a pick is in flight. */
  busy?: boolean;
  /**
   * Renders an explicit opt-out row. PREFERENCE r6 calls the drawer
   * *"Optional"* and LEARNING SIGNALS r23 says *"Skip allowed"*, and a
   * backdrop tap is not a visible affordance — a member who does not want to
   * answer should be able to see that they don't have to.
   */
  skipLabel?: string;
};

/**
 * One drawer, one tap — the reason sheet, shared by both surfaces that ask.
 *
 * ## Why this is a component and not a copy
 * P0 #11 built this inline in `MyPlanScreen` for the rejection drawer. P0 #9
 * needs the same sheet for thumbs-down. The two ask different questions from
 * different lists, but the thing on screen is identical, and two copies of a
 * sheet drift: the server already holds ONE wording table for exactly this
 * reason (`REASON_LABELS`), so the client holding two sheets would undo half of
 * that.
 *
 * ## The rules this encodes, not decoration
 * 🔴 **One drawer, one tap, then stop.** LEARNING SIGNALS r23 — *"ask at most
 * one reason and stop"*, *"No questionnaire"*. So: no confirm step, no second
 * question, no multi-select. Picking closes it.
 *
 * 🔴 **`label` only.** `meaning` is internal shorthand — "Prep friction",
 * "Household mismatch" — and the server sends both. Rendering the wrong field
 * would put engineering vocabulary in front of a member.
 *
 * 🔴 **The CODE goes to the server and nothing else.** Whether a reason can
 * become Reset Score Fit evidence is decided server-side from the reason table.
 * Deciding it here would put Score interpretation in the client.
 *
 * 📌 An empty `options` list renders the empty line rather than an empty sheet,
 * and the caller is expected not to open it at all — a drawer with nothing in
 * it is worse than no drawer.
 */
export default function ReasonDrawer({
  visible,
  title,
  subtitle,
  options,
  onPick,
  onDismiss,
  busy,
  skipLabel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <ScrollView style={styles.list}>
          {options.map((o) => (
            <Pressable
              key={o.reason}
              style={styles.row}
              disabled={busy}
              onPress={() => onPick(o.reason)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
            >
              {/* 🔴 `label`, never `meaning`. */}
              <Text style={[styles.rowText, busy && styles.rowTextDisabled]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
          {!options.length && (
            <Text style={styles.sub}>Reasons could not be loaded.</Text>
          )}
          {skipLabel ? (
            <Pressable
              style={styles.row}
              disabled={busy}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={skipLabel}
            >
              <Text style={styles.rowTextQuiet}>{skipLabel}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Lifted verbatim from `MyPlanScreen`'s `move*` styles, which is what the
 * shipped rejection drawer renders. Keeping the values identical is the point:
 * this component replaces that markup, and a "tidier" sheet here would be a
 * silent redesign of a screen that already shipped.
 */
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: K.brown,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 18,
    paddingBottom: 34,
    paddingHorizontal: 18,
  },
  title: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.cream,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: K.bone,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 10,
  },
  list: { maxHeight: 320 },
  row: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(243,239,227,0.14)",
  },
  rowText: { fontFamily: fonts.catalogue, fontSize: 16, color: K.cream },
  rowTextQuiet: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: "rgba(243,239,227,0.6)",
  },
  rowTextDisabled: { color: K.bone },
});

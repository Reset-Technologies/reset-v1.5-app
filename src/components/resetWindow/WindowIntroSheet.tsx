import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import type { WindowState } from "../../services/resetWindow";
import { logEvent } from "../../services/braze";
import { CloseIcon } from "./icons";
import { WindowRecPanel } from "./WindowRecPanel";

const ESTER_MARK = require("../../../assets/images/ester-avatar.png");

interface Props {
  visible: boolean;
  recommendation: WindowState["recommendation"];
  /** Which step-2 button was pressed — both open the picker. */
  onChoose: (button: "choose_this" | "custom_window") => void;
  /** The step the member left from, so drop-off shows per step. */
  onDismiss: (step: 1 | 2) => void;
}

/**
 * The one-time, FULL-SCREEN Reset Window introduction for members who already
 * onboarded — two steps, both from the "Setting Window / New feature" section:
 *
 *   1. "Introducing: Reset Window"  (Figma 4315:52647)
 *   2. "Set your window"            (Figma 4315:52890)
 *
 * The handoff STATE_MACHINE reserves this for them: "New users reach
 * [UNASSIGNED] after paid unlock. Existing users see the full-screen Window
 * intro once." New members meet the feature during onboarding instead, and
 * PaywallScreen consumes this gate on their behalf.
 *
 * TODO(design): step 1 opens with a 331x362 media block that is an empty grey
 * placeholder in the frame. The space is reserved here so the artwork drops
 * straight in, but until Lang delivers it the screen carries a blank panel.
 *
 * ⚠️ Both step-2 buttons open the picker. Lang's "Choose this" implies a
 * one-tap accept, but the handoff requires the member to choose a start time
 * and see BOTH clock times before confirming (STARTING_WINDOW → Schedule
 * placement), and her frame specifies no default start time.
 */
export function WindowIntroSheet({ visible, recommendation, onChoose, onDismiss }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // Reset on CLOSE, not on open: resetting on open would briefly render the
  // old step on a second showing and log a stray step-2 view before snapping
  // back to step 1.
  useEffect(() => {
    if (!visible) setStep(1);
  }, [visible]);

  // Funnel: window_intro_viewed {step:1} → {step:2} → window_intro_chooseCTA.
  // Drop-off per step comes from window_intro_dismissed {step}.
  useEffect(() => {
    if (visible) logEvent("window_intro_viewed", { step });
  }, [visible, step]);

  const durationMin = recommendation?.durationMin ?? 840;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => onDismiss(step)}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => onDismiss(step)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <CloseIcon color={K.brown} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <>
              {/* Reserved for Lang's artwork (frame 4315:52650). */}
              <View style={styles.media} />
              <View style={styles.titleBlock}>
                <Text style={styles.eyebrow}>Introducing:</Text>
                <Text style={styles.title}>Reset Window</Text>
              </View>
              <Text style={styles.para}>
                Your body has an optimal time to nourish itself. This is your eating window.
              </Text>
              <Text style={styles.para}>
                Plan your intake around this window, and follow it with a Reset—a fasting
                period that burns fat without you having to do anything.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Set your window</Text>

              <View style={styles.esterBlock}>
                <View style={styles.eyebrowRow}>
                  <View style={styles.dot} />
                  <Text style={styles.eyebrow}>Message from Ester</Text>
                </View>
                <View style={styles.bubble}>
                  <Image source={ESTER_MARK} style={styles.mark} resizeMode="contain" />
                  <View style={styles.bubbleText}>
                    <Text style={styles.bubbleCopy}>
                      Here's my recommendation, based on what I've learned about you.
                    </Text>
                  </View>
                </View>
              </View>

              {recommendation ? (
                <WindowRecPanel
                  durationMin={durationMin}
                  background={K.bone}
                  tagBackground="rgba(54,20,22,0.12)"
                />
              ) : (
                <ActivityIndicator color={K.brown} style={styles.loading} />
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={step === 1 ? () => setStep(2) : () => onChoose("choose_this")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {step === 1 ? "Yes, set my window!" : "Choose this"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={step === 1 ? () => onDismiss(1) : () => onChoose("custom_window")}
          >
            <Text style={styles.secondaryBtnText}>
              {step === 1 ? "Not right now" : "Custom window"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: K.white },
  topBar: {
    alignItems: "flex-end",
    height: 40,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  content: { paddingHorizontal: 39, paddingBottom: spacing.lg, gap: spacing.md },
  media: {
    height: 362,
    borderRadius: 8,
    backgroundColor: K.bone,
    marginHorizontal: -3,
  },
  titleBlock: { gap: 2 },
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12, color: "#000" },
  title: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    letterSpacing: -0.32,
    color: "#000",
  },
  para: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#000",
  },
  esterBlock: { gap: 6 },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  dot: { width: 6.781, height: 6.781, borderRadius: 3.4, backgroundColor: K.blue },
  bubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    backgroundColor: K.brown,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 10,
    paddingBottom: spacing.md,
    paddingLeft: 12,
    paddingRight: spacing.md,
    overflow: "hidden",
  },
  // ester-avatar.png carries ~12.6% transparent padding, so draw it larger and
  // pull the box back to leave a true 44px mark (see FastingInfoSheet).
  mark: { width: 59, height: 59, marginLeft: -7, marginTop: -7, marginBottom: -7 },
  bubbleText: { flex: 1, justifyContent: "center", paddingLeft: 4, paddingTop: 2 },
  bubbleCopy: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.bone,
  },
  loading: { marginVertical: spacing.xl },
  footer: {
    paddingHorizontal: 37,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  primaryBtn: {
    minHeight: 44,
    backgroundColor: K.brown,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  primaryBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: K.white },
  secondaryBtn: {
    minHeight: 32,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  secondaryBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: K.brown },
});

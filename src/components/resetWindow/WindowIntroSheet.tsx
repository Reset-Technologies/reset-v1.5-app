import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import type { WindowState } from "../../services/resetWindow";
import { COPY, windowLabel } from "../../utils/resetWindow";
import { ArrowIcon, CloseIcon } from "./icons";
import { windowColors } from "./palette";

interface Props {
  visible: boolean;
  // Ester's starting duration for this member's Type — 14:10 for everyone
  // except a Rebounder, who starts on the 12:12 on-ramp.
  recommendation: WindowState["recommendation"];
  onChoose: () => void;
  onDismiss: () => void;
}

const POINTS = [
  "It runs itself — nothing to start or stop each night.",
  "Eating earlier or later? One tap tells Ester, and tonight adjusts.",
  "Every morning you'll see what you earned overnight.",
];

/**
 * The one-time introduction to Reset Window: what it is, what Ester suggests
 * for this member, and a way into the picker. New members meet it right after
 * the paywall; existing members see it once. Dismissing leaves the Today card's
 * "Set Window" button as the way in, so nothing is lost by skipping.
 */
export function WindowIntroSheet({ visible, recommendation, onChoose, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { evening } = useAppPalette();
  const c = windowColors(evening);
  const label = recommendation ? windowLabel(recommendation.durationMin) : "14:10";

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: c.text }]} />
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.titleBlock}>
              <Text style={[styles.eyebrow, { color: c.textAlt }]}>New</Text>
              <Text style={[styles.title, { color: c.text }]}>Meet your Reset Window</Text>
              <Text style={[styles.body, { color: c.text }]}>
                Your eating window has an end as well as a beginning. When it closes, your Reset
                starts — the overnight stretch where your body gets to catch up.
              </Text>
            </View>

            <View style={[styles.card, { borderColor: c.divider }]}>
              <Text style={[styles.cardEyebrow, { color: c.textAlt }]}>Ester suggests</Text>
              <Text style={[styles.cardLabel, { color: c.text }]}>{label}</Text>
              <Text style={[styles.body, { color: c.text }]}>
                {recommendation ? COPY[recommendation.copyId] : COPY.W_START_14}
              </Text>
            </View>

            <View style={styles.points}>
              {POINTS.map((point) => (
                <View key={point} style={styles.point}>
                  <View style={[styles.dot, { backgroundColor: K.blue }]} />
                  <Text style={[styles.pointText, { color: c.text }]}>{point}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.footnote, { color: c.textAlt }]}>
              You can change this any time in settings.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onChoose} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Choose my Window</Text>
              <ArrowIcon color={K.brown} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDismiss} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: c.textAlt }]}>Not now</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
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
  scroll: { flexShrink: 1 },
  content: { paddingTop: 16, paddingBottom: 8, gap: 20 },
  titleBlock: { gap: 8, paddingRight: 32 },
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  title: { fontFamily: fonts.catalogue, fontSize: 32, lineHeight: 36, letterSpacing: -0.32 },
  body: { fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 20, letterSpacing: -0.14 },
  card: {
    borderWidth: 1,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    padding: 16,
    gap: 8,
  },
  cardEyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  cardLabel: { fontFamily: fonts.quadrant, fontSize: 32, letterSpacing: -0.32 },
  points: { gap: 12 },
  point: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  pointText: { flex: 1, fontFamily: fonts.catalogue, fontSize: 14, lineHeight: 20, letterSpacing: -0.14 },
  footnote: { fontFamily: fonts.catalogue, fontSize: 13, letterSpacing: -0.13 },
  footer: { gap: 8, paddingTop: 16, alignItems: "center" },
  primaryBtn: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
    borderRadius: 4,
    backgroundColor: K.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: K.brown },
  skipBtn: { minHeight: 32, justifyContent: "center", paddingHorizontal: 12 },
  skipText: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
});

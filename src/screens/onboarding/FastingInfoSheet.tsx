import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { K } from "../../constants/colors";
import { useAppPalette } from "../../hooks/useAppPalette";
import { fonts, spacing } from "../../constants/typography";
import { CloseIcon } from "../../components/resetWindow/icons";

const ESTER_MARK = require("../../../assets/images/ester-avatar.png");

interface Props {
  visible: boolean;
  onClose: () => void;
  /** "Start a chat" — only offered where Ester is actually reachable. */
  onStartChat?: () => void;
}

/**
 * "What is intermittent fasting? A beginner's guide" — the sheet behind
 * "Tell me more…" in the onboarding survey (Figma 4328:13197 / 4328:13202).
 *
 * Type ramp is taken from the frame, where the token names run opposite to the
 * intuition: "Style/Serif" is Quadrant Text (fonts.quadrant) and
 * "Style/Sans serif" is Catalogue (fonts.catalogue).
 *   eyebrow   Quadrant 12 / -0.12 / text-strong
 *   title     Catalogue 40 / -0.4  / text-strong
 *   subtitle  Catalogue 20 / -0.2  / text-alt
 *   body      Catalogue 16 / -0.16 / text-alt, bold runs in text-strong
 *
 * The Ester card has no fill of its own — it sits on the sheet colour with a
 * 0.5px divider border and one square corner (top-left 4px, the rest 24px).
 *
 * No "Start a chat" CTA in onboarding: StatDetailSheet carries `hideChat` for
 * exactly this reason — "Ester chat isn't reachable from the [onboarding]
 * stack". The button below is styled to the frame for wherever it is offered.
 *
 * 🔴 The "hours 10-14" copy is Lang's, written when the start was 12:8. Bryan
 * is rewriting the onboarding copy — expect it to change.
 */
export function FastingInfoSheet({ visible, onClose, onStartChat }: Props) {
  const insets = useSafeAreaInsets();
  const { evening } = useAppPalette();
  // Same two surfaces StatDetailSheet uses, so the pair reads as one family.
  const sheetBg = evening ? "#2A0E10" : K.bone;
  const textStrong = evening ? K.bone : K.brown;
  const textAlt = evening ? "rgba(243,239,227,0.7)" : "#7E6869";
  const hairline = evening ? "rgba(243,239,227,0.18)" : "#C3B9BA";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: hairline }]} />
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <CloseIcon color={textStrong} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.titleBlock}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.dot, { backgroundColor: K.blue }]} />
                <Text style={[styles.eyebrow, { color: textStrong }]}>Fasting Stages</Text>
              </View>
              <Text style={[styles.title, { color: textStrong }]}>
                What is intermittent fasting?
              </Text>
              <Text style={[styles.subtitle, { color: textAlt }]}>A beginner's guide</Text>
            </View>

            <View style={styles.esterBlock}>
              <View style={styles.esterMessage}>
                <View style={styles.eyebrowRow}>
                  <View style={[styles.dot, { backgroundColor: K.blue }]} />
                  <Text style={[styles.eyebrow, { color: textStrong }]}>
                    What this means for you
                  </Text>
                </View>

                {/* No fill — the card shows the sheet colour through it. */}
                <View style={[styles.esterCard, { borderColor: hairline }]}>
                  <Image source={ESTER_MARK} style={styles.esterMark} resizeMode="contain" />
                  <View style={styles.messageWrap}>
                    <Text style={[styles.esterText, { color: textAlt }]}>
                      The{" "}
                      <Text style={[styles.bold, { color: textStrong }]}>
                        third and most important
                      </Text>{" "}
                      stage of the fasting cycle, occurring between{" "}
                      <Text style={[styles.bold, { color: textStrong }]}>hours 10-14.</Text>{" "}
                      This is when the fast actually starts to do its work!
                    </Text>
                  </View>
                </View>
              </View>

              {onStartChat ? (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={onStartChat}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chatBtnText}>Start a chat</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  scrim: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: "82%",
  },
  handleRow: { alignItems: "center", paddingBottom: spacing.sm },
  handle: { width: 44, height: 4, borderRadius: 2 },
  closeBtn: { position: "absolute", top: spacing.md, right: spacing.lg, zIndex: 2 },
  // Content Column: 32px between the title block and the Ester block.
  content: { paddingBottom: spacing.lg, gap: spacing.xl, paddingTop: spacing.md },
  titleBlock: { gap: spacing.sm },
  // Frame 4328:13219 is items-end, but the message group is w-full so its
  // eyebrow and card stay left — only "Start a chat" sits right.
  esterBlock: { gap: 12, alignItems: "flex-end" },
  esterMessage: { width: "100%", alignItems: "flex-start", gap: 6 },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  dot: { width: 6.781, height: 6.781, borderRadius: 3.4 },
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  title: { fontFamily: fonts.catalogue, fontSize: 40, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2 },
  esterCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    borderWidth: 0.5,
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
  messageWrap: { flex: 1, justifyContent: "center", paddingLeft: 4, paddingTop: 2 },
  esterText: { fontFamily: fonts.catalogue, fontSize: 16, letterSpacing: -0.16 },
  bold: { fontFamily: fonts.catalogueBold },
  // ester-avatar.png carries ~12.6% transparent padding on every side (glyph is
  // 588x579 on a 785x786 canvas), so a 44px box renders a ~33px mark. Draw it
  // at 59 and pull the box back by the padding, leaving a 44px visible mark
  // aligned exactly where the frame's 44px slot sits.
  esterMark: {
    width: 59,
    height: 59,
    marginLeft: -7,
    marginTop: -7,
    marginBottom: -7,
  },
  chatBtn: {
    alignSelf: "flex-end",
    minHeight: 32,
    minWidth: 32,
    backgroundColor: K.blue,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: K.brown },
});

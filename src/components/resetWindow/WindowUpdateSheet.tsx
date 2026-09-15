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
import { markRecommendationSeen, type WeeklyUpdate } from "../../services/resetWindow";
import { weeklyUpdateCopy } from "../../utils/resetWindow";
import { CloseIcon } from "./icons";
import { windowColors } from "./palette";

interface Props {
  update: WeeklyUpdate | null;
  onAccept: (id: string) => Promise<unknown>;
  onDecline: (id: string) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Ester's weekly Window decision (handoff WEEKLY DECISION). An offer — longer,
 * shorter, a new start time — waits for the member to accept or keep what they
 * have; a note ("I'm keeping your Window at 14:10 this week") is read once.
 *
 * PLACEHOLDER UI: no Lang design yet. The copy and buttons are canon.
 */
export function WindowUpdateSheet({ update, onAccept, onDecline, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { evening } = useAppPalette();
  const c = windowColors(evening);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seen on screen, not on a button: a dismissed note must not come back, and
  // an offer stays open until the member decides or it expires.
  useEffect(() => {
    if (!update) return;
    setBusy(null);
    setError(null);
    markRecommendationSeen(update.id).catch(() => {});
  }, [update?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!update) return null;
  const copy = weeklyUpdateCopy(update);

  const act = async (kind: "accept" | "decline") => {
    logEvent(kind === "accept" ? "window_update_acceptCTA" : "window_update_declineCTA", {
      action: update.action,
      reason: update.reasonCode,
    });
    if (!update.needsDecision) {
      onClose();
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      await (kind === "accept" ? onAccept(update.id) : onDecline(update.id));
      onClose();
    } catch (err: any) {
      setError(err?.message || "Couldn’t reach Reset. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: c.text }]} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.eyebrow, { color: c.textAlt }]}>Your Window this week</Text>
            <Text style={[styles.line, { color: c.text }]}>{copy.line}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => act("accept")}
                disabled={!!busy}
                activeOpacity={0.85}
              >
                {busy === "accept" ? (
                  <ActivityIndicator color={K.brown} />
                ) : (
                  <Text style={styles.primaryBtnText}>{copy.accept}</Text>
                )}
              </TouchableOpacity>
              {copy.decline ? (
                <TouchableOpacity
                  style={[styles.ghostBtn, { backgroundColor: c.ghost }]}
                  onPress={() => act("decline")}
                  disabled={!!busy}
                  activeOpacity={0.85}
                >
                  {busy === "decline" ? (
                    <ActivityIndicator color={c.text} />
                  ) : (
                    <Text style={[styles.ghostBtnText, { color: c.text }]}>{copy.decline}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
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
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 14, letterSpacing: -0.14 },
  line: { fontFamily: fonts.catalogue, fontSize: 24, lineHeight: 30, letterSpacing: -0.24, paddingRight: 24 },
  error: { fontFamily: fonts.catalogue, fontSize: 14, color: K.err },
  buttons: { gap: 8, marginTop: 8 },
  primaryBtn: { minHeight: 56, borderRadius: 4, backgroundColor: K.blue, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontFamily: fonts.catalogue, fontSize: 20, letterSpacing: -0.2, color: K.brown },
  ghostBtn: { minHeight: 48, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { fontFamily: fonts.catalogueMedium, fontSize: 16 },
});

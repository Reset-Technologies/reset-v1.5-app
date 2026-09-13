import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { K } from "../../constants/colors";
import { useApp } from "../../context/AppContext";
import { fonts, spacing } from "../../constants/typography";
import { getResetWindow, type WindowState } from "../../services/resetWindow";
import { WindowRecPanel } from "../../components/resetWindow/WindowRecPanel";

interface Props {
  width: number;
  height: number;
  /** The member's type mark — passed in, so this isn't a 4th TYPE_LOGO map. */
  typeLogo: ImageSourcePropType;
}

/** Blue-alt surface the recommendation panel sits on (Figma 4329:53584). */
const PANEL_BG = "#E9F0F2";
const GHOST = "rgba(54,20,22,0.12)";

/**
 * "Based on your scan results, here's the fasting pattern I recommend for you."
 * — the Reset Window card in the first-reset-score stack (Figma 4329:53370).
 *
 * Informational by design: it says what Ester suggests and where to change it.
 * There is no picker here — onboarding never asks them to commit (handoff
 * STATE_MACHINE: "New users reach [UNASSIGNED] after paid unlock").
 *
 * 🔑 Bryan, 12 Sep — someone who answered "Maybe later" still sees this, but it
 * must read as "here's what I'd recommend when you're ready", not as having
 * been opted in. Hence the softened lede.
 *
 * 🔴 Lang's frame shows 12:8 with the rows "Good for beginners / Aligns with
 * sleep schedules / No deep reset ✗". Bryan retired 12:8, and that ✗ row was an
 * argument AGAINST it, so it cannot survive the change. The duration comes from
 * the server (14:10, or 12:12 on a Rebounder's on-ramp); ROWS above are MY
 * DRAFT and need Bryan's copy. `pro: false` keeps the ✗ treatment available.
 */
export function WindowRecCard({ width, height, typeLogo }: Props) {
  const { state: app } = useApp();
  const [state, setState] = useState<WindowState | null>(null);
  const [failed, setFailed] = useState(false);

  // "Maybe later" on the interest question — acknowledge it in the framing.
  const deferred = app.user.quizAnswers?.fastingInterest === "maybe_later";

  useEffect(() => {
    let alive = true;
    getResetWindow()
      .then((s) => alive && setState(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const durationMin = state?.recommendation?.durationMin ?? 840;

  return (
    <View style={[styles.card, { width, height }]}>
      <Image source={typeLogo} style={styles.mark} resizeMode="contain" />

      <Text style={styles.lede}>
        {deferred
          ? "No rush. When you're ready to try it, here's the pattern I'd start you on."
          : "Based on your scan results, here's the fasting pattern I recommend for you."}
      </Text>

      {!state && !failed ? (
        <ActivityIndicator style={styles.loading} color={K.brown} />
      ) : (
        <WindowRecPanel
          durationMin={durationMin}
          background={PANEL_BG}
          tagBackground={GHOST}
        />
      )}

      <Text style={styles.footnote}>
        {deferred
          ? "Nothing is set up yet — you can start whenever you want, from settings."
          : "You can change this in settings."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Chrome copied from TypeRevealScreen's shared `card` style (Figma
  // 1916-17871 "Bubble"). Without the shadow this card draws no edge, and the
  // stack's peeking slivers show a doubled gap where it sits.
  card: {
    backgroundColor: K.white, // == CARD_BG_FRONT in TypeRevealScreen
    borderRadius: 48,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.lg,
    boxShadow:
      "0 0 1px 0 rgba(0,0,0,0.07) inset, 0 2px 6px -1px rgba(34,10,10,0.38), 0 -9px 4px -8px rgba(54,20,22,0.44) inset, 0 -5px 10px -3px rgba(54,20,22,0.38) inset",
    elevation: 6,
  },
  mark: { width: 56, height: 56 },
  lede: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.brown,
  },
  loading: { marginVertical: spacing.xl },
  footnote: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
  },
});

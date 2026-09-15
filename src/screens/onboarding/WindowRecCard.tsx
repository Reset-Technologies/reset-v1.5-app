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

/**
 * The card is a FIXED height (the stack sizes it from the safe area), so its
 * density follows that height rather than the screen — each phone gets the most
 * generous layout its card can actually hold. Measured 13 Sep on the simulator:
 *   - iPhone SE card ~577pt  → compact  (gap 20, rows 4pt, text 14) ~38pt spare for a Rebounder
 *   - 620–649pt              → regular  (gap 24, rows 6pt, text 14) — content 496pt standard
 *   - iPhone 16 Pro 658pt+   → large    (gap 24, rows 9pt, text 15) ~50pt spare for a Rebounder
 * "large" starts at 650, not 620: at a 620pt card a Rebounder in the large
 * layout would have only ~11pt spare.
 */
const COMPACT_BELOW = 620;
const LARGE_FROM = 650;
const GHOST = "rgba(54,20,22,0.12)";

/**
 * The Reset Window card in the first-reset-score stack (Figma 4329:53370).
 *
 * Informational by design: it says where Ester would start and where to change
 * it. There is no picker here — onboarding never asks anyone to commit (handoff
 * STATE_MACHINE: "New users reach [UNASSIGNED] after paid unlock").
 *
 * Copy is Bryan's (13 Sep): the lede, the ratio + descriptor + label (in
 * WindowRecPanel, which switches to the 12:12 on-ramp for a Rebounder), and
 * "You can change this anytime." (Bryan, 14 Sep — was "in Settings")
 *
 * 🔑 "Maybe later" (Bryan, 12 Sep) must read as "here's what I'd recommend when
 * you're ready", not as having been opted in. His 13 Sep copy has no variant
 * for that answer, so the softened lede below reuses his wording.
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
  const density = height < COMPACT_BELOW ? "compact" : height >= LARGE_FROM ? "large" : "regular";

  return (
    <View style={[styles.card, { width, height, gap: density === "compact" ? 20 : spacing.lg }]}>
      <Image source={typeLogo} style={styles.mark} resizeMode="contain" />

      <Text style={styles.lede}>
        {deferred
          ? "Whenever you're ready, here's where I'd start."
          : "Based on what I've learned about you, here's where I'd start."}
      </Text>

      {!state && !failed ? (
        <ActivityIndicator style={styles.loading} color={K.brown} />
      ) : (
        <WindowRecPanel
          durationMin={durationMin}
          rebounder={state?.recommendation?.copyId === "W_START_RB"}
          density={density}
          background={PANEL_BG}
          tagBackground={GHOST}
        />
      )}

      <Text style={styles.footnote}>You can change this anytime.</Text>
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
    // `gap` is set inline from the card's height — see COMPACT_BELOW / LARGE_FROM.
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

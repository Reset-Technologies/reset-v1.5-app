import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, spacing } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import {
  getPendingPrompt,
  recordFollowThrough,
  dismissPrompt,
  FollowThroughResponse,
} from "../../services/meals";

/**
 * P0 #10 — the one Meals question per day.
 *
 * 🔑 COPY IS BRYAN'S, from SCORE CONTRACT r5/r6 — one of the few places the
 * Meals workbook writes member-facing strings, because these are part of the
 * Score contract rather than ordinary UI text. The question is r5 verbatim and
 * the three answers are r6 verbatim. Do not reword them: Score maps the stored
 * values 1.0 / 0.5 / 0.0, and the labels are what the member is agreeing to.
 *
 * 📌 Placement is SANCTIONED, not a guess. Bryan, 2026-10-16, asked directly
 * whether a new Home design existed: "there's a new direction for Home, but no
 * locked Home design for this build. I think Lang is still working through the
 * broader Today concept and how Home should change based on what matters to
 * the member at that moment. For now, keep the current Home/navigation."
 * ⇒ build against the Home we have; do NOT wait on Lang, and do NOT redesign
 * around this card. The same answer covers any later Meals surface that needs
 * a Home slot, until that dated decision is superseded.
 *
 * It sits in the existing card stack beside CheckInCard, at its size and
 * shape, because START HERE r10 scopes the budget to "one prompted Meals
 * question per day ACROSS the system" — so the question is not bound to the
 * Meals tab — and because it asks about the whole day rather than the plan
 * screen. The workbook names the timing (r5's "natural evening transition")
 * but never a surface, which is why the question had to be asked at all.
 */

/** r6 verbatim, in r6's order. The wire values are Score's, not display text. */
const ANSWERS: ReadonlyArray<{ value: FollowThroughResponse; label: string }> = [
  { value: "on_plan", label: "On plan" },
  { value: "mostly", label: "Mostly" },
  { value: "not_really", label: "Not really" },
];

export function FollowThroughCard() {
  const { nestedBg, subtleText } = useAppPalette();
  const [promptId, setPromptId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPendingPrompt()
      .then((p) => {
        if (cancelled) return;
        // 🔑 The server decides. `ask` is false when the day's budget is spent
        // or nothing is eligible, and asking anyway would stack a second
        // question on a day that already had one (TEST CASES M24).
        setVisible(p.ask === true);
        setPromptId(p.promptId ?? null);
      })
      // A card that cannot load is a card that does not appear. It must never
      // block or blank the rest of Today.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const answer = useCallback(
    async (response: FollowThroughResponse) => {
      if (busy) return;
      setBusy(true);
      // Optimistic: the card goes as soon as it is tapped. The answer is the
      // member's, and showing it again while a request settles would read as
      // the tap not landing.
      setVisible(false);
      try {
        await recordFollowThrough(response, promptId ?? undefined);
      } catch {
        // Put it back rather than silently swallowing the day's evidence.
        setVisible(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, promptId],
  );

  /**
   * 🔴 Dismiss writes NO sample.
   *
   * LEARNING SIGNALS r24 is a hard rule — "no response creates missing
   * evidence only. Never create dislike, rejection, or low FT from silence" —
   * and TEST CASES M23 spells out the case: prompt shown, no answer, "no
   * sample; no penalty". So this closes the prompt so the member is not asked
   * twice today, and deliberately records nothing. A "Not really" is an
   * ANSWER; a dismissal is not a quiet version of one.
   */
  const dismiss = useCallback(async () => {
    setVisible(false);
    if (!promptId) return;
    try {
      await dismissPrompt(promptId);
    } catch {
      // Losing the dismissal only risks asking again; it cannot create
      // evidence, so there is nothing to repair.
    }
  }, [promptId]);

  if (!visible) return null;

  return (
    <View style={[styles.card, { backgroundColor: nestedBg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: subtleText }]}>Today's Meals</Text>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 6l12 12M18 6L6 18"
              stroke={subtleText}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* SCORE CONTRACT r5, verbatim. */}
      <Text style={[styles.prompt, { color: subtleText }]}>
        How close did today stay to your Reset meals?
      </Text>

      <View style={styles.answers}>
        {ANSWERS.map((a) => (
          <TouchableOpacity
            key={a.value}
            style={[styles.answer, { borderColor: subtleText }]}
            onPress={() => answer(a.value)}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Text style={[styles.answerText, { color: subtleText }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches CheckInCard: same margins, padding and radius, so this reads as
  // another card in Today rather than a new kind of object.
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 4,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  /* 🔑 Deliberately smaller than CheckInCard's 32pt prompt. That card asks an
     open question and the type carries it; this one is a question plus three
     choices, and at 32pt the answers fall below the fold on a short screen. */
  prompt: {
    fontFamily: fonts.catalogue,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
  },
  answers: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  /* Three equal pills. `flex: 1` rather than fixed widths so "Not really" —
     the longest label — sets the height on a narrow screen without the row
     wrapping. The S24 is 360dp wide; see project_android_submission. */
  answer: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  answerText: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    letterSpacing: -0.14,
  },
});

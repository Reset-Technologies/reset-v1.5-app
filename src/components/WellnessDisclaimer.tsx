import React from "react";
import { Text, StyleSheet, StyleProp, TextStyle } from "react-native";
import { K } from "../constants/colors";

/**
 * App Store Guideline 1.4.1 (Safety — Physical Harm).
 *
 * Apple rejected 3.0.0 twice on the same binary. The first review cited
 * "medical related data, health related measurements, diagnoses or treatment
 * advice"; the second narrowed it to "the app provides score based on health
 * measurements without the appropriate regulatory clearance."
 *
 * We cannot answer the literal ask — Shen.AI's CE marking is still in
 * conformity assessment and FDA 510(k) is years out, so there is no clearance
 * to attach, and claiming otherwise would be worse than a rejection. The
 * position is instead that Reset is a general-wellness product: it reports
 * pulse, HRV and breathing rate as wellness signals and combines them with
 * self-reported check-ins into a lifestyle score — the same category as the
 * readiness and recovery scores that ship on the App Store today.
 *
 * That position has to be visible in the product, not only in the App Store
 * description. Before this component the app carried no medical disclaimer
 * anywhere: a reviewer opened it, watched a face scan read their pulse, and
 * got a numeric score with no wellness framing on screen at all.
 *
 * ⚠️ Keep this on the scan experience and on every surface that presents the
 * score. Removing it re-opens the rejection.
 *
 * 🔑 Wording is Bryan's (2026-08-09) and is deliberate: it states intended use
 * ("general wellness information", "not intended to diagnose or treat") rather
 * than asserting the regulatory classification "not a medical device", which
 * is a determination we have not formally made. "Not intended to diagnose or
 * treat" is the phrase that carries the general-wellness argument with Apple,
 * so it must survive any future edit. Change this copy only with Bryan.
 */
export const WELLNESS_DISCLAIMER =
  "Reset provides general wellness information and is not intended to " +
  "diagnose or treat any medical condition. Do not use Reset to make medical " +
  "decisions. Talk with a healthcare professional before making decisions " +
  "about your health.";

interface Props {
  /** Pass the surface's muted text colour so it reads as fine print. */
  color?: string;
  align?: "center" | "left";
  style?: StyleProp<TextStyle>;
}

export function WellnessDisclaimer({
  color = K.textMuted,
  align = "center",
  style,
}: Props) {
  return (
    <Text
      style={[styles.text, { color, textAlign: align }, style]}
      // Read out by VoiceOver as ordinary text; it is informational, not a
      // control, so it deliberately has no role or action.
      accessible
    >
      {WELLNESS_DISCLAIMER}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 11,
    lineHeight: 16,
  },
});

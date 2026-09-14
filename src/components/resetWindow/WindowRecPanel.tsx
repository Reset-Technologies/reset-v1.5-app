import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { REBOUNDER_ONRAMP, WINDOW_PRESETS, windowLabel } from "../../utils/resetWindow";

const TABLE_LINE = "#C5C5C5";

/** "14-hour Reset · 10-hour eating window" — Bryan's descriptor, 13 Sep. */
function describe(durationMin: number): string {
  const fastH = Math.round(durationMin / 60);
  return `${fastH}-hour Reset · ${24 - fastH}-hour eating window`;
}

interface Props {
  durationMin: number;
  /** A Rebounder on the two-week 12:12 on-ramp (recommendation copyId W_START_RB). */
  rebounder?: boolean;
  /** Surface behind the panel — differs per frame (see call sites). */
  background: string;
  tagBackground: string;
}

/**
 * The recommendation panel: label, the big ratio, its descriptor, and the
 * comparison table of every Window the member can choose.
 *
 * Copy is Bryan's (13 Sep). He asked for the comparison to stay DESCRIPTIVE —
 * no claims like "good for beginners" or "deep reset" — and for the options to
 * match the picker: 14:10 through 18:6, with 12:12 reserved for a Rebounder's
 * two-week on-ramp. So the rows are generated from the picker's own
 * WINDOW_PRESETS / REBOUNDER_ONRAMP rather than written out, and can never list
 * a Window the picker doesn't offer.
 *
 * Layout: his descriptor is too long to sit beside a large ratio (Lang's frame
 * put two short lines there), so it sits underneath. His label ("Reset's
 * starting point" / "Start here for your first two weeks") takes the tag slot.
 *
 * Shared by the onboarding score card (blue-alt #E9F0F2) and the existing-member
 * intro (K.bone) — identical apart from the surface, so they can't drift.
 */
export function WindowRecPanel({ durationMin, rebounder = false, background, tagBackground }: Props) {
  const label = windowLabel(durationMin);
  // Lang drew the ratio at 80px around a four-character label; the real ones are
  // five characters ("14:10", "12:12"), so step down rather than crowd the panel.
  const labelSize = label.length <= 4 ? 80 : 64;

  const rows = rebounder ? [REBOUNDER_ONRAMP, ...WINDOW_PRESETS] : [...WINDOW_PRESETS];

  return (
    <View style={[styles.panel, { backgroundColor: background }]}>
      <View style={[styles.tag, { backgroundColor: tagBackground }]}>
        <Text style={styles.tagText}>
          {rebounder ? "Start here for your first two weeks" : "Reset's starting point"}
        </Text>
      </View>

      <Text style={[styles.label, { fontSize: labelSize }]}>{label}</Text>
      <Text style={styles.descriptor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {describe(durationMin)}
      </Text>

      <View style={styles.table}>
        {rows.map((row, i) => (
          <View
            key={row.label}
            style={[styles.row, i === 0 && styles.rowFirst, i === rows.length - 1 && styles.rowLast]}
          >
            <View style={styles.ratioCell}>
              <Text style={styles.ratioText}>{row.label}</Text>
            </View>
            <View style={[styles.textCell, i === 0 && styles.textCellFirst]}>
              <Text style={styles.rowText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {describe(row.durationMin)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 40,
    paddingTop: spacing.md,
    paddingBottom: 20,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  tag: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  label: { fontFamily: fonts.quadrant, letterSpacing: -0.8, color: "#000", marginTop: 4 },
  descriptor: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#000",
    marginBottom: spacing.md,
  },
  table: { marginHorizontal: 8 },
  row: { flexDirection: "row", alignItems: "stretch" },
  rowFirst: { borderTopWidth: 0.5, borderTopColor: TABLE_LINE },
  rowLast: { borderBottomWidth: 0.5, borderBottomColor: TABLE_LINE },
  ratioCell: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4, // 4, not 6: keeps a Rebounder's 5 rows inside the fixed-height onboarding card on small phones
    paddingHorizontal: spacing.sm,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: TABLE_LINE,
  },
  ratioText: { fontFamily: fonts.quadrant, fontSize: 14, letterSpacing: -0.14, color: K.brown },
  textCell: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 4, // 4, not 6: keeps a Rebounder's 5 rows inside the fixed-height onboarding card on small phones
    borderRightWidth: 0.5,
    borderColor: TABLE_LINE,
  },
  textCellFirst: { borderTopRightRadius: 24 },
  rowText: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
  },
});

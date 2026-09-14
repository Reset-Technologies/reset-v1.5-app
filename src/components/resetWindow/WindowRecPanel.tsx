import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { REBOUNDER_ONRAMP, WINDOW_PRESETS, windowLabel } from "../../utils/resetWindow";

const TABLE_LINE = "#C5C5C5";
/**
 * Fixed, not a minWidth: the column's right edge IS the divider, so every row
 * must put it at the same x. With minWidth, "14:10" at 15pt outgrew 52pt while
 * "15:9" didn't, and the divider stepped sideways between rows.
 */
const RATIO_COL_WIDTH = 58;

export type RecPanelDensity = "compact" | "regular" | "large";

/** Comparison-table sizing per density — chosen by a fixed-height container. */
const DENSITY: Record<RecPanelDensity, { rowPad: number; rowText: number }> = {
  compact: { rowPad: 4, rowText: 14 },
  regular: { rowPad: 6, rowText: 14 },
  large: { rowPad: 9, rowText: 15 },
};

/** "14-hour Reset · 10-hour eating window" — Bryan's descriptor, 13 Sep. */
function describe(durationMin: number): string {
  const fastH = Math.round(durationMin / 60);
  return `${fastH}-hour Reset · ${24 - fastH}-hour eating window`;
}

interface Props {
  durationMin: number;
  /** A Rebounder on the two-week 12:12 on-ramp (recommendation copyId W_START_RB). */
  rebounder?: boolean;
  /**
   * Table sizing for a fixed-height container — the onboarding card picks it
   * from its own height. The intro scrolls, so it keeps the default.
   */
  density?: RecPanelDensity;
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
export function WindowRecPanel({
  durationMin,
  rebounder = false,
  density = "regular",
  background,
  tagBackground,
}: Props) {
  const label = windowLabel(durationMin);
  // Lang drew the ratio at 80px around a four-character label; the real ones are
  // five characters ("14:10", "12:12"), so step down rather than crowd the panel.
  const labelSize = label.length <= 4 ? 80 : 64;

  const rows = rebounder ? [REBOUNDER_ONRAMP, ...WINDOW_PRESETS] : [...WINDOW_PRESETS];
  const { rowPad, rowText } = DENSITY[density];

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
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={[styles.ratioCell, { paddingVertical: rowPad }]}>
              <Text style={[styles.ratioText, { fontSize: rowText }]}>{row.label}</Text>
            </View>
            <View style={[styles.textCell, { paddingVertical: rowPad }]}>
              <Text
                style={[styles.rowText, { fontSize: rowText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
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
  // The outline is drawn ONCE, here, so the top line and the rounded corner are a
  // single stroke. It used to be split across the rows (top/bottom borders) and
  // the first row's text cell (the radius), and the row's straight top border
  // ran on past where the cell's corner curved down.
  table: {
    marginHorizontal: 8,
    borderWidth: 0.5,
    borderColor: TABLE_LINE,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "stretch" },
  ratioCell: {
    width: RATIO_COL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 0.5,
    borderColor: TABLE_LINE,
  },
  ratioText: { fontFamily: fonts.quadrant, letterSpacing: -0.14, color: K.brown },
  textCell: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 8,
    paddingRight: 12,
  },
  rowText: {
    fontFamily: fonts.catalogue,
    letterSpacing: -0.14,
    color: K.brown,
  },
});

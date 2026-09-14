import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { REBOUNDER_ONRAMP, WINDOW_PRESETS, windowLabel } from "../../utils/resetWindow";

const TABLE_LINE = "#C5C5C5";
/**
 * Fixed, not a minWidth: the column's right edge IS the divider, so every row
 * must put it at the same x. With minWidth + horizontal padding, "14:10" at 15pt
 * outgrew the column while "15:9" didn't, and the divider stepped between rows.
 */
const RATIO_COL_WIDTH = 52;
const CELL_PAD_LEFT = 8;
const CELL_PAD_RIGHT = 12;

export type RecPanelDensity = "compact" | "regular" | "large";

/** Comparison-table sizing per density — chosen by a fixed-height container. */
const DENSITY: Record<RecPanelDensity, { rowPad: number; rowText: number }> = {
  compact: { rowPad: 4, rowText: 14 },
  regular: { rowPad: 6, rowText: 14 },
  large: { rowPad: 9, rowText: 15 },
};

/**
 * The smallest size a one-line row may use. Below it the text is hard to read,
 * so the rows wrap onto two lines instead. An iPhone 16 Pro lands at ~12.8pt —
 * the single line it always showed — while a 360dp-wide Galaxy S24 would need
 * ~10dp and wraps.
 */
const LINE_FLOOR = 12.5;

/**
 * Sizing once rows wrap onto two lines. Kept tight on purpose: on a Galaxy S24
 * (660dp card) a Rebounder's five two-line rows at 4pt padding and the font's
 * default line height overflowed the fixed-height card by ~3dp.
 */
const STACKED = { rowPad: 3, rowText: 14, lineHeight: 17 };

/** Two fixed sizes the longest row is measured at, to solve width = a·size + b. */
const MEASURE_HI = 14;
const MEASURE_LO = 12;

/** Bryan's descriptor (13 Sep), in its two halves. */
function parts(durationMin: number): { reset: string; eating: string } {
  const fastH = Math.round(durationMin / 60);
  return { reset: `${fastH}-hour Reset`, eating: `${24 - fastH}-hour eating window` };
}

function describe(durationMin: number): string {
  const { reset, eating } = parts(durationMin);
  return `${reset} · ${eating}`;
}

function lineWidth(e: { nativeEvent: { lines: { width: number }[] } }): number {
  return Math.max(...e.nativeEvent.lines.map((l) => l.width));
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
  const longest = rows.reduce((a, r) => (describe(r.durationMin).length > describe(a.durationMin).length ? r : a));

  // Row text size is COMPUTED, not left to `adjustsFontSizeToFit`. That prop
  // shrank rows on iOS (to ~85–92%, which read as a normal single line) but
  // `minimumFontScale` is honoured on iOS only, so Android kept going to ~10dp.
  // Computing the size behaves the same on both. The longest row is measured at
  // two sizes by invisible Texts — width is linear in size, plus a constant from
  // letter spacing — which gives the largest size that fits the table's measured
  // width. One line at that size (capped at the density's size) if it's at least
  // LINE_FLOOR; otherwise two lines. The table stays invisible until all three
  // measurements arrive, so nothing flashes cut off.
  const tierText = DENSITY[density].rowText;
  const [tableWidth, setTableWidth] = useState<number | null>(null);
  const [wHi, setWHi] = useState<number | null>(null);
  const [wLo, setWLo] = useState<number | null>(null);
  const measured = tableWidth !== null && wHi !== null && wLo !== null;

  let stacked = false;
  let lineSize = tierText;
  if (measured) {
    const room = (tableWidth as number) - 1 - RATIO_COL_WIDTH - CELL_PAD_LEFT - CELL_PAD_RIGHT;
    const a = ((wHi as number) - (wLo as number)) / (MEASURE_HI - MEASURE_LO);
    const b = (wHi as number) - a * MEASURE_HI;
    const fitSize = a > 0 ? (room - 1 - b) / a : tierText; // 1pt of slack for rounding
    lineSize = Math.min(tierText, Math.floor(fitSize * 10) / 10);
    stacked = lineSize < LINE_FLOOR;
  }
  const rowPad = stacked ? STACKED.rowPad : DENSITY[density].rowPad;
  const ratioSize = stacked ? STACKED.rowText : tierText;

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

      {/* Invisible: the longest row's one-line width at two sizes. */}
      <Text
        style={[styles.rowText, styles.measure, { fontSize: MEASURE_HI }]}
        onTextLayout={(e) => setWHi(lineWidth(e))}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {describe(longest.durationMin)}
      </Text>
      <Text
        style={[styles.rowText, styles.measure, { fontSize: MEASURE_LO }]}
        onTextLayout={(e) => setWLo(lineWidth(e))}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {describe(longest.durationMin)}
      </Text>

      <View
        style={[styles.table, !measured && styles.hidden]}
        onLayout={(e) => setTableWidth(e.nativeEvent.layout.width)}
      >
        {rows.map((row) => {
          const { reset, eating } = parts(row.durationMin);
          return (
            <View key={row.label} style={styles.row}>
              <View style={[styles.ratioCell, { paddingVertical: rowPad }]}>
                <Text style={[styles.ratioText, { fontSize: ratioSize }]}>{row.label}</Text>
              </View>
              <View style={[styles.textCell, { paddingVertical: rowPad }]}>
                {stacked ? (
                  <>
                    <Text style={[styles.rowText, { fontSize: STACKED.rowText, lineHeight: STACKED.lineHeight }]}>
                      {reset}
                    </Text>
                    <Text style={[styles.rowText, { fontSize: STACKED.rowText, lineHeight: STACKED.lineHeight }]}>
                      {eating}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.rowText, { fontSize: lineSize }]} numberOfLines={1}>
                    {describe(row.durationMin)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
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
  measure: { position: "absolute", left: 0, top: 0, width: 2000, opacity: 0 },
  hidden: { opacity: 0 },
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
    paddingLeft: CELL_PAD_LEFT,
    paddingRight: CELL_PAD_RIGHT,
  },
  rowText: {
    fontFamily: fonts.catalogue,
    letterSpacing: -0.14,
    color: K.brown,
  },
});

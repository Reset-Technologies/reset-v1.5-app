import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import { windowLabel } from "../../utils/resetWindow";
import { CheckCircleIcon, CloseIcon } from "./icons";

/** A row of the comparison table: `pro` false draws the ✗ and dims the text. */
export interface RecRow {
  text: string;
  pro: boolean;
}

/**
 * 🔴 DRAFT COPY. Lang's frames say "Good for beginners / Aligns with sleep
 * schedules / No deep reset ✗" — written about 12:8, which Bryan retired, and
 * that ✗ row was an argument AGAINST it so it cannot carry over to 14:10.
 * Bryan is writing the replacements; these are mine until he does.
 */
export const DEFAULT_REC_ROWS: RecRow[] = [
  { text: "Long enough to reach a deep Reset", pro: true },
  { text: "Still leaves a full day of eating", pro: true },
  { text: "Shifts with your evening when you need it to", pro: true },
];

const TABLE_LINE = "#C5C5C5";

interface Props {
  durationMin: number;
  /** Surface behind the panel — differs per frame (see call sites). */
  background: string;
  tagBackground: string;
  rows?: RecRow[];
}

/**
 * The "Recommended Reset" panel: tag, the big ratio, the two clock lines and
 * the comparison table.
 *
 * Shared by the onboarding score card (Figma 4329:53584, blue-alt #E9F0F2) and
 * the existing-member Window intro (Figma 4315:53257, #EEE) — the two frames
 * are identical apart from the surface colour, so this keeps them from drifting.
 */
export function WindowRecPanel({
  durationMin,
  background,
  tagBackground,
  rows = DEFAULT_REC_ROWS,
}: Props) {
  const fastHours = Math.round(durationMin / 60);
  const eatingHours = 24 - fastHours;

  // Lang drew the ratio at 80px around "12:8". Every real label is five
  // characters ("14:10", "12:12"…), wide enough to squeeze the lines beside it
  // onto three. Keep 80 where it fits, step down where it doesn't.
  const label = windowLabel(durationMin);
  const labelSize = label.length <= 4 ? 80 : 64;

  return (
    <View style={[styles.panel, { backgroundColor: background }]}>
      <View style={[styles.tag, { backgroundColor: tagBackground }]}>
        <Text style={styles.tagText}>Recommended Reset</Text>
      </View>

      <View style={styles.head}>
        <Text style={[styles.label, { fontSize: labelSize }]}>{label}</Text>
        <View style={styles.headText}>
          {/* Never wrap: shrink slightly rather than break onto a second line,
              which is what the frame's single-line treatment wants. */}
          <Text style={styles.headLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {eatingHours} hr eating window
          </Text>
          <Text style={styles.headLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {fastHours} hr Reset
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        {rows.map((row, i) => (
          <View
            key={row.text}
            style={[styles.row, i === 0 && styles.rowFirst, i === rows.length - 1 && styles.rowLast]}
          >
            <View style={styles.iconCell}>
              {row.pro ? (
                <CheckCircleIcon color={K.brown} size={16} filled tickColor={background} />
              ) : (
                <CloseIcon color={K.brown} size={16} />
              )}
            </View>
            <View style={[styles.textCell, i === 0 && styles.textCellFirst]}>
              <Text style={[styles.rowText, !row.pro && styles.rowTextDim]}>{row.text}</Text>
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
  head: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: spacing.md },
  label: { fontFamily: fonts.quadrant, letterSpacing: -0.8, color: "#000" },
  headText: { flex: 1, paddingLeft: 12, gap: 6 },
  headLine: {
    fontFamily: fonts.catalogue,
    fontSize: 15,
    letterSpacing: -0.15,
    color: "#000",
  },
  table: { marginHorizontal: 8 },
  row: { flexDirection: "row", alignItems: "stretch" },
  rowFirst: { borderTopWidth: 0.5, borderTopColor: TABLE_LINE },
  rowLast: { borderBottomWidth: 0.5, borderBottomColor: TABLE_LINE },
  iconCell: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: TABLE_LINE,
  },
  textCell: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: spacing.sm,
    borderRightWidth: 0.5,
    borderColor: TABLE_LINE,
  },
  textCellFirst: { borderTopRightRadius: 24 },
  rowText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
  },
  rowTextDim: { opacity: 0.5 },
});

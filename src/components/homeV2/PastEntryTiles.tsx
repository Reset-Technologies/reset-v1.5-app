import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import type { CheckInEntry } from "../../services/checkIn";

interface PastEntryTilesProps {
  entries: CheckInEntry[];
}

const ENERGY_PHRASES: Record<string, string> = {
  low: "Today felt low on energy.",
  okay: "Today felt okay.",
  steady: "Today felt steady.",
  high: "Today felt high energy.",
};

function summarize(entry: CheckInEntry): string {
  const base = ENERGY_PHRASES[entry.energy] ?? "Checked in today.";
  const hasNoStress =
    entry.stressTags.length === 0 || entry.stressTags.includes("none");
  if (hasNoStress) return `${base} No major stressors.`;
  return base;
}

function dayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function PastEntryTiles({ entries }: PastEntryTilesProps) {
  if (entries.length === 0) return null;
  const [first, second] = entries;

  return (
    <View style={styles.row}>
      <View style={[styles.tile, styles.tileLeft]}>
        <Text style={[styles.label, styles.labelDark]}>
          {dayLabel(first.date)}
        </Text>
        <Text style={styles.body}>{summarize(first)}</Text>
      </View>
      {second ? (
        <View style={[styles.tile, styles.tileRight]}>
          <Text style={[styles.label, styles.labelMuted]}>
            {dayLabel(second.date)}
          </Text>
          <Text style={styles.body}>{summarize(second)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tile: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 120,
  },
  tileLeft: {
    backgroundColor: K.ochre,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: radius.xl,
  },
  tileRight: {
    backgroundColor: K.blue,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderBottomLeftRadius: 0,
  },
  label: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  labelDark: {
    color: K.brown,
  },
  labelMuted: {
    color: K.brown,
  },
  body: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    lineHeight: 20,
    color: K.brown,
  },
});

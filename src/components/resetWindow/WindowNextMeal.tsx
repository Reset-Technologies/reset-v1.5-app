import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fonts, spacing, radius } from "../../constants/typography";
import type { DailyPlanMeal } from "../../services/meals";
import { SLOT_LABEL, type Slot } from "../../utils/nextMeal";
import { ChevronIcon } from "./icons";
import type { WindowColors } from "./palette";

interface Props {
  slot: Slot;
  meal: DailyPlanMeal;
  colors: WindowColors;
  onPress: (slot: Slot, meal: DailyPlanMeal) => void;
}

/**
 * The one meal that's relevant while the eating window is open.
 *
 * 🔑 Bryan, 12 Sep: "Inside the Window card, I'd show just the next relevant
 * meal rather than breakfast/lunch/dinner with checkmarks. I don't want us
 * drifting into per-meal logging." So: no list, and no eaten-toggle — this is a
 * pointer into the Meals surface, not a second place to log from. The meal
 * itself comes from the shared pickNextMeal selector, so the card and the rest
 * of the app always name the same meal.
 */
export function WindowNextMeal({ slot, meal, colors: c, onPress }: Props) {
  return (
    <View style={[styles.wrap, { borderTopColor: c.divider }]}>
      <Text style={[styles.header, { color: c.textAlt }]}>Next up</Text>

      <TouchableOpacity
        style={[styles.row, { borderColor: c.divider }]}
        onPress={() => onPress(slot, meal)}
        activeOpacity={0.75}
      >
        <View style={styles.text}>
          <Text style={[styles.eyebrow, { color: c.textAlt }]}>{SLOT_LABEL[slot]}</Text>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
            {meal.name}
          </Text>
        </View>
        <ChevronIcon color={c.textAlt} size={20} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // The card centres its content (header, ring). Without stretching, this row
  // shrink-wraps: the divider becomes a stub, and the `flex: 1` text column
  // gets ZERO width — hiding the slot and meal name and leaving an empty box
  // with a chevron. Seen on the simulator, 13 Sep.
  wrap: {
    alignSelf: "stretch",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    fontFamily: fonts.catalogue,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  text: { flex: 1 },
  eyebrow: { fontFamily: fonts.catalogue, fontSize: 12, marginBottom: 2 },
  name: { fontFamily: fonts.dmSansMedium, fontSize: 15, lineHeight: 20 },
});

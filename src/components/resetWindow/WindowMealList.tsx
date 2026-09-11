import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fonts } from "../../constants/typography";
import type { DailyPlan, DailyPlanMeal } from "../../services/meals";
import { CheckCircleIcon, ChevronIcon } from "./icons";
import type { WindowColors } from "./palette";

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface EatenMealIds {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snack: string[];
}

export const NO_MEALS_EATEN: EatenMealIds = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
};

const SLOTS: { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

interface Props {
  plan: DailyPlan;
  eaten: EatenMealIds;
  colors: WindowColors;
  onMealPress: (meal: DailyPlanMeal) => void;
  onToggleEaten: (slot: MealSlot, meal: DailyPlanMeal) => void;
}

/**
 * Today's meals, inside the Window card while the eating window is open — the
 * brief's "one object … that holds the meal cards inside it". Each row marks
 * the meal eaten (the same toggle the meal screens use) or opens the recipe.
 */
export function WindowMealList({ plan, eaten, colors, onMealPress, onToggleEaten }: Props) {
  const rows = SLOTS.flatMap(({ key, label }) => {
    const meal = plan[key]?.[0];
    if (!meal) return [];
    return [{ key, label, meal, done: (eaten[key] ?? []).includes(meal.id) }];
  });
  if (!rows.length) return null;

  const left = rows.filter((row) => !row.done).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Today’s Meals</Text>
        <Text style={[styles.left, { color: colors.text }]}>
          <Text style={styles.leftCount}>{left}</Text>
          {left === 1 ? " Meal Left" : " Meals Left"}
        </Text>
      </View>

      <View style={[styles.rows, { borderColor: colors.divider }]}>
        {rows.map((row, i) => (
          <View
            key={row.key}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.divider }]}
          >
            <TouchableOpacity
              onPress={() => onToggleEaten(row.key, row.meal)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.done }}
              accessibilityLabel={`Mark ${row.label.toLowerCase()} eaten`}
            >
              <CheckCircleIcon color={colors.text} filled={row.done} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rowText}
              onPress={() => onMealPress(row.meal)}
              activeOpacity={0.8}
            >
              <Text style={[styles.eyebrow, { color: colors.textAlt }, row.done && styles.done]}>
                {row.label}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: colors.text }, row.done && styles.done]}
              >
                {row.meal.name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onMealPress(row.meal)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={`Open ${row.meal.name}`}
            >
              <ChevronIcon color={colors.text} size={20} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontFamily: fonts.quadrant, fontSize: 16, letterSpacing: -0.16 },
  left: { fontFamily: fonts.catalogue, fontSize: 12, letterSpacing: -0.12 },
  leftCount: { fontFamily: fonts.catalogueBold },
  rows: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 4,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 12,
  },
  rowText: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12 },
  name: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14 },
  done: { opacity: 0.5 },
});

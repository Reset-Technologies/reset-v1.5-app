import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { K } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import { RecipesCarousel } from "./RecipesCarousel";
import type { Meal } from "../MealCard";

// ⚠️ NOT the same `Slot` as `utils/nextMeal` — these are the TAB LABELS, and
// they are capitalised because they are rendered. Exported so a caller can
// type a callback without re-declaring (and silently widening) the union.
export type MealSlotLabel = "Breakfast" | "Lunch" | "Dinner";
type Slot = MealSlotLabel;

const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner"];

// Bands per RES-111 product spec. Late-night (9p–4a) wraps to breakfast so
// users opening at 11pm see tomorrow's breakfast picks rather than dinner.
function defaultSlotForTime(date: Date = new Date()): Slot {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 240 && minutes < 630) return "Breakfast"; // 4:00a – 10:30a
  if (minutes >= 630 && minutes < 900) return "Lunch"; // 10:30a – 3:00p
  if (minutes >= 900 && minutes < 1260) return "Dinner"; // 3:00p – 9:00p
  return "Breakfast"; // 9:00p – 4:00a
}

interface MealTabsSectionProps {
  breakfast: Meal[];
  lunch: Meal[];
  dinner: Meal[];
  favoritedMealIds: Set<string>;
  onMealPress: (meal: Meal) => void;
  onFavoriteToggle: (mealId: string) => void;
  onDeepRead?: (meal: Meal) => void;
  /**
   * Fired once per mount, the first time this section actually puts a meal
   * card on screen — reporting the slot and meal that rendered.
   *
   * 🔴 This exists because the obvious place to log "the member saw their
   * first meal" is the Home mount effect, and that is wrong: the daily plan
   * arrives asynchronously, `RecipesCarousel` returns null while a slot is
   * empty, and a member whose plan is empty or still loading would still have
   * fired the event from a mount. The caller cannot tell any of that from
   * outside, because the SELECTED slot lives in here.
   */
  onMealsShown?: (slot: Slot, meal: Meal) => void;
}

export function MealTabsSection({
  breakfast,
  lunch,
  dinner,
  favoritedMealIds,
  onMealPress,
  onFavoriteToggle,
  onDeepRead,
  onMealsShown,
}: MealTabsSectionProps) {
  const [selected, setSelected] = useState<Slot>(() => defaultSlotForTime());
  const { textColor, borderColor } = useAppPalette();

  const meals =
    selected === "Breakfast"
      ? breakfast
      : selected === "Lunch"
        ? lunch
        : dinner;

  // 🔑 Reports the slot that actually rendered, not `defaultSlotForTime()`.
  // If the time-of-day slot came back empty and the member tabbed to one that
  // has meals, the first card they really saw is in THAT slot — and the ref
  // keeps a tab switch from reporting a second "first".
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || meals.length === 0) return;
    shown.current = true;
    onMealsShown?.(selected, meals[0]);
  }, [meals, selected, onMealsShown]);

  return (
    <View>
      <View style={styles.tabsRow}>
        {SLOTS.map((slot) => {
          const isSelected = slot === selected;
          return (
            <TouchableOpacity
              key={slot}
              style={[
                styles.tab,
                { borderColor },
                isSelected && styles.tabSelected,
              ]}
              onPress={() => setSelected(slot)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isSelected ? K.brown : textColor },
                ]}
              >
                {slot}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RecipesCarousel
        slotLabel={selected}
        meals={meals}
        favoritedMealIds={favoritedMealIds}
        onMealPress={onMealPress}
        onFavoriteToggle={onFavoriteToggle}
        onDeepRead={onDeepRead}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tabSelected: {
    backgroundColor: K.blue,
    borderColor: K.blue,
  },
  tabLabel: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 16,
    letterSpacing: -0.16,
  },
});

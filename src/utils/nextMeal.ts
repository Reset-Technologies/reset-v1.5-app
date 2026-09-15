import type { DailyPlan, DailyPlanMeal } from "../services/meals";

export type Slot = "breakfast" | "lunch" | "dinner" | "snack";

export const SLOT_ORDER: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Which slot the clock says we're in. */
export function preferredSlot(now: Date = new Date()): Slot {
  const hour = now.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}

function mealsForSlot(plan: DailyPlan, slot: Slot): DailyPlanMeal[] {
  if (slot === "snack") return plan.snack ? [plan.snack] : [];
  return plan[slot] ?? [];
}

/** First uneaten meal in a slot, else the first one. */
export function pickMealInSlot(plan: DailyPlan, slot: Slot): DailyPlanMeal | null {
  const meals = mealsForSlot(plan, slot);
  if (meals.length === 0) return null;
  const eaten = new Set(plan.eatenMealIds?.[slot] ?? []);
  return meals.find((m) => !eaten.has(m.id)) ?? meals[0];
}

/**
 * The meal to put in front of someone right now: start at the slot the clock
 * is in and walk forward, skipping anything already marked eaten.
 *
 * Extracted from NextMealScreen so the Reset Window card surfaces the SAME
 * meal the rest of the app calls "next" — Bryan's rule is that the Window card
 * shows the relevant meal and never becomes a second meal surface.
 */
export function pickNextMeal(
  plan: DailyPlan,
  now: Date = new Date(),
): { slot: Slot; meal: DailyPlanMeal } | null {
  const start = SLOT_ORDER.indexOf(preferredSlot(now));
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const slot = SLOT_ORDER[(start + i) % SLOT_ORDER.length];
    const meal = pickMealInSlot(plan, slot);
    if (meal) return { slot, meal };
  }
  return null;
}

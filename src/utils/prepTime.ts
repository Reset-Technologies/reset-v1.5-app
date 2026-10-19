/**
 * How a cooking time is shown — and when it is not shown at all.
 *
 * 🔴 Bryan, 2026-10-20: *"We shouldn't display that placeholder as an actual
 * cooking estimate."* Spoonacular returns 45 minutes when it does not know a
 * recipe's time, and that value is on **76% of the catalogue** (395 of 520 in
 * prod). The server now sends `null` for it rather than the placeholder, so the
 * only job left here is to render nothing when there is nothing to render.
 *
 * ## Why a helper for a ternary
 * Four screens show this value and they guarded it four different ways:
 *   • `NextMealScreen`  — `prepTime ? … : ""`           ✅ safe
 *   • `RecipeDetailScreen` — `{prepTime ? … : null}`     ✅ safe
 *   • `MyPlanScreen`    — `typeof x === "number" && x > 0` ✅ safe
 *   • `SavedMealsScreen` — maps `?? 0`, then tests `!= null` → **"0 min"**
 *   • `EsterChatScreen` — `{meal.prepTime} min`, no guard at all
 *
 * The last two only became wrong when the server started sending null, which is
 * the point: a rule spread across five hand-written guards gets a sixth one
 * wrong eventually. This is the rule in one place.
 */

/**
 * `"20 min"`, or `null` when we do not know the time and must stay quiet.
 *
 * 🔑 Zero is unknown, not instant. A `?? 0` upstream must not become "0 min".
 */
export function formatPrepTime(
  minutes: number | null | undefined,
  unit: "min" | "mins" | "minutes" = "min",
): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  return `${minutes} ${unit}`;
}

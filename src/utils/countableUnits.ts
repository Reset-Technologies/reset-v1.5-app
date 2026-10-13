/**
 * Units you can only buy or cook in whole numbers.
 *
 * 🔑 ONE definition, shared by Recipe Details and the grocery list. It lived
 * inside RecipeDetailScreen, where the grocery list could not see it — and the
 * list promptly shipped a line reading "0.5 small" avocado. The same drift that
 * once left the same meal labelled two ways on two screens ([[dietLabel]]).
 *
 * 🔴 The SET is shared; the ROUNDING RULE is not, deliberately:
 *   - a recipe rounds to the nearest sensible amount to COOK
 *   - a shopping list rounds UP, because you cannot buy half an avocado and
 *     coming home short is worse than a little spare
 */
export const COUNTABLE_UNITS = new Set([
  "",
  "egg",
  "eggs",
  "piece",
  "pieces",
  "slice",
  "slices",
  "clove",
  "cloves",
  "head",
  "heads",
  "leaf",
  "leaves",
  "stalk",
  "stalks",
  "stick",
  "sticks",
  "sprig",
  "sprigs",
  "can",
  "cans",
  "bottle",
  "bottles",
  "jar",
  "jars",
  "package",
  "packages",
  "packet",
  "packets",
  "small",
  "medium",
  "large",
  "serving",
  "servings",
]);

export function isCountableUnit(unit: string | null | undefined): boolean {
  return COUNTABLE_UNITS.has((unit ?? "").trim().toLowerCase());
}

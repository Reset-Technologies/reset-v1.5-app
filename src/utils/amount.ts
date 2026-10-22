import { COUNTABLE_UNITS } from "./countableUnits";

/**
 * ONE way to write "how much" — shared by Recipe Details and the grocery list.
 *
 * 🔑 The two screens had two formatters for the same job, and the good one was
 * on the wrong screen. Recipe Details printed `⅜ lbs` and `3 ½ oz`; the
 * grocery list printed the same underlying numbers as `0.14 cup` and
 * `5.71 gram`. Found walking the S24 on 2026-10-22 — the recipe behind
 * "wheat flour · 0.14 cup" showed that same amount as "⅛ cup" one screen away.
 *
 * 🔴 THE ROUNDING RULE STAYS SPLIT, on purpose. `countableUnits.ts` says it:
 * a recipe rounds a countable to the nearest amount to COOK, a shopping list
 * rounds UP because you cannot buy half an avocado and coming home short is
 * worse than a little spare. That is why `roundUp` is a parameter rather than
 * something this module decides. Only the WRITING is shared.
 */

const FRACTION_STOPS: Array<{ value: number; glyph: string }> = [
  { value: 0, glyph: "" },
  { value: 1 / 8, glyph: "⅛" },
  { value: 1 / 4, glyph: "¼" },
  { value: 1 / 3, glyph: "⅓" },
  { value: 3 / 8, glyph: "⅜" },
  { value: 1 / 2, glyph: "½" },
  { value: 5 / 8, glyph: "⅝" },
  { value: 2 / 3, glyph: "⅔" },
  { value: 3 / 4, glyph: "¾" },
  { value: 7 / 8, glyph: "⅞" },
  { value: 1, glyph: "" },
];

/**
 * Metric mass and volume take WHOLE NUMBERS, never vulgar fractions.
 *
 * 🔴 Nobody writes "5 ¾ g". Fractions are how COOKING measures are spoken —
 * cups, spoons, pounds, ounces all divide in halves and eighths — but metric
 * is decimal by design and reads as whole units. Without this the shared
 * formatter would have turned "5.71 gram" into "5 ¾ g", which is worse than
 * the decimal it replaced.
 *
 * 📌 Both spellings: the backend canonicalises to the British `millilitre`
 * and `litre` (`units.ts`), so matching only the US forms would silently miss
 * every real row.
 */
const WHOLE_NUMBER_UNITS = new Set([
  "gram",
  "grams",
  "g",
  "kilogram",
  "kilograms",
  "kg",
  "milliliter",
  "milliliters",
  "millilitre",
  "millilitres",
  "ml",
  "liter",
  "liters",
  "litre",
  "litres",
  "l",
]);

/**
 * Canonical unit name → how we say it. Includes the British canonical forms,
 * which is also what stops the grocery list reading "1.67 millilitre" to a US
 * member (Cole, 2026-10-22).
 */
const UNIT_ABBREVIATIONS: Record<string, string> = {
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  ounce: "oz",
  ounces: "oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  /**
   * 🔴 BOTH forms give "lbs". They used to differ — `pound: "lb"`,
   * `pounds: "lbs"` — which was invisible while each screen had its own
   * formatter, because Recipe Details reads the recipe's own `pounds` and the
   * grocery list reads the backend's canonical singular `pound`. Sharing one
   * formatter would have made the same ingredient read "⅜ lbs" on one screen
   * and "1 ¾ lb" on the other. "lbs" is the form already shipping.
   */
  pound: "lbs",
  pounds: "lbs",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  liter: "L",
  liters: "L",
  litre: "L",
  litres: "L",
};

export function abbreviateMeasurement(measurement: string): string {
  if (!measurement) return "";
  const lower = measurement.trim().toLowerCase();
  return UNIT_ABBREVIATIONS[lower] ?? measurement;
}

/**
 * Write a quantity the way a person would.
 *
 * @param roundUp how a COUNTABLE unit rounds — up for a shopping list, to the
 *   nearest for a recipe. See the note at the top; this is the one thing the
 *   two callers must not share.
 */
export function formatAmount(
  qty: number,
  measurement: string | null | undefined,
  { roundUp = false }: { roundUp?: boolean } = {},
): string {
  if (!isFinite(qty) || qty <= 0) return "0";
  const unit = (measurement ?? "").trim().toLowerCase();

  if (COUNTABLE_UNITS.has(unit)) {
    return roundUp
      ? Math.max(1, Math.ceil(qty)).toString()
      : Math.max(1, Math.round(qty)).toString();
  }
  if (WHOLE_NUMBER_UNITS.has(unit)) return Math.max(1, Math.round(qty)).toString();
  if (qty >= 10) return Math.round(qty).toString();

  const intPart = Math.floor(qty);
  const fracPart = qty - intPart;
  let best = FRACTION_STOPS[0];
  let bestDelta = 1;
  for (const stop of FRACTION_STOPS) {
    const delta = Math.abs(fracPart - stop.value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = stop;
    }
  }
  if (best.value === 1) return (intPart + 1).toString();
  if (best.value === 0) {
    if (intPart > 0) return intPart.toString();
    /**
     * 🔴 A real amount must never print as "0". Unreachable until Standard
     * became one serving and quantities started being divided: ¼ tsp of
     * cayenne in a 4-serving recipe is 1/16, whose nearest stop is zero, and
     * the screen told the member to use NONE of it. "< ⅛" is the honest
     * reading — smaller than the finest fraction we show, but present.
     */
    return `< ${FRACTION_STOPS[1].glyph}`;
  }
  if (intPart === 0) return best.glyph;
  return `${intPart} ${best.glyph}`;
}

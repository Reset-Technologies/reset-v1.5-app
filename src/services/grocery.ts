import { apiClient } from "./apiClient";
import { isCountableUnit } from "../utils/countableUnits";

/**
 * Client for the grocery list (`/api/meals/my-plan/grocery`).
 *
 * 🔑 The list is DERIVED from the current meal-plan revision — the member does
 * not build it. GROCERY LIST r5: it is created from the planned recipes'
 * ingredients, and r6–r9 recompute it when the plan changes. The only things
 * the member writes are the checkbox and their own added lines.
 */

export interface GroceryComponent {
  quantity: number;
  unit: string;
}

export interface GroceryItem {
  id: string;
  /** Null for a member-added line — it has no canonical ingredient. */
  ingredientId: string | null;
  name: string;
  /**
   * Shelf category ("Produce", "Meat", …). The screen GROUPS by this.
   *
   * 🔴 Nullable on both paths: an ingredient may be uncategorised, and the
   * Category dropdown on the add sheet is optional. Those lines still have to
   * appear, so the screen buckets them rather than dropping them.
   */
  category: string | null;
  /**
   * Normalised amounts for a DERIVED line. More than one component means the
   * units could not be combined, so they are shown separately rather than as a
   * guessed total.
   */
  components: GroceryComponent[];
  /** The amount a member typed, verbatim ("2 cloves"). Manual lines only. */
  quantityText: string | null;
  needsReview: boolean;
  checked: boolean;
  fromPlannedMeals: string[];
  /** True when the member added this line themselves (r11). */
  manual: boolean;
}

export interface GroceryListResponse {
  groceryListId: string;
  revisionId: string;
  items: GroceryItem[];
}

/**
 * Fetch the current week's list.
 *
 * ⚠️ Throws when there is no plan for the week. That is deliberate on the
 * server — My Plan generates on read, so the grocery tab must not quietly
 * generate a week as a side effect of being opened.
 */
export async function getGroceryList(
  opts: { rebuild?: boolean } = {},
): Promise<GroceryListResponse> {
  // 🔑 The list is DERIVED ONCE PER REVISION and then stored, so a plain read
  // returns whatever was computed the first time the member opened it. That is
  // deliberate — it is what makes check state survive. But it also means a
  // backend change to how quantities are derived does NOT reach a list that
  // already exists: it stays as-is until the plan changes (a swap makes a new
  // revision) or the week rolls over. `rebuild` is the member's way out of
  // that, and the only way to see a corrected list on an unchanged plan.
  const q = opts.rebuild ? "?rebuild=true" : "";
  return apiClient<GroceryListResponse>(`/api/meals/my-plan/grocery${q}`);
}

/** Tick or untick one line. The only member-writable part of a derived list. */
export async function setGroceryItemChecked(
  itemId: string,
  checked: boolean,
): Promise<GroceryItem> {
  return apiClient<GroceryItem>(`/api/meals/my-plan/grocery/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ checked }),
  });
}

/**
 * Add a freeform line (r11).
 *
 * Only `name` is required — the Add custom item sheet enables its button as
 * soon as a name is typed, with Category and Quantity still empty.
 */
export async function addGroceryItem(input: {
  name: string;
  category?: string | null;
  quantity?: string | null;
}): Promise<GroceryItem> {
  return apiClient<GroceryItem>("/api/meals/my-plan/grocery/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Remove a member-added line.
 *
 * 🔴 Manual lines ONLY — the server refuses a derived one. r9 removes those by
 * removing the MEAL, and deleting one here would simply be re-derived on the
 * next rebuild, which would read to the member as the delete not working.
 */
export async function removeGroceryItem(itemId: string): Promise<void> {
  await apiClient(`/api/meals/my-plan/grocery/items/${itemId}`, {
    method: "DELETE",
  });
}

/** Where a line with no category is shown, so it cannot silently disappear. */
export const UNCATEGORISED = "Other";

/**
 * Group lines into the screen's sections.
 *
 * Categories keep the order the server returned them in (items come back
 * name-ascending), so the sections are stable between reads rather than
 * reshuffling as the member ticks things off. "Other" always sorts last — it is
 * a fallback bucket, not a real aisle.
 */
export function groupByCategory(
  items: GroceryItem[],
): Array<{ category: string; items: GroceryItem[] }> {
  const order: string[] = [];
  const byCategory = new Map<string, GroceryItem[]>();

  for (const item of items) {
    const key = item.category?.trim() || UNCATEGORISED;
    if (!byCategory.has(key)) {
      byCategory.set(key, []);
      order.push(key);
    }
    byCategory.get(key)!.push(item);
  }

  return order
    .sort((a, b) => {
      if (a === UNCATEGORISED) return 1;
      if (b === UNCATEGORISED) return -1;
      return a.localeCompare(b);
    })
    .map((category) => ({ category, items: byCategory.get(category)! }));
}

/**
 * The amount shown under a line's name.
 *
 * A manual line shows exactly what the member typed. A derived line shows its
 * normalised components, joined when they could not be combined into one.
 * Returns null when there is nothing measurable to say — r17 allows that, and
 * printing "0" or an empty unit would be worse than printing nothing.
 */
export function amountLabel(item: GroceryItem): string | null {
  if (item.manual) return item.quantityText?.trim() || null;
  if (!item.components?.length) return null;
  return item.components
    .map(
      (c) =>
        `${formatQuantity(c.quantity, c.unit)}${c.unit ? ` ${displayUnit(c.unit)}` : ""}`,
    )
    .join(" + ");
}

/**
 * Canonical unit name → the spelling a US member expects.
 *
 * 🔴 The backend canonicalises the AMERICAN spellings into the BRITISH ones —
 * `units.ts` maps `milliliter`/`milliliters` → `millilitre` and
 * `liter`/`liters` → `litre` — and that canonical string is what this label
 * prints, so the grocery list read **"apple cider vinegar · 1.67 millilitre"**
 * to a US audience. Spotted by Cole on his S24, 2026-10-22.
 *
 * 🔑 Fixed HERE, not in `units.ts`. The canonical name is written into
 * `grocery_list_line.components` as jsonb and `groceryDelta` compares
 * `quantity:unit` pairs, so changing it server-side would make every stored ml
 * line look edited exactly once — churn for a spelling. The stored name stays
 * the join key; this is only how we say it out loud.
 *
 * 📌 Deliberately NOT abbreviating to "ml"/"L" as well. That is a copy call
 * and it is Bryan's; this change only corrects the locale.
 */
const US_UNIT_SPELLING: Record<string, string> = {
  millilitre: "milliliter",
  millilitres: "milliliters",
  litre: "liter",
  litres: "liters",
};

function displayUnit(unit: string): string {
  return US_UNIT_SPELLING[unit.toLowerCase()] ?? unit;
}

/**
 * 1.25 -> "1.25", 2.0 -> "2". Trailing zeros read as false precision.
 *
 * 🔴 A COUNTABLE unit rounds UP. Since Standard became one serving, dividing a
 * recipe's amount routinely lands on a fraction — the list showed "0.5 small"
 * avocado, which is correct arithmetic and not a thing anyone can buy. Rounding
 * up is the only safe direction: a little spare is a worse outcome than getting
 * home without enough to cook. Grams and milliliters stay fractional, because
 * 150.75 g is perfectly shoppable.
 */
function formatQuantity(q: number, unit?: string): string {
  if (!Number.isFinite(q)) return "";
  const n = isCountableUnit(unit) ? Math.max(1, Math.ceil(q)) : q;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

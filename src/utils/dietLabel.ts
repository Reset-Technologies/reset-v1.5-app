/**
 * Display wording for a diet name.
 *
 * 🔑 ONE definition, used by every surface that shows diet tags. The DB stores
 * lower-case names ("gluten free"); Lang's frames read "Gluten-free". Before
 * this existed, My Plan rendered "Gluten-free" and Recipe Details rendered the
 * raw "gluten free" — the same meal, labelled two ways, which is exactly the
 * drift that once left three different stress scales in the codebase.
 *
 * Neither title-case nor blind hyphenation gets every case right ("Whole30",
 * "Low FODMAP", "Keto"), so the exceptions are listed. Anything unrecognised
 * falls back to simple capitalisation rather than being dropped: a new diet
 * appearing in the catalogue should still show, just less prettily.
 */
const DIET_LABEL: Record<string, string> = {
  "gluten free": "Gluten-free",
  "dairy free": "Dairy-free",
  "low fodmap": "Low FODMAP",
  "whole 30": "Whole30",
  ketogenic: "Keto",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  primal: "Primal",
  paleo: "Paleo",
  pescetarian: "Pescetarian",
};

export function dietLabel(name: string): string {
  const key = name.trim().toLowerCase();
  return (
    DIET_LABEL[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
  );
}

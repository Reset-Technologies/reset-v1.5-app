import { apiClient } from "./apiClient";
import { dietLabel } from "../utils/dietLabel";

/**
 * Client for the NEW weekly plan surface (`/api/meals/my-plan`).
 *
 * 🔴 This is a DIFFERENT MODEL from `services/meals.ts`, which talks to the
 * legacy `daily-plan` endpoints. That one is a single day keyed on
 * breakfast/lunch/dinner; this one is a 7-day plan of ordered, semantic slots
 * under an immutable revision. They are not interchangeable and this file
 * deliberately does not import from it. The legacy surface stays live until a
 * cutover is agreed — see the flag that gates the My Plan screen.
 *
 * 🔑 The backend shipped this surface on 2026-10-09 (`d918e1c`) with NO client
 * at all. Nothing in the app called it, which is why a plan was never
 * generated in production and the check-in ranking bias could not fire.
 */

/**
 * Semantic slots, NOT breakfast/lunch/dinner.
 *
 * 🔑 Handoff sheet, MY PLAN r16: *"Use semantic order, not hard-coded
 * universal meal count … Do not let backend assume exactly 3 meals/day."*
 * The display MAY say Breakfast/Lunch/Dinner where appropriate, but the model
 * underneath must not, because Windows and real schedules vary.
 */
export type MealSlotType = "first_meal" | "midday" | "evening" | "snack";

/**
 * A recipe as the MEMBER sees it — mirrors `MyPlanRecipeDto`.
 *
 * 🔴 DO NOT WIDEN THIS without a product decision. The server DTO is the
 * enforcement boundary for the Reset Food Contract: *"The member never sees
 * calories, macros, nutrient scores, or a weekly nutrition scorecard."* If a
 * field you want is absent here, that is the contract, not an oversight.
 */
export interface MyPlanRecipe {
  id: string;
  /** The pinned version — what the member was actually given. */
  versionId: string;
  title: string;
  imageUrl: string | null;
  readyInMinutes: number | null;
  difficultyLevel: string | null;
  /**
   * Raw CLASSIFICATION values for the tag pills — not finished pill text. The
   * server deliberately sends enums so the editorial call (which values are
   * worth showing, how they are worded, how many fit) stays here with the
   * design. See `buildTags` below.
   */
  inflammatoryIndex: "pro" | "neutral" | "anti" | null;
  foodQuality: "whole" | "minimally_processed" | "ultra_processed" | null;
  cuisineCluster: string | null;
  /**
   * Diet names, lower-case as stored: "gluten free", "vegetarian", …
   *
   * 🔴 OPTIONAL on purpose, even though the DTO always sends it. This app has
   * NO OTA channel, so a build can run for weeks against a backend that
   * predates a field — and it did: tapping a row against the then-deployed
   * server crashed on `recipe.diets.map` because `diets` had not shipped yet.
   * Treat every newly added response field as absent-until-proven here.
   */
  diets?: string[];
}


/** Lang's frames call a short recipe "Fast"; Recipe Details says "30 min". */
const FAST_MINUTES = 30;

/**
 * Tag pills for a meal row.
 *
 * 🔴 THIS NO LONGER MIRRORS `NextMealScreen.buildTags`, deliberately. The first
 * version copied that legacy function — inflammatory index, food quality,
 * cuisine — because it was the existing pattern. It is the wrong SOURCE:
 * Lang's frames tag meals by DIET and TIME ("Gluten-free · Dairy-free · 30
 * min", "Organic · Vegan · Fast"), and the classification fields are nearly
 * constant across the catalogue — `cuisineCluster` is "comfort" for 88% of
 * meals, so 52% of rows rendered the identical three pills.
 *
 * 📌 Measured before switching: 90% of meals carry at least one diet, and the
 * most common pill row falls 52% -> 36% across 22 distinct rows. An
 * improvement, not a cure — the catalogue itself is skewed (gluten free 67%,
 * dairy free 57%) and 8% of meals will show only a time tag or nothing.
 *
 * ⚠️ "Organic" appears in Lang's My Plan frame and has NO source in our data.
 * Omitted rather than faked.
 *
 * 🔑 The lesson worth keeping: the live app's behaviour is not the spec. I
 * copied a pattern from the legacy card without checking the FRAME for what
 * the tags should say.
 *
 * Capped at 3 — what the frame has room for.
 */
export function buildTags(recipe: MyPlanRecipe): string[] {
  const tags = (recipe.diets ?? []).map(dietLabel);
  if (
    recipe.readyInMinutes != null &&
    recipe.readyInMinutes <= FAST_MINUTES
  ) {
    tags.push("Fast");
  }
  return tags.slice(0, 3);
}

export interface MyPlanSlot {
  id: string;
  slotType: MealSlotType;
  sortOrder: number;
  servings: number;
  /** Null when the slot exists but holds no recipe yet. */
  recipe: MyPlanRecipe | null;
}

export interface MyPlanDay {
  /** Local calendar day, `YYYY-MM-DD`. Every planned meal belongs to one. */
  date: string;
  slots: MyPlanSlot[];
}

export interface MyPlanResponse {
  mealPlanId: string;
  revisionId: string;
  revisionNo: number;
  /** `YYYY-MM-DD` of the first day of the week. */
  weekStart: string;
  days: MyPlanDay[];
  /**
   * True when THIS request generated the week rather than reading an existing
   * one. Lets the UI tell a fresh draft from a plan the member has edited.
   */
  generated: boolean;
}

/**
 * Fetch the current week.
 *
 * ⚠️ This call can GENERATE a plan as a side effect — `generated: true` says it
 * did. That is the documented "first plan" behaviour (MY PLAN r5: generate when
 * a paid member enters Meals with no current plan).
 *
 * 🔴 It must NOT be called speculatively — on app boot, on a prefetch, or from
 * a screen the member did not open. MY PLAN r6 is explicit: *"Never regenerate
 * just because screen opened"* and *"No automatic data mutation"*, with the
 * rationale *"Stable plan is important."* Generation also costs real work
 * server-side. Call it when the member opens My Plan, and not before.
 */
export async function getMyPlan(): Promise<MyPlanResponse> {
  return apiClient<MyPlanResponse>("/api/meals/my-plan");
}

/**
 * Add a recipe to a day and slot of the member's week.
 *
 * 🔴 This call did not exist until 2026-10-19, and neither did any other — the
 * route has been live on the server the whole time, emitting `meal_added`
 * (TEST CASES M33), and **nothing in the app ever called it**. Every other app
 * call goes to `/my-plan/meals/:plannedMealId/…`, which operates on meals that
 * are already in the plan. So a member could search 528 recipes in Explore,
 * open one, and had no way to put it in their week.
 *
 * 🔑 The gap survived because the endpoint existed. "The backend supports it"
 * is not "the feature exists" — ExploreScreen's own comment asserted that
 * adding "already lives" on Recipe Details, which was never true.
 *
 * 📌 EXPLORE r5/r6 put the plan effect at *"None until explicit add/swap"*, so
 * this is the explicit half: it only ever runs from a member tapping Add.
 */
export async function addMealToPlan(params: {
  mealPlanId: string;
  /** `YYYY-MM-DD`, a day of the member's current week. */
  localDate: string;
  slotType: MealSlotType;
  recipeVersionId: string;
  servings?: number;
}): Promise<void> {
  await apiClient("/api/meals/my-plan/meals", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 🔴 NOT IMPLEMENTED ON PURPOSE: there is no "I ate this" call here.
 *
 * The backend does expose `POST /api/meals/my-plan/meals/:id/eaten`, but the
 * spec forbids surfacing it on this screen, in four places:
 *   - START HERE r7  — "No food logging … Reset learns without turning Meals
 *                       into a tracker."
 *   - START HERE r32 — "Daily compliance logging — Do not build."
 *   - START HERE r22 — "Never infer eating from Cook Mode, grocery list, view,
 *                       or Save alone."
 *   - DECISION LOG r11 — "no daily ledger"; the recorded REJECTED alternative
 *                       is literally "Daily pass/fail meal tracking."
 *
 * The sanctioned signal is a DAY-level sampled follow-through
 * (`meal_followthrough_sample`: On plan 1.0 / Mostly 0.5 / Not really 0.0),
 * capped at 3 prompts per 7 active plan days and 1 Meals ask per local day,
 * with silence staying null. That is a different feature with its own budget —
 * not a button on a meal card.
 *
 * Those endpoints exist for parity with the LEGACY daily-plan UI. Their
 * presence is not permission to add the control here.
 */

/**
 * Change the serving size of ONE planned meal.
 *
 * 🔑 `servings` is a MULTIPLIER, not a count — 0.5 / 1 / 2, matching the
 * Half/Standard/Double control. The server validates against exactly that set
 * (`SERVING_MULTIPLIERS`) and rejects anything else, so there is no point
 * sending a value the UI cannot produce.
 *
 * 🔴 `mealPlanId` is REQUIRED by the endpoint and is not decoration: the server
 * resolves the plan for the caller from it and refuses when the plan is not
 * theirs. Without it any member could resize another member's meal by guessing
 * a planned-meal id.
 *
 * ⚠️ This creates a new `meal_plan_revision` and the grocery list rescales on
 * its next read — SERVINGS + ING: a serving change updates nutrition and the
 * grocery list, but never the shared Score `plan_version_id`.
 */
export async function setPlannedMealServings(params: {
  plannedMealId: string;
  mealPlanId: string;
  servings: number;
}): Promise<void> {
  await apiClient(
    `/api/meals/my-plan/meals/${params.plannedMealId}/servings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        mealPlanId: params.mealPlanId,
        servings: params.servings,
      }),
    },
  );
}

/**
 * REARRANGE — move one planned meal to another day and/or slot.
 *
 * 🔑 MY PLAN r10: *"Move assignment and refresh grocery timing only if list is
 * date-aware … Food strategy unchanged."* It creates a new
 * `meal_plan_revision` and deliberately does NOT touch the shared Score
 * `plan_version_id` — START HERE r7 lists ordinary edits as staying inside the
 * same version.
 *
 * 🔴 `mealPlanId` is required and is the ownership proof, exactly as for
 * `setPlannedMealServings`. The server resolves the plan from it and refuses a
 * plan that is not the caller's, so a guessed `plannedMealId` is not enough to
 * move someone else's meal.
 *
 * 🔴 AT LEAST ONE of `toLocalDate` / `toSlotType` must be set — the server
 * rejects a move that changes neither ("A move needs a new day, a new slot, or
 * both").
 *
 * ⚠️ The meal lands at the END of the destination day. That is the server's
 * choice, so a move "never silently reorders the meals already there" — which
 * is also what makes an undo locatable (see `findMovedSlot`).
 */
export async function movePlannedMeal(params: {
  plannedMealId: string;
  mealPlanId: string;
  toLocalDate?: string;
  toSlotType?: MealSlotType;
}): Promise<void> {
  await apiClient(`/api/meals/my-plan/meals/${params.plannedMealId}/move`, {
    method: "PATCH",
    body: JSON.stringify({
      mealPlanId: params.mealPlanId,
      ...(params.toLocalDate ? { toLocalDate: params.toLocalDate } : {}),
      ...(params.toSlotType ? { toSlotType: params.toSlotType } : {}),
    }),
  });
}

/**
 * Remove a meal from the week — Bryan's ruling, 2026-10-21: *"Let's include a
 * simple Remove action so members can remove a meal they've added to a day.
 * The remaining meals stay in place, and the grocery list should update
 * accordingly."*
 *
 * 🔑 Both of those are the server's doing, not ours. `removeMeal` commits a
 * revision carrying every other meal forward with its own day, slot, order,
 * servings and planned time untouched, and the grocery list derives from the
 * current revision — so it re-derives on the next read with nothing to
 * invalidate here.
 *
 * 🔴 The server REFUSES to remove the last meal in the plan ("My Plan is never
 * empty"), which is a product rule, not an error condition. The caller has to
 * say something useful when that comes back.
 *
 * 📌 `mealPlanId` goes in the BODY, not the query string — this route reads
 * `@Body()`, unlike the substitution delete beside it, which reads `@Query()`.
 */
export async function removePlannedMeal(params: {
  plannedMealId: string;
  mealPlanId: string;
}): Promise<void> {
  await apiClient(`/api/meals/my-plan/meals/${params.plannedMealId}`, {
    method: "DELETE",
    body: JSON.stringify({ mealPlanId: params.mealPlanId }),
  });
}

/**
 * Find a meal after it has been moved, so the move can be undone.
 *
 * 🔴🔴 PLANNED-MEAL IDS DO NOT SURVIVE AN EDIT. `commitRevision` is handed
 * meals with no ids and writes fresh rows for every revision, so the id the
 * client used to move a meal is dead the moment the call returns. Undo cannot
 * simply call move again with the same id — it has to re-read the plan and
 * find the meal where it landed.
 *
 * 🔑 Locating it is reliable precisely BECAUSE the server appends: the moved
 * meal is the one on the destination day carrying that recipe version with the
 * highest `sortOrder`. Matching on recipe version alone would be ambiguous
 * when the same recipe appears twice in a day; "last on the day" disambiguates
 * it, and only holds because `moveMeal` sets `sortOrder = max + 1`.
 *
 * Returns null when the meal cannot be found, which the caller must treat as
 * "undo is no longer available" rather than retrying blindly — the plan may
 * have been regenerated underneath it.
 */
export function findMovedSlot(
  plan: MyPlanResponse,
  toLocalDate: string,
  recipeVersionId: string,
): MyPlanSlot | null {
  const day = plan.days.find((d) => d.date === toLocalDate);
  if (!day) return null;
  const candidates = day.slots.filter(
    (s) => s.recipe?.versionId === recipeVersionId,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.sortOrder > a.sortOrder ? b : a));
}

/**
 * SWAP — replace the recipe in one slot, keeping the slot itself.
 *
 * 🔑 MY PLAN r9: *"Replace planned meal in same slot; refresh grocery delta."*
 * Day, slot type, sort order, servings and planned time all survive; only the
 * content changes. Like a move it writes a new `meal_plan_revision` and leaves
 * the shared Score `plan_version_id` alone (START HERE r7), which is why an
 * approved swap "can still count as On plan in Score".
 *
 * 🔴 A SWAP IS NOT A REJECTION. The sheet is explicit — *"A passive swap alone
 * is not a rejection"* — so do NOT pair this with a "why did you swap?" prompt.
 * Rejection is a separate, explicit signal with its own reasons endpoint, and
 * conflating them would corrupt the Fit evidence Score reads.
 *
 * 🔴 `recipeVersionId` must be a CURRENT version of a live recipe. The server
 * now refuses anything else (400) rather than committing a revision whose slot
 * cannot render — but the UI should still only offer saved meals that carry a
 * `currentVersionId`.
 */
export async function swapPlannedMeal(params: {
  plannedMealId: string;
  mealPlanId: string;
  recipeVersionId: string;
}): Promise<void> {
  await apiClient(`/api/meals/my-plan/meals/${params.plannedMealId}/swap`, {
    method: "POST",
    body: JSON.stringify({
      mealPlanId: params.mealPlanId,
      recipeVersionId: params.recipeVersionId,
    }),
  });
}

/**
 * Find a slot again after a swap, so the swap can be undone.
 *
 * 🔑 Cleaner than the move case: a swap PRESERVES the slot, so the meal is
 * still on the same day at the same `sortOrder` — an exact match rather than
 * `findMovedSlot`'s "last on the day" reasoning. The id is still new, because
 * every revision writes fresh planned-meal rows, which is the whole reason
 * this function has to exist at all.
 */
export function findSwappedSlot(
  plan: MyPlanResponse,
  localDate: string,
  sortOrder: number,
): MyPlanSlot | null {
  const day = plan.days.find((d) => d.date === localDate);
  if (!day) return null;
  return day.slots.find((s) => s.sortOrder === sortOrder) ?? null;
}

/**
 * Rebuild the week — Rule 1's fourth verb.
 *
 * MY PLAN r11 ("Rebuild week"): *"Member explicitly chooses rebuild"* ->
 * *"Generate a fresh week using same current strategy unless the plan engine
 * has changed a major lever."* New `meal_plan_revision`, and the plan version
 * is deliberately unchanged: *"A user-requested rebuild is not automatically a
 * new Score experiment."*
 *
 * 🔑 EXPLICITLY is the whole contract. This is the same generation path
 * `getMyPlan()` warns about, reached on purpose — r6's *"Never regenerate just
 * because screen opened"* bans the speculative call, not this one. Only ever
 * call it from a control the member pressed and confirmed.
 *
 * Returns the whole new week, so the caller replaces its state from the
 * response rather than re-reading. Planned-meal ids are reborn with every
 * revision, so the old ones are dead the moment this resolves.
 *
 * 📌 The other mutations (add, remove, substitutions) are still deliberately
 * absent — each arrives with the screen that needs it. The endpoints are listed
 * in `my-plan.controller.ts` when that time comes.
 */
export async function rebuildWeek(): Promise<MyPlanResponse> {
  return apiClient<MyPlanResponse>("/api/meals/my-plan/regenerate", {
    method: "POST",
  });
}

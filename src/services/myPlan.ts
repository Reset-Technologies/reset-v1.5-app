import { apiClient } from "./apiClient";

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
 * 📌 Mutations (swap, move, servings, add, remove, grocery, substitutions) are
 * deliberately absent for now. The first slice is the read-only week view; each
 * mutation arrives with the screen that needs it, so the client never carries
 * calls nothing exercises. The endpoints are listed in
 * `my-plan.controller.ts` when that time comes.
 */

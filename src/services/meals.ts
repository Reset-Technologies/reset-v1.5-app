import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "./apiClient";

const FAVORITES_KEY = "@reset_meal_favorites";

// --- Local favorites (used with mock meal data) ---

export async function getLocalFavorites(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

export async function toggleLocalFavorite(mealId: string): Promise<boolean> {
  const favorites = await getLocalFavorites();
  const isFavorited = favorites.has(mealId);
  if (isFavorited) {
    favorites.delete(mealId);
  } else {
    favorites.add(mealId);
  }
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  return !isFavorited;
}

// --- Backend favorites (for use when meals come from the API) ---

export interface MealFavorite {
  id: string;
  name: string;
  imageAsset: string | null;
  description: string | null;
  prepTime: number | null;
  ingredients: number;
  isBreakfast: boolean;
  isLunch: boolean;
  isDinner: boolean;
  calories: number | null;
  protein: number | null;
  primaryProtein: string | null;
  cuisineCluster: string | null;
  inflammatoryIndex: string | null;
  /**
   * The recipe's current pinned version — what a swap must send.
   *
   * 🔴 OPTIONAL because this app has NO OTA channel: a build can run for weeks
   * against a backend that predates the field, and the tag work already shipped
   * a crash that way. Treat `undefined` (old server) and `null` (no version)
   * the same — the meal cannot be swapped in.
   */
  currentVersionId?: string | null;
}

export async function addFavorite(mealId: string): Promise<void> {
  await apiClient("/api/meals/favorites", {
    method: "POST",
    body: JSON.stringify({ mealId }),
  });
}

export async function removeFavorite(mealId: string): Promise<void> {
  await apiClient(`/api/meals/favorites/${mealId}`, {
    method: "DELETE",
  });
}

export async function getFavorites(
  mealType?: "breakfast" | "lunch" | "dinner",
): Promise<MealFavorite[]> {
  const params = mealType ? `?mealType=${mealType}` : "";
  return apiClient<MealFavorite[]>(`/api/meals/favorites${params}`);
}

// --- Daily Meal Plan API ---

export interface DailyPlanMeal {
  id: string;
  name: string;
  whyLine: string;
  calories: number;
  protein: number;
  prepTime: number;
  time: "breakfast" | "lunch" | "dinner" | "snack";
  imageUrl?: string;
  iliScore?: number;
  inflammatoryIndex?: "pro" | "neutral" | "anti";
  foodQuality?: "whole" | "minimally_processed" | "ultra_processed";
  primaryProtein?: string;
  cuisineCluster?: string;
}

// RES-166 (Route B): attribution for a check-in-driven meal change.
export interface CheckInChangeItem {
  slot: "breakfast" | "lunch" | "dinner";
  mealId: string;
  mealName: string;
  signal: "stress" | "sleep" | "energy";
  reason: string;
}

export interface CheckInChange {
  changed: boolean;
  changes: CheckInChangeItem[];
}

export interface SignalAdjustments {
  stress: boolean;
  sleep: boolean;
  energy: boolean;
  recentlyScanned: boolean;
  recentlySurveyed: boolean;
  // Present only when applyCheckIn actually moved a meal (else omitted).
  checkInChange?: CheckInChange;
}

export interface DailyPlan {
  id: string;
  date: string;
  metabolicType: string;
  cyclePhase?: string;
  breakfast: DailyPlanMeal[];
  lunch: DailyPlanMeal[];
  dinner: DailyPlanMeal[];
  snack?: DailyPlanMeal;
  signalAdjustments?: SignalAdjustments;
  eatenMealIds?: {
    breakfast: string[];
    lunch: string[];
    dinner: string[];
    snack: string[];
  };
}

const DAILY_PLAN_CACHE_KEY = "@reset_daily_plan";

export async function getDailyPlan(date?: string): Promise<DailyPlan> {
  const dateParam = date || new Date().toISOString().split("T")[0];
  return apiClient<DailyPlan>(`/api/meals/daily-plan?date=${dateParam}`);
}

export async function refreshDailyPlan(): Promise<DailyPlan> {
  return apiClient<DailyPlan>("/api/meals/daily-plan/refresh", {
    method: "POST",
  });
}

// RES-166 (Route B): re-tune today's plan to the just-submitted check-in.
// Any meal change is caused by the check-in (deterministic regen, not a random
// reshuffle) and comes back described in signalAdjustments.checkInChange.
export async function applyCheckInToPlan(): Promise<DailyPlan> {
  return apiClient<DailyPlan>("/api/meals/daily-plan/apply-check-in", {
    method: "POST",
  });
}

export async function getTomorrowPlan(): Promise<DailyPlan> {
  return apiClient<DailyPlan>("/api/meals/daily-plan/tomorrow");
}

export async function replaceMealInSlot(
  planId: string,
  slot: string,
  excludeMealIds: string[],
  replaceMealId: string,
): Promise<DailyPlan> {
  return apiClient<DailyPlan>("/api/meals/daily-plan/replace", {
    method: "POST",
    body: JSON.stringify({ planId, slot, excludeMealIds, replaceMealId }),
  });
}

export async function toggleMealEaten(
  dailyPlanId: string,
  slot: string,
  mealId: string,
): Promise<{ ate: boolean }> {
  return apiClient<{ ate: boolean }>("/api/meals/eaten/toggle", {
    method: "POST",
    body: JSON.stringify({ dailyPlanId, slot, mealId }),
  });
}

// --- Meal Detail API ---

export interface MealNutrient {
  name: string;
  amount: number;
  unit: string;
  percentOfDailyNeeds?: number;
}

export interface MealDetail {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  imageAsset: string | null;
  prepTime: number | null;
  cookTimeMinutes: number | null;
  readyInMinutes: number | null;
  servingsMin: number | null;
  calories: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  carbsGrams: number | null;
  fiberGrams: number | null;
  nutrientsJson: MealNutrient[] | null;
  diets?: { id: string; name: string }[];
}

export interface MealIngredient {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientImageUrl: string | null;
  ingredientCategory: string | null;
  quantity: number;
  measurement: string;
  representText: string | null;
}

/**
 * Where the member opened Recipe Details from.
 *
 * 🔑 Mirrors the backend's whitelist for `recipe_viewed`'s `source_surface`
 * (EVENTS r15). The server rejects anything not on its list and records null, so
 * a value added here without being added there is silently lost — keep the two
 * in step.
 *
 * 📌 "explore" and "grocery_list" are in the contract but nothing navigates to
 * Recipe Details from them yet.
 */
export type RecipeViewSurface =
  | "my_plan"
  | "home"
  | "saved_meals"
  | "ester_chat"
  | "explore"
  | "grocery_list";

export async function getMealDetail(
  mealId: string,
  sourceSurface?: RecipeViewSurface,
): Promise<MealDetail> {
  // The server emits `recipe_viewed` off this request — it is the one call made
  // once per Recipe Details open — and only the client knows which surface the
  // member came from, so it rides along as a query parameter.
  const query = sourceSurface ? `?source=${encodeURIComponent(sourceSurface)}` : "";
  return apiClient<MealDetail>(`/api/meals/${mealId}${query}`);
}

export async function getMealIngredients(
  mealId: string,
): Promise<MealIngredient[]> {
  return apiClient<MealIngredient[]>(`/api/meals/${mealId}/ingredients`);
}

// --- Meal Feedback API ---

export interface MealFeedbackPayload {
  mealId: string;
  planId?: string;
  slot: string;
  feedback: "up" | "down";
  tags?: string[];
  freeText?: string;
}

export async function submitMealFeedback(
  payload: MealFeedbackPayload,
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>("/api/meals/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removeMealFeedback(mealId: string): Promise<void> {
  await apiClient(`/api/meals/feedback/${mealId}`, { method: "DELETE" });
}

export async function getMealFeedback(
  mealIds: string[],
): Promise<Record<string, { feedback: "up" | "down"; tags: string[] }>> {
  if (mealIds.length === 0) return {};
  return apiClient<Record<string, { feedback: "up" | "down"; tags: string[] }>>(
    `/api/meals/feedback?mealIds=${mealIds.join(",")}`,
  );
}

// --- Daily Plan Offline Cache ---

export async function cacheDailyPlan(plan: DailyPlan): Promise<void> {
  await AsyncStorage.setItem(DAILY_PLAN_CACHE_KEY, JSON.stringify(plan));
}

export async function getCachedDailyPlan(): Promise<DailyPlan | null> {
  const raw = await AsyncStorage.getItem(DAILY_PLAN_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyPlan;
  } catch {
    return null;
  }
}

/* ── Follow-through: the one Meals question per day (P0 #10) ───────────────
 *
 * SCORE CONTRACT r6 — Meals stores the answer VERBATIM and Reset Score owns
 * the 1.0 / 0.5 / 0.0 mapping, the trailing-14-day lookback and the
 * minimum-evidence rule. The client must never send a number.
 */

/** SCORE CONTRACT r6. The wire values; the labels live with the card. */
export type FollowThroughResponse = "on_plan" | "mostly" | "not_really";

export interface PendingPrompt {
  /** False when the day's budget is spent or nothing is eligible. */
  ask: boolean;
  /** Which kind of question won the day — Score's ask wins when due. */
  type?: string;
  promptId?: string;
}

/**
 * Today's one question, if there is one.
 *
 * 🔑 The BUDGET IS THE SERVER'S. START HERE r10 — "one prompted Meals question
 * per day ACROSS the system" — so eligibility is centralised and the client
 * only asks what, if anything, is due. Deciding here would let a taste prompt
 * and a Score sample stack on the same day, which TEST CASES M24 forbids.
 *
 * 📌 Idempotent: if today's question was already served and is unanswered, the
 * same promptId comes back rather than a second prompt being logged.
 */
export async function getPendingPrompt(): Promise<PendingPrompt> {
  return apiClient<PendingPrompt>("/api/meals/prompts/pending");
}

/** Record the answer. Answering again the same day CORRECTS it. */
export async function recordFollowThrough(
  response: FollowThroughResponse,
  promptId?: string,
): Promise<void> {
  await apiClient("/api/meals/follow-through", {
    method: "POST",
    body: JSON.stringify({ response, promptId }),
  });
}

/**
 * Close the prompt without answering.
 *
 * 🔴 SILENCE IS NOT A ZERO. LEARNING SIGNALS r24 is a hard rule: no response
 * creates missing evidence only, never a dislike, a rejection or a low
 * follow-through. This marks the day asked so the member is not asked twice;
 * it deliberately writes NO sample. TEST CASES M23: "no sample; no penalty".
 */
export async function dismissPrompt(promptId: string): Promise<void> {
  await apiClient(`/api/meals/prompts/${promptId}/dismiss`, { method: "POST" });
}

/* ── Fit rejection capture (P0 #11) ────────────────────────────────────────
 *
 * EVENTS r11 — "Member explicitly rejects planned meal". Rejecting is NOT
 * swapping: the route's own doc says "capture only — this does NOT change the
 * plan. Swapping the meal out is a separate action."
 */

export interface RejectionReasonOption {
  /** The stored code. Score-facing; never shown to a member. */
  reason: string;
  /**
   * 🔴 THE ONLY STRING A MEMBER MAY SEE. Bryan's "Member wording" column from
   * SWAPS + EDITS r18–r24, served by the API so this client never hardcodes
   * copy that is his to change.
   */
  label: string;
  /** Internal shorthand — "Prep friction". Never render this. */
  meaning: string;
  /** Visible so a caller can SEE the classification, never make one. */
  fitQualifying: boolean;
}

/** The drawer's options, in Bryan's order. */
export async function getRejectionReasons(): Promise<RejectionReasonOption[]> {
  return apiClient<RejectionReasonOption[]>("/api/meals/rejections/reasons");
}

/**
 * Record why a planned meal did not work.
 *
 * 🔑 Capture only — the plan is untouched. A member who also wants it gone
 * swaps or removes it separately, which is why this does not close the plan
 * sheet onto a changed week.
 *
 * 🔴 The client sends the CODE and never a judgement: whether a reason can
 * become Reset Score Fit evidence is decided server-side from the reason
 * table. Meals emits facts; Score interprets.
 */
export async function recordRejection(params: {
  reason: string;
  mealId?: string;
  slotType?: string;
  freeText?: string;
}): Promise<void> {
  await apiClient("/api/meals/rejections", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/* ── Ingredient substitution (P0 #8b) ──────────────────────────────────────
 *
 * SERVINGS + ING r7 — an approved substitution is a pre-authored alternative
 * that passes restrictions/safety, with Ester explaining in one line. It
 * changes the planned recipe INSTANCE: new plan revision, same Score version.
 */

export interface SubstituteSuggestion {
  /** A canonical ingredient id. Send this back to apply the swap. */
  ingredientId: string;
  /** The catalogue's own wording — not the model's paraphrase. */
  name: string;
  /** Ester's one line about why it works in THIS dish. */
  rationale: string;
  /** How much to use, in plain cooking terms. */
  quantity: string;
}

/**
 * Up to three substitutes for one ingredient.
 *
 * 🔑 Every option is a real canonical ingredient: the server builds the pool
 * from the ingredient table, filters it against the member's restrictions, and
 * Ester only chooses among it. So accepting one takes the STRUCTURED path and
 * actually recomputes nutrition and grocery, rather than being stored as a
 * note.
 *
 * 🔴 An empty list is a real answer, not an error — the server returns one
 * when it has no candidates, when Ester declines, or when a restriction cannot
 * be verified. Show no drawer rather than inventing options.
 */
export async function getSubstituteSuggestions(params: {
  plannedMealId: string;
  mealPlanId: string;
  fromIngredientId: string;
  amount?: string;
  recipeTitle?: string;
}): Promise<SubstituteSuggestion[]> {
  const q = new URLSearchParams({
    mealPlanId: params.mealPlanId,
    fromIngredientId: params.fromIngredientId,
  });
  if (params.amount) q.set("amount", params.amount);
  if (params.recipeTitle) q.set("recipeTitle", params.recipeTitle);
  return apiClient<SubstituteSuggestion[]>(
    `/api/meals/my-plan/meals/${params.plannedMealId}/substitutions/suggestions?${q}`,
  );
}

/**
 * Apply one.
 *
 * 📌 Sends `toIngredientId`, never free text. The suggestion already carries a
 * canonical id, so there is nothing to resolve and nothing to guess — which is
 * the whole reason the suggestions come from a server-built pool.
 */
export async function applySubstitution(params: {
  plannedMealId: string;
  mealPlanId: string;
  fromIngredientId: string;
  toIngredientId: string;
}): Promise<void> {
  await apiClient(`/api/meals/my-plan/meals/${params.plannedMealId}/substitutions`, {
    method: "POST",
    body: JSON.stringify({
      mealPlanId: params.mealPlanId,
      fromIngredientId: params.fromIngredientId,
      toIngredientId: params.toIngredientId,
    }),
  });
}

// --- Explore (P0 #7) ---

/**
 * EXPLORE r5's search index, as the server returns it.
 *
 * 📌 No calories or macros, deliberately. The Do-Not-Build list is explicit —
 * *"User-facing calories/macros: Do not build. Energy is internal only"* — so
 * the endpoint does not send them and nothing here can render them by accident.
 */
export interface ExploreResult {
  recipeId: string;
  /** 🔑 Required by add-to-plan. Every result has one, by construction: the
   *  search only returns published recipe VERSIONS. */
  recipeVersionId: string;
  title: string;
  imageAssetId: string | null;
  cuisine: string | null;
  slots: string[];
  readyInMinutes: number | null;
  diets: string[];
  saved: boolean;
}

export interface ExploreSearchResponse {
  results: ExploreResult[];
  totalCount: number;
  limit: number;
  offset: number;
  /** Null on the last page — the server derives this from the real total. */
  nextOffset: number | null;
}

export interface ExploreBrowseRow {
  key: string;
  title: string;
  query: Record<string, string | number | boolean | null>;
  /** The row's real size, from the row's own query. */
  count: number;
  /** A photo of the row's first actual recipe. */
  imageUrl: string | null;
}

export interface ExploreSection {
  key: string;
  title: string;
  style: string;
  rows: ExploreBrowseRow[];
}

export interface ExploreFilters {
  q?: string;
  cuisine?: string;
  slot?: string;
  maxMinutes?: number;
  diet?: string;
  savedOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 🔑 The sections ARE the layout (EXPLORE r6, server-driven), so the screen
 * renders whatever comes back rather than hard-coding "Meal Type"/"Cuisine".
 * New merchandising is a backend change, not an app release.
 */
export async function getExploreSections(): Promise<ExploreSection[]> {
  const res = await apiClient<{ sections?: ExploreSection[] }>(
    "/api/meals/explore/rows",
  );
  return res.sections ?? [];
}

export async function searchExplore(
  filters: ExploreFilters,
): Promise<ExploreSearchResponse> {
  // Built with URLSearchParams so a query containing & or = cannot break the
  // request — members type whatever they like into a search bar.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return apiClient<ExploreSearchResponse>(
    `/api/meals/explore/search${qs ? `?${qs}` : ""}`,
  );
}

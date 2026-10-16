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

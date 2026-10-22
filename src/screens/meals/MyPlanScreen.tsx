import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPrepTime } from "../../utils/prepTime";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import {
  MainStackParamList,
  MainTabParamList,
} from "../../navigation/MainNavigator";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useResetWindow } from "../../hooks/useResetWindow";
import {
  getMyPlan,
  addMealToPlan,
  removePlannedMeal,
  movePlannedMeal,
  findMovedSlot,
  swapPlannedMeal,
  findSwappedSlot,
  rebuildWeek,
  buildTags,
  MyPlanResponse,
  MyPlanRecipe,
  MyPlanSlot,
  MealSlotType,
} from "../../services/myPlan";
import {
  getRejectionReasons,
  recordRejection,
  RejectionReasonOption,
  getFavorites,
  addFavorite,
  removeFavorite,
  MealFavorite,
} from "../../services/meals";
import ReasonDrawer from "../../components/ReasonDrawer";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Path } from "react-native-svg";
import { BookmarkIcon } from "../../components/BookmarkIcon";
import { logEvent } from "../../services/amplitude";
import { ApiError } from "../../services/apiClient";

/**
 * 🔑 Typed against the real param list, NOT `any`.
 *
 * The first version of this screen used `NativeStackScreenProps<any, "MyPlan">`
 * and navigated to RecipeDetail with `{ recipeId, versionId }`. That route
 * takes `{ meal: Meal }` and destructures it on arrival, so the tap would have
 * pushed a screen with `undefined` params. `any` meant tsc said nothing, and
 * the device walk never tapped a row. Typing it makes the compiler catch the
 * next one.
 *
 * 🔑 COMPOSITE because this is a TAB whose pushes land on the stack ABOVE the
 * tabs. `BottomTabScreenProps` alone would type `navigate("RecipeDetail")` as
 * an error (it is not a tab), and widening to `any` would give back exactly the
 * silence described above. Composing the two keeps every push checked.
 */
type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Meals">,
  NativeStackScreenProps<MainStackParamList>
>;

/**
 * My Plan — the weekly plan surface. Lang's frame 5039:29721 (page 🟢 Meals).
 *
 * ✅ THE MEALS TAB ROOT since 2026-10-15 — Bryan: "Let's add Meals to the
 * current tab bar now." Lang's frame draws it inside a four-tab bar (Today ·
 * Meals · Progress · Ester); we ship it in the three-tab bar we have, and move
 * to hers once Progress, Account and the Ester decision are settled. The legacy
 * `daily-plan` surface still runs in parallel and is untouched by this.
 *
 * 🔑 The week is fetched ONCE and paged client-side by the day selector. The
 * response already carries all 7 days, and MY PLAN r6 forbids re-reading on
 * interaction: *"Never regenerate just because screen opened"* / *"No
 * automatic data mutation."* A per-day fetch would risk exactly that.
 */

/**
 * Display names for the semantic slots.
 *
 * 🔑 MY PLAN r16: the model must stay semantic (`first_meal · midday · evening
 * · snack`) because Windows and real schedules vary and the backend must not
 * *"assume exactly 3 meals/day"* — but *"Display can still say
 * Breakfast/Lunch/Dinner when appropriate."* So the mapping lives HERE, in the
 * view, and never leaks back into the model.
 */
const SLOT_LABEL: Record<MealSlotType, string> = {
  first_meal: "Breakfast",
  midday: "Lunch",
  evening: "Dinner",
  snack: "Snack",
};

/**
 * The order a day READS in, which is not the order rows were written in.
 *
 * 🔴 `sortOrder` is an insertion counter: both `addMeal` and `moveMeal` set it
 * to `max(sortOrder) + 1`, so anything added to a day lands LAST. Sorting the
 * view by it alone put a restored lunch under dinner — caught walking the tab
 * 2026-10-21 after an Undo, and it is not an Undo bug: adding a breakfast from
 * "Add to plan" shows it below dinner the same way.
 *
 * 📌 `sortOrder` still breaks ties INSIDE a slot, which is the one thing it is
 * genuinely good for — two dinners on one day keep the order they were added.
 * MY PLAN r16 keeps the model semantic, so this ranking lives in the view
 * beside `SLOT_LABEL` rather than becoming a column.
 */
const SLOT_RANK: Record<MealSlotType, number> = {
  first_meal: 0,
  midday: 1,
  evening: 2,
  snack: 3,
};

const DAY_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Semantic slot -> the legacy `Meal["time"]` vocabulary.
 *
 * 🔴 This mapping exists ONLY to hand a value to `RecipeDetail`, whose route
 * param is the legacy `Meal`. It is a boundary adapter, not a model: the plan
 * stays semantic (MY PLAN r16 forbids assuming three meals a day) and nothing
 * reads this back. `snack` has no legacy equivalent and falls back to lunch,
 * which only affects a label the detail screen re-fetches anyway.
 */
const SLOT_TO_LEGACY_TIME: Record<MealSlotType, "breakfast" | "lunch" | "dinner" | "snack"> = {
  first_meal: "breakfast",
  midday: "lunch",
  evening: "dinner",
  snack: "snack",
};

/** `2026-08-16` -> `16`, without constructing a Date (no timezone shifting). */
function dayOfMonth(isoDate: string): string {
  const d = isoDate.slice(8, 10);
  return d.startsWith("0") ? d.slice(1) : d;
}

/** `2026-08-16` -> weekday index 0..6, computed in UTC so it cannot drift. */
function weekdayIndex(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/** `2026-08-16` -> `Aug 16`. */
/**
 * Today as the plan means it — a LOCAL calendar date.
 *
 * 🔴 NOT `new Date().toISOString().slice(0, 10)`, which is UTC. MY PLAN r15 is
 * explicit that "every planned meal belongs to one local calendar day", and in
 * any timezone behind UTC the ISO string flips to tomorrow during the evening:
 * at 8pm in New York it already reads the next day. Anything comparing a plan
 * date against it then treats TODAY as past — which would have quietly locked
 * the current day's meals every evening for most of our members.
 */
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function shortDate(isoDate: string): string {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${dayOfMonth(isoDate)}`;
}

/** `12:00` -> `12pm`, `09:30` -> `9:30am`. */
function friendlyTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12}${suffix}` : `${h12}:${mStr}${suffix}`;
}

export function MyPlanScreen({ navigation }: Props) {
  const [plan, setPlan] = useState<MyPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The current plan, readable from inside a callback without re-creating it.
   *
   * 🔑 `reloadPlan` has to know whether a week is already on screen, and it is
   * memoised with an empty dep list on purpose (every action calls it, and
   * re-creating it would churn `doMove`/`doSwap`/`doRemove` on every render).
   * A ref is how it reads `plan` without taking it as a dependency.
   */
  const planRef = useRef<MyPlanResponse | null>(null);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  const [selected, setSelected] = useState(0);
  const { state: windowState } = useResetWindow();

  useEffect(() => {
    let cancelled = false;
    // 🔴 Called exactly once, on open. See getMyPlan() — this request can
    // GENERATE the week, so it must never run speculatively.
    getMyPlan()
      .then((p) => {
        if (cancelled) return;
        setPlan(p);
        // Land on today when the week contains it, not always on Sunday.
        const today = localToday();
        const i = p.days.findIndex((d) => d.date === today);
        setSelected(i >= 0 ? i : 0);
      })
      .catch((e) => !cancelled && setError(e?.message ?? "Could not load your plan."));
    return () => {
      cancelled = true;
    };
  }, []);

  /** The transient failure bar. Declared here because `actionFailed` writes it. */
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * An ACTION failed. Say so and leave the week alone.
   *
   * 🔴🔴 These used to call `setError`, which returns a full-screen error view
   * instead of the plan — and because the Meals tab keeps this screen mounted,
   * nothing ever cleared it. One failed move and My Plan was replaced by a
   * title and a sentence **for the rest of the app session**; switching tabs
   * and coming back did not help, only a force-quit did. Found by Cole on his
   * S24 on 2026-10-21, moving a meal to the next day.
   *
   * 🔑 The distinction that was missing: `error` means *we have no plan to
   * show*. A failed action is not that — the week on screen is still valid and
   * still theirs, so the failure belongs in the transient notice bar.
   *
   * 📌 It also LOGS. The old catches took no argument, so the real reason was
   * discarded at the only point we had it, and "that meal could not be moved"
   * was all anyone — member or engineer — ever got.
   */
  const actionFailed = useCallback((message: string, cause?: unknown) => {
    if (cause) console.warn(`[MyPlan] ${message}`, cause);
    setNotice(message);
  }, []);

  /**
   * Re-read the plan after the MEMBER changed it.
   *
   * 🔑 This is not the speculative call `getMyPlan()` warns about. r6's "Never
   * regenerate just because screen opened" forbids reading on mount/prefetch;
   * re-reading as the direct consequence of an edit the member just made is
   * the opposite case, and it is unavoidable here — see below.
   *
   * 🔴🔴 IT IS UNAVOIDABLE BECAUSE PLANNED-MEAL IDS DIE ON EVERY EDIT.
   * `commitRevision` writes fresh rows per revision, so after a move the id we
   * just used no longer exists. Keeping the old `plan` in state would leave
   * every row pointing at dead ids and the next edit would 400.
   */
  const reloadPlan = useCallback(async (): Promise<MyPlanResponse | null> => {
    try {
      const p = await getMyPlan();
      setPlan(p);
      return p;
    } catch (e: any) {
      /**
       * 🔴 A FAILED REFRESH IS NOT AN EMPTY SCREEN. This used to call
       * `setError` unconditionally, so a lost response on the re-read after a
       * move, swap, remove or rebuild replaced a perfectly good week with the
       * error view — the same dead end `actionFailed` was written to stop,
       * surviving one call deeper. The action itself may well have COMMITTED;
       * blanking the plan is then both wrong and alarming.
       *
       * 🔑 `setError` is only right when there is nothing to show.
       */
      if (planRef.current) {
        actionFailed("Could not refresh your plan.", e);
      } else {
        setError(e?.message ?? "Could not refresh your plan.");
      }
      return null;
    }
  }, [actionFailed]);

  /**
   * REARRANGE (MY PLAN r10). The slot the member is moving, plus the day it
   * started on so an undo knows where to put it back.
   */
  const [acting, setActing] = useState<{ slot: MyPlanSlot; onDate: string } | null>(null);

  /**
   * The rejection drawer's options (P0 #11).
   *
   * 🔴 Fetched, never hardcoded. The labels are Bryan's "Member wording" from
   * SWAPS + EDITS r18–r24 and the server owns them, so copy he changes does
   * not need an app release. An empty list simply means no drawer.
   */
  const [reasons, setReasons] = useState<RejectionReasonOption[]>([]);
  const [rejecting, setRejecting] = useState(false);
  /** Which picker is open, once the member has chosen a verb. */
  const [picker, setPicker] = useState<"move" | "swap" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * 🔴 UNDO IS REQUIRED, not a nicety — r10 lists it in the member's column
   * ("Member can: Undo"), as does r9 for swap. There is no undo endpoint, so
   * it is the inverse move, and it needs the meal's NEW id, which only a
   * re-read can give us.
   */
  const [undo, setUndo] = useState<
    | { kind: "move"; plannedMealId: string; toDate: string; title: string }
    | { kind: "swap"; plannedMealId: string; recipeVersionId: string; title: string }
    /**
     * 🔑 Remove's undo carries the MEAL, not an id — there is no row left to
     * point at. Putting it back is an add, so it needs everything the add
     * route wants, captured before the removal.
     */
    | {
        kind: "remove";
        localDate: string;
        slotType: MealSlotType;
        recipeVersionId: string;
        servings: number;
        title: string;
      }
    | null
  >(null);

  /**
   * Which recipes the member has saved.
   *
   * 🔑 Saved state is NOT on `MyPlanRecipeDto` and deliberately does not need
   * to be. `/api/meals/favorites` already returns the saved meals by id, so the
   * client intersects locally. Unlike `diets`, this cost no DTO change and no
   * deploy — which also means no "new client, old server" window, the failure
   * that bit the tag work. [[project_meals_tab]]
   *
   * 📌 The design calls this "Saved" and our API calls it "favorites". They are
   * the same thing: the handoff sheet specifies **ONE Save action**, so this
   * surfaces the existing save rather than introducing a second concept.
   */
  /**
   * REBUILD (MY PLAN r11) — Rule 1's fourth verb.
   *
   * 🔑 Two pieces of state, and the split is the spec. The row's member column
   * is *"Accept / continue editing"* — NOT "Undo", which r9 and r10 both list.
   * So a rebuild is confirmed BEFORE it happens and simply announced after;
   * there is nothing to take back, and `notice` is a statement, not an offer.
   */
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  /**
   * The saved meals themselves, for the swap picker.
   *
   * 🔑 SAVED MEALS is a sanctioned swap source — "Direct browse source. Member
   * may add/swap explicitly" (CURRENT). Explore is too, but has no backend
   * yet. The same fetch already runs for the bookmarks, so this is free.
   */
  const [savedMeals, setSavedMeals] = useState<MealFavorite[]>([]);

  /**
   * Re-read saved state on every focus, not just on mount.
   *
   * Recipe Details carries its own bookmark, so a member can open a row, save
   * the recipe there and come straight back — the row behind must not still
   * show it unsaved. This is safe to repeat because it hits the favorites
   * endpoint ONLY; `getMyPlan()` stays a once-on-open call, since that request
   * can generate the week (MY PLAN r6: "Never regenerate just because screen
   * opened").
   */
  useEffect(() => {
    const load = () => {
      // The drawer's options. Fetched once on focus with everything else;
      // a failure just means the row opens an empty drawer, never a crash.
      getRejectionReasons()
        .then(setReasons)
        .catch(() => {});

      getFavorites()
        .then((favs) => {
          setSavedIds(new Set(favs.map((f) => f.id)));
          setSavedMeals(favs);
        })
        // Saved state is decoration on a row that works without it; a failure
        // here must never blank the plan.
        .catch(() => {});
    };
    load();
    return navigation.addListener("focus", load);
  }, [navigation]);

  const toggleSaved = useCallback(
    async (recipe: MyPlanRecipe) => {
      const next = !savedIds.has(recipe.id);
      // Named for THIS entry point rather than reusing Home's or Recipe
      // Details' event, so the three bookmarks stay countable apart — the same
      // reason `home_recipe_detail_favoriteCTA` exists separately.
      logEvent("myplan_meal_favoriteCTA", {
        mealId: recipe.id,
        mealName: recipe.title,
        action: next ? "favorite" : "unfavorite",
      });
      setSavedIds((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(recipe.id);
        else copy.delete(recipe.id);
        return copy;
      });
      try {
        if (next) await addFavorite(recipe.id);
        else await removeFavorite(recipe.id);
      } catch {
        // Put the pill back the way it was; the member's tap did not land.
        setSavedIds((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(recipe.id);
          else copy.add(recipe.id);
          return copy;
        });
      }
    },
    [savedIds],
  );

  /**
   * Perform the move, then re-read and arm the undo.
   *
   * 🔑 The destination row is found by `findMovedSlot`, which relies on the
   * server appending the meal to the end of the destination day. That is the
   * documented behaviour ("lands at the end … so a move never silently
   * reorders the meals already there"), and it is what makes the moved meal
   * identifiable when the same recipe appears twice in a day.
   */
  const doMove = useCallback(
    async (slot: MyPlanSlot, fromDate: string, toLocalDate: string) => {
      if (!plan || busy) return;
      setBusy(true);
      setActing(null);
      setPicker(null);
      try {
        await movePlannedMeal({
          plannedMealId: slot.id,
          mealPlanId: plan.mealPlanId,
          toLocalDate,
        });
        const fresh = await reloadPlan();
        const landed =
          fresh && slot.recipe
            ? findMovedSlot(fresh, toLocalDate, slot.recipe.versionId)
            : null;
        // No landed row means the plan moved under us; drop the undo rather
        // than offering one that would act on a stale id.
        setUndo(
          landed && slot.recipe
            ? { kind: "move", plannedMealId: landed.id, toDate: fromDate, title: slot.recipe.title }
            : null,
        );
        const i = (fresh?.days ?? []).findIndex((d) => d.date === toLocalDate);
        if (i >= 0) setSelected(i);
      } catch (e) {
        actionFailed("That meal could not be moved.", e);
      } finally {
        setBusy(false);
      }
    },
    [plan, busy, reloadPlan],
  );

  /**
   * REBUILD the week (MY PLAN r11).
   *
   * 🔑 This is the one place allowed to reach the generation path on purpose.
   * r6's *"Never regenerate just because screen opened"* bans the SPECULATIVE
   * call; r11 is its counterpart — *"Member explicitly chooses rebuild"* —
   * which is why this is reachable only from a control the member pressed and
   * then confirmed.
   *
   * 🔑 The server holds the days before the member's local today — r6 scopes
   * member editing to *"any future/current planned meal"*, and a rebuild is
   * one of r5's member edit verbs, not an exception to them. So this redraws
   * today onward and the week's earlier days come back unchanged.
   *
   * The endpoint returns the whole new week, so state is replaced from the
   * response instead of re-read. That is not an optimisation:
   * 🔴🔴 EVERY PLANNED-MEAL ID IN THE OLD WEEK IS NOW DEAD — a revision writes
   * fresh rows — so an armed undo from a previous swap or move would act on
   * ids that no longer exist. It is cleared here rather than left to 400.
   */
  const doRebuild = useCallback(async () => {
    // `plan` is non-null for the control to exist at all; the guard keeps the
    // event honest rather than logging an empty week.
    if (!plan || busy) return;
    setConfirmRebuild(false);
    setBusy(true);
    logEvent("myplan_rebuildWeekCTA", { weekStart: plan.weekStart });
    try {
      const fresh = await rebuildWeek();
      setPlan(fresh);
      setUndo(null);
      // The dates are unchanged — a rebuild redraws the same week — so the
      // selected day index stays valid and the member keeps their place.
      // 📌 BRYAN'S COPY (Slack, 2026-10-16), replacing my placeholder "…is
      // fresh." He owns copy, and this was the last string on the flow still
      // in my voice. "Ready" is also his register elsewhere — the onboarding
      // Screen Copy sheet says "Your first meal is ready."
      // 🔑 "The REST of your week" is load-bearing, not a flourish: the days
      // behind the member are deliberately untouched (r6), so the notice must
      // not claim the whole week was redrawn.
      setNotice("The rest of your week is ready.");
    } catch (e) {
      actionFailed("Your week could not be rebuilt.", e);
    } finally {
      setBusy(false);
    }
  }, [busy, plan]);

  /** The notice is an announcement, not an offer — it clears itself. */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /**
   * The undo offer expires too — it used to sit there forever.
   *
   * 🔴🔴 `notice` had a timer from the start and `undo` never did, so an undo
   * bar stayed until the member tapped it or acted again. Observed on Cole's
   * S24 on 2026-10-21: a bar armed at 21:52 was still on screen at 22:39 —
   * 47 minutes, surviving a switch to another app and back, because the Meals
   * tab keeps this screen mounted. Two ways that bites:
   *   · it covers a row of the week for as long as it is up, and
   *   · an hour later it is still live, so a stray tap silently reverses a
   *     change the member had long since decided to keep. That happened to me
   *     while testing this very screen.
   *
   * 🔑 Longer than the notice on purpose. There is no undo endpoint — both
   * move and swap write a new revision — so once this bar goes the only way
   * back is to redo the action by hand, and it should not vanish mid-reach.
   */
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  /**
   * SWAP — replace this slot's recipe with a saved meal (MY PLAN r9).
   *
   * 🔑 The undo locator is exact here, unlike a move: a swap PRESERVES the
   * slot, so the meal is still on the same day at the same `sortOrder`.
   */
  const doSwap = useCallback(
    async (slot: MyPlanSlot, onDate: string, fav: MealFavorite) => {
      if (!plan || busy || !fav.currentVersionId || !slot.recipe) return;
      const previousVersionId = slot.recipe.versionId;
      setBusy(true);
      setActing(null);
      setPicker(null);
      try {
        await swapPlannedMeal({
          plannedMealId: slot.id,
          mealPlanId: plan.mealPlanId,
          recipeVersionId: fav.currentVersionId,
        });
        const fresh = await reloadPlan();
        const landed = fresh ? findSwappedSlot(fresh, onDate, slot.sortOrder) : null;
        setUndo(
          landed
            ? {
                kind: "swap",
                plannedMealId: landed.id,
                recipeVersionId: previousVersionId,
                title: fav.name,
              }
            : null,
        );
      } catch (e) {
        actionFailed("That meal could not be swapped in.", e);
      } finally {
        setBusy(false);
      }
    },
    [plan, busy, reloadPlan],
  );

  /**
   * Remove a meal from the day — Bryan, 2026-10-21.
   *
   * 🔑 Undo is owed here by the rule he set on 10-20: the meal LEAVES THE
   * SCREEN, and that is what makes a toast with Undo necessary rather than
   * decorative. Unlike move and swap, there is no row afterwards to re-read,
   * so the undo payload is captured BEFORE the call and the inverse is an add.
   *
   * 🔴 The server refuses to remove the last meal in the plan — a product rule
   * ("My Plan is never empty"), not a failure. It arrives as a 400 like any
   * other, so it is caught and worded for the member.
   *
   * 🔴🔴 It must NOT go through `setError`, which renders a FULL-SCREEN error
   * view and replaces the entire week. Caught on device: refusing the removal
   * blanked My Plan down to a title and one line, so the member lost the
   * screen over a rule they merely bumped into and had to navigate away and
   * back to recover it. A refusal leaves the plan on screen valid and
   * unchanged, so it belongs in the transient `notice` bar — the same one a
   * rebuild uses. Only a 400 is the rule; anything else is a real failure and
   * says so rather than blaming the member's week.
   */
  const doRemove = useCallback(
    async (slot: MyPlanSlot, onDate: string) => {
      if (!plan || busy || !slot.recipe) return;
      setBusy(true);
      setActing(null);
      const restore = {
        kind: "remove" as const,
        localDate: onDate,
        slotType: slot.slotType,
        recipeVersionId: slot.recipe.versionId,
        servings: slot.servings,
        title: slot.recipe.title,
      };
      try {
        await removePlannedMeal({
          plannedMealId: slot.id,
          mealPlanId: plan.mealPlanId,
        });
        await reloadPlan();
        setUndo(restore);
      } catch (e) {
        setUndo(null);
        setNotice(
          e instanceof ApiError && e.status === 400
            ? "That's the only meal left this week. Rebuild the week instead."
            : "That meal could not be removed.",
        );
      } finally {
        setBusy(false);
      }
    },
    [plan, busy, reloadPlan],
  );

  /**
   * Undo — the inverse call, against the id the re-read gave us.
   *
   * 🔴 It cannot reuse the id the member acted on: every revision writes fresh
   * planned-meal rows, so that id is already gone.
   */
  const doUndo = useCallback(async () => {
    if (!plan || !undo || busy) return;
    setBusy(true);
    const target = undo;
    setUndo(null);
    try {
      if (target.kind === "remove") {
        // Put it back where it was, at the servings it had.
        await addMealToPlan({
          mealPlanId: plan.mealPlanId,
          localDate: target.localDate,
          slotType: target.slotType,
          recipeVersionId: target.recipeVersionId,
          servings: target.servings,
        });
      } else if (target.kind === "move") {
        await movePlannedMeal({
          plannedMealId: target.plannedMealId,
          mealPlanId: plan.mealPlanId,
          toLocalDate: target.toDate,
        });
      } else {
        await swapPlannedMeal({
          plannedMealId: target.plannedMealId,
          mealPlanId: plan.mealPlanId,
          recipeVersionId: target.recipeVersionId,
        });
      }
      const fresh = await reloadPlan();
      if (target.kind === "move") {
        const i = (fresh?.days ?? []).findIndex((d) => d.date === target.toDate);
        if (i >= 0) setSelected(i);
      }
    } catch (e) {
      actionFailed("That change could not be undone.", e);
    } finally {
      setBusy(false);
    }
  }, [plan, undo, busy, reloadPlan]);

  const day = plan?.days[selected] ?? null;

  /**
   * Copy for a slot with no recipe. The design shows "Fasting until 12pm" on
   * the empty first meal — that is the Window providing timing context
   * (MY PLAN r5), derived from `plan.openLocalTime` the app already holds.
   * When there is no Window we say nothing rather than inventing a time.
   */
  const emptyCopy = useCallback(
    (slotType: MealSlotType): string | null => {
      if (slotType !== "first_meal") return null;
      const open = windowState?.plan?.openLocalTime;
      return open ? `Fasting until ${friendlyTime(open)}` : null;
    },
    [windowState],
  );

  /**
   * Open the recipe behind a slot.
   *
   * 🔑 Navigates IMMEDIATELY with what the plan already holds and lets
   * RecipeDetailScreen fetch the full record itself, which it does regardless.
   * Fetching here first would add a round-trip before the screen appears and
   * buy nothing. Same shape as `SavedMealsScreen.handleMealPress`.
   *
   * 📌 `calories`/`protein` are required by the legacy `Meal` type and are
   * passed as 0. They are NOT real values and nothing renders them — the
   * nutrition UI was removed from Recipe Details because the spec says
   * `internal_nutrition` is not member-facing. They are only here because the
   * type still demands them, which it does because three OTHER screens still
   * show calories and protein. See project_meals_tab.
   */
  const openRecipe = useCallback(
    (
      recipe: MyPlanRecipe,
      slotType: MealSlotType,
      slot: MyPlanSlot,
      localDate: string,
    ) => {
      navigation.navigate("RecipeDetail", {
        sourceSurface: "my_plan",
        // 🔑 The ONLY entry point with plan context, so the only one where the
        // serving control can save. `slot.id` is the planned_meal row and
        // `slot.servings` is the multiplier already stored.
        plannedMeal: plan
          ? {
              id: slot.id,
              mealPlanId: plan.mealPlanId,
              servings: slot.servings,
              // The slot's own identity, so the screen can find this meal's
              // ingredient substitutions. See the param's own note.
              localDate,
              slotType,
            }
          : undefined,
        meal: {
          id: recipe.id,
          name: recipe.title,
          whyLine: "",
          calories: 0,
          protein: 0,
          // 🔴 null, not 0 — zero is not a cooking time, and `?? 0` is what
          // turned "unknown" into "0 min" on Saved Meals.
          prepTime: recipe.readyInMinutes ?? null,
          time: SLOT_TO_LEGACY_TIME[slotType],
          imageUrl: recipe.imageUrl ?? undefined,
        },
      });
    },
    [navigation, plan],
  );

  /**
   * Open a saved meal from the Saved Meals block.
   *
   * 🔑 Deliberately NO `plannedMeal`: a saved meal is not on the plan, so
   * there is no planned_meal row for the serving control to write to. Passing
   * one would offer a control that silently fails — the same distinction
   * RecipeDetail already draws between a plan entry and every other surface.
   *
   * 📌 `sourceSurface: "my_plan"` because that is where the member tapped.
   * The saved_meals surface is the SavedMeals SCREEN, which sets its own.
   */
  /**
   * Record why a planned meal did not work (P0 #11).
   *
   * 🔴 CAPTURE ONLY — no plan mutation, no revision, no refetch. The route's
   * doc is explicit: "this does NOT change the plan. Swapping the meal out is
   * a separate action." So this closes the sheet and leaves the week exactly
   * as it was; the member chose to tell us something, not to change anything.
   *
   * 🔑 The CODE goes to the server and nothing else. Whether a reason may
   * become Reset Score Fit evidence is decided there, from the reason table —
   * `ate_out` and taste cannot, cost/effort/schedule/family can. Deciding it
   * here would put Score interpretation in the client.
   *
   * 📌 Optimistic close. A failure is swallowed deliberately: the member has
   * said their piece and re-opening a drawer to report a logging problem
   * would make our plumbing their problem. The day's evidence is lost, which
   * is the same "missing evidence" silence already produces — never a wrong
   * signal.
   */
  const rejectMeal = useCallback(
    async (reason: string) => {
      if (rejecting) return;
      setRejecting(true);
      const slot = acting?.slot;
      setPicker(null);
      setActing(null);
      try {
        await recordRejection({
          reason,
          mealId: slot?.recipe?.id,
          slotType: slot?.slotType,
        });
        /**
         * Say it landed. Every other verb leaves a notice; this one closed
         * onto an unchanged week, so it read as a dead button (Cole, S24,
         * 2026-10-21).
         *
         * 🔴🔴 THE COPY MAY NOT PROMISE BETTER MEALS. A rejection is stored,
         * Fit-classified and readable over its own GET — and that is all.
         * `preferenceReasons`, the only reason signal generation consumes
         * (`my-plan.service.ts:247`), is built from **`meal_feedback`**
         * thumbs-down tags; `plan-generation.service.ts` never reads
         * `meal_rejection` at all. "I'll pick better next time" would be a
         * member-facing claim the engine does not honour.
         *
         * 🔑 So it says the two things that ARE true: we heard you, and the
         * meal is still there — which is the question the silence raised.
         *
         * 📌 Only on success, unlike the optimistic close above. A failed
         * record falling silent is the one case where we WANT the member to
         * notice nothing happened, because re-picking re-records it.
         *
         * 📌 Bryan's wording, 2026-10-22: *"Keep the plan unchanged and show a
         * simple 'Feedback saved' toast."*
         */
        setNotice("Feedback saved");
      } catch {
        // Deliberately silent — see above.
      } finally {
        setRejecting(false);
      }
    },
    [rejecting, acting],
  );

  const openSavedMeal = useCallback(
    (fav: MealFavorite) => {
      navigation.navigate("RecipeDetail", {
        sourceSurface: "my_plan",
        meal: {
          id: fav.id,
          name: fav.name,
          whyLine: "",
          calories: fav.calories ?? 0,
          protein: fav.protein ?? 0,
          prepTime: fav.prepTime ?? null,
          time: fav.isBreakfast ? "breakfast" : fav.isLunch ? "lunch" : "dinner",
          imageUrl: fav.imageAsset ?? undefined,
          primaryProtein: fav.primaryProtein ?? undefined,
          cuisineCluster: fav.cuisineCluster ?? undefined,
        },
      });
    },
    [navigation],
  );

  const range = useMemo(() => {
    if (!plan?.days.length) return "";
    const first = plan.days[0].date;
    const last = plan.days[plan.days.length - 1].date;
    return `${shortDate(first)}–${dayOfMonth(last)}`;
  }, [plan]);

  /**
   * No plan to show. This is now the ONLY thing that reaches here — a failed
   * action uses `actionFailed`, because the week it was acting on is still on
   * screen and still valid.
   *
   * 🔴 It needs a way out. The Meals tab keeps this screen mounted, so without
   * one the member is stuck here until they force-quit: switching tabs and
   * coming back returns to the same dead end (observed on device).
   * 🔴 The title also sat flush against the screen edge — `container` carries
   * no padding because the padding lives on `scroll`, which this branch never
   * renders.
   */
  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.errorPad]}>
        <Text style={styles.title}>My Plan</Text>
        <Text style={styles.error}>{error}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => {
            setError(null);
            void reloadPlan();
          }}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={K.bone} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* The frame puts a cart in the header beside the title — it is the
            only route to the grocery list, which is derived from this very
            week, so it belongs here rather than in a tab. */}
        <View style={styles.titleRow}>
          {/* 🔴 NO back control: this is the MEALS TAB ROOT, and Lang's frame
              draws none — a tab is not somewhere you came from.
              The gate that used to stand here was `navigation.canGoBack()`,
              written while My Plan was pushed from Settings so it would delete
              itself the day it became a tab. It does NOT: on a bottom tab
              `canGoBack()` is TRUE whenever a later tab is focused (default
              backBehavior pops to the first tab), so the arrow rendered on the
              tab root and "back" meant "jump to Home". Observed on the
              simulator the first time this ran as a tab.
              ▶ The dead-end that gate was protecting against is gone with the
              pushed route: nothing navigates to My Plan any more, it IS a
              destination. If anything ever pushes it again, give that push its
              own way out — see the note in [[feedback_back_affordances]]. */}
          <View style={styles.titleText}>
            <Text style={styles.title}>My Plan</Text>
            <Text style={styles.range}>{range}</Text>
          </View>
          {/* Lang's Header (Figma 5039:29724) carries a "Buttons" frame on the
              right holding a 40x40 Rounded Icon button — one visible, one
              hidden in the component. She drew no rebuild control anywhere on
              this frame (its only other button is "Explore more meals", which
              has no backend), so placing it is mine: it takes the second slot
              her own header already allows for, at her size.
              ▶ It belongs in the HEADER and not on the day card because a
              rebuild redraws the WHOLE WEEK. Sitting beside the week's date
              range, it reads at the scope it acts on; under a day's meals it
              would read as "rebuild this day", which is not a thing. */}
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => setConfirmRebuild(true)}
              disabled={busy}
              hitSlop={8}
              style={[styles.cartButton, busy && styles.headerButtonBusy]}
              accessibilityRole="button"
              accessibilityLabel="Rebuild the rest of your week"
              accessibilityState={{ disabled: busy }}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                  fill={K.cream}
                />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("GroceryList")}
              hitSlop={8}
              style={styles.cartButton}
              accessibilityRole="button"
              accessibilityLabel="Grocery list"
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"
                  fill={K.cream}
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        <View style={styles.daysRow}>
          {plan.days.map((d, i) => {
            const active = i === selected;
            return (
              <Pressable
                key={d.date}
                onPress={() => setSelected(i)}
                style={[styles.dayChip, active && styles.dayChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={shortDate(d.date)}
              >
                <Text style={[styles.dayLetter, active && styles.dayTextActive]}>
                  {DAY_INITIAL[weekdayIndex(d.date)]}
                </Text>
                <Text style={[styles.dayNum, active && styles.dayTextActive]}>
                  {dayOfMonth(d.date)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          {(day?.slots ?? [])
            .slice()
            .sort(
              (a, b) =>
                (SLOT_RANK[a.slotType] ?? 99) - (SLOT_RANK[b.slotType] ?? 99) ||
                a.sortOrder - b.sortOrder,
            )
            .map((slot, idx) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                first={idx === 0}
                emptyCopy={emptyCopy(slot.slotType)}
                onPress={
                  slot.recipe
                    ? () =>
                        openRecipe(
                          slot.recipe!,
                          slot.slotType,
                          slot,
                          day!.date,
                        )
                    : undefined
                }
                onLongPress={
                  // 🔴 r6: "Edit any future/current planned meal" — a past day
                  // is history, not a draft, so it stays read-only.
                  slot.recipe && day && day.date >= localToday()
                    ? () => setActing({ slot, onDate: day.date })
                    : undefined
                }
                saved={slot.recipe ? savedIds.has(slot.recipe.id) : false}
                onToggleSave={
                  slot.recipe ? () => toggleSaved(slot.recipe!) : undefined
                }
              />
            ))}
          {!day?.slots.length && (
            <Text style={styles.emptyDay}>No meals planned for this day.</Text>
          )}
        </View>

        {/* ── Saved Meals ─────────────────────────────────────────────────
            SAVED MEALS r7, status CURRENT: *"Saved Meals lives inside
            Meals/Explore."* It only lived on Home, inherited from RES-161,
            which predates the Meals handoff — so the surface contradicted a
            canonical row while checklist item 9 read "Save ✅ shipped",
            because that item is about the SAVE CONTRACT, not the placement.

            Lang's frame 5039:29742 ("Frameless Content Block"): a title row
            with "See all", then a horizontal run of 120pt Meal-Stacked cards,
            16 apart, the last one running under a right-edge fade.

            🔑 Costs no request. `savedMeals` is already loaded on focus for
            the swap sheet, so this renders what the screen had in hand.
            📌 The Home card stays until Bryan says otherwise — r7 says Saved
            Meals lives inside Meals, not that it lives ONLY there. */}
        {savedMeals.length > 0 && (
          <View style={styles.savedBlock}>
            <View style={styles.savedHeader}>
              <Text style={styles.savedTitle}>Saved Meals</Text>
              <Pressable
                onPress={() => navigation.navigate("SavedMeals")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="See all saved meals"
              >
                <Text style={styles.savedSeeAll}>See all</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedRow}
            >
              {savedMeals.map((fav) => (
                <Pressable
                  key={fav.id}
                  style={styles.savedCard}
                  onPress={() => openSavedMeal(fav)}
                  accessibilityRole="button"
                  accessibilityLabel={fav.name}
                >
                  <View style={styles.savedThumbWrap}>
                    {fav.imageAsset ? (
                      <Image source={{ uri: fav.imageAsset }} style={styles.savedThumb} />
                    ) : (
                      <View style={[styles.savedThumb, styles.savedThumbEmpty]} />
                    )}
                    {/* Same scrim the plan rows use, and for the same reason:
                        Lang ramps a page-surface gradient up the bottom of every
                        recipe image so a translucent chip can sit on a bright
                        photo. 🔴 It must be a GRADIENT — my first pass used a
                        flat block and it drew a hard band straight across every
                        card on the device. Drawn with react-native-svg to match
                        the plan rows rather than adding a gradient dependency. */}
                    {fav.imageAsset ? (
                      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Defs>
                          <SvgLinearGradient id="savedScrim" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0.31" stopColor={K.brown} stopOpacity={0} />
                            <Stop offset="1" stopColor={K.brown} stopOpacity={0.78} />
                          </SvgLinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" rx="8" fill="url(#savedScrim)" />
                      </Svg>
                    ) : null}
                    <View style={styles.savedBadge} pointerEvents="none">
                      <BookmarkIcon filled color={K.bone} width={11} height={14} />
                    </View>
                  </View>
                  <Text style={styles.savedName} numberOfLines={2}>
                    {fav.name}
                  </Text>
                  {formatPrepTime(fav.prepTime) ? (
                    <Text style={styles.savedTime}>{formatPrepTime(fav.prepTime)}</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Explore more meals ───────────────────────────────────────────
            The last element of Lang's My Plan frame (5039:29721), below Saved
            Meals. It had no backend until P0 #7, which is why it was the one
            thing on her frame still unbuilt.
            🔑 RECIPE LIBRARY rule 2: *"My Plan and Explore are separate
            jobs… Explore never replaces the plan."* So this NAVIGATES and
            changes nothing — adding a recipe stays an explicit action taken
            from Recipe Details. */}
        <Pressable
          style={styles.exploreMore}
          onPress={() => navigation.navigate("Explore")}
          accessibilityRole="button"
          accessibilityLabel="Explore more meals"
        >
          <Text style={styles.exploreMoreText}>Explore more meals</Text>
        </Pressable>
      </ScrollView>

      {/* ── Edit a planned meal: Rule 1's "swap · rearrange" ─────────────
          One chooser, then the picker for the chosen verb. Both write a new
          revision and neither touches the Score plan version (START HERE r7). */}
      <Modal
        visible={!!acting && !picker}
        transparent
        animationType="fade"
        onRequestClose={() => setActing(null)}
      >
        <Pressable style={styles.moveBackdrop} onPress={() => setActing(null)} />
        <View style={styles.moveSheet}>
          <Text style={styles.moveTitle}>Edit this meal</Text>
          <Text style={styles.moveSub} numberOfLines={1}>
            {acting?.slot.recipe?.title ?? ""}
          </Text>
          <Pressable style={styles.moveRow} onPress={() => setPicker("swap")}>
            <Text style={styles.moveRowText}>Swap for a saved meal</Text>
          </Pressable>
          <Pressable style={styles.moveRow} onPress={() => setPicker("move")}>
            <Text style={styles.moveRowText}>Move to another day</Text>
          </Pressable>
          {/* 🔑 A THIRD VERB, not a variant of the other two. Rejecting is
              capture only — EVENTS r11 is "member explicitly rejects planned
              meal", and the route's own doc says it "does NOT change the
              plan". A member who also wants it gone swaps or moves it, which
              is why this sits beside those rather than replacing them.
              📌 This row's wording is OURS; the drawer's is Bryan's. */}
          <Pressable style={styles.moveRow} onPress={() => setPicker("reject")}>
            <Text style={styles.moveRowText}>This didn't work for me</Text>
          </Pressable>
          {/* 🔑 Bryan, 2026-10-21: *"let's use the existing UI patterns"* — so
              Remove is a fourth row on the sheet the member already opens to
              swap or move, not a new gesture to learn. It sits last because it
              is the only one that takes a meal away. */}
          <Pressable
            style={styles.moveRow}
            onPress={() => {
              if (acting) void doRemove(acting.slot, acting.onDate);
            }}
          >
            <Text style={styles.moveRowText}>Remove from this day</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Why didn't this work? (P0 #11) ──────────────────────────────
          EVENTS r11 — "member explicitly rejects planned meal". ONE DRAWER,
          ONE TAP: the route's own doc says the spec forbids a questionnaire,
          so there is no free-text step and no confirm.

          🔴 CAPTURE ONLY. The plan is untouched — rejecting is not swapping,
          and the sheet closes onto the same week it opened on. A member who
          also wants the meal gone uses the other two verbs.

          🔴 THE LABELS ARE BRYAN'S, served by the API (SWAPS + EDITS r18–r24
          "Member wording"). `ReasonDrawer` renders `label` and never
          `meaning`, which is internal shorthand like "Prep friction".

          📌 Moved into the shared `ReasonDrawer` on 2026-10-20, when P0 #9's
          thumbs-down drawer needed the same sheet. The markup and styles are
          the ones this screen shipped with — byte-identical, deliberately, so
          this is not a quiet redesign of a live screen. No `skipLabel` here:
          this drawer is reached by choosing "This didn't work for me", so the
          member already opted in, and the backdrop still dismisses. */}
      <ReasonDrawer
        visible={picker === "reject"}
        title="Why didn't this work?"
        subtitle={acting?.slot.recipe?.title ?? ""}
        options={reasons}
        busy={rejecting}
        onPick={(reason) => void rejectMeal(reason)}
        onDismiss={() => {
          setPicker(null);
          setActing(null);
        }}
      />

      {/* Rearrange (r10). Day picker only — the endpoint also takes a slot
          type, but moving BETWEEN slots needs a slot list Lang has not drawn,
          and the server keeps the slot when only a date is sent. */}
      <Modal
        visible={picker === "move"}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable
          style={styles.moveBackdrop}
          onPress={() => { setPicker(null); setActing(null); }}
        />
        <View style={styles.moveSheet}>
          <Text style={styles.moveTitle}>Move to another day</Text>
          <Text style={styles.moveSub} numberOfLines={1}>
            {acting?.slot.recipe?.title ?? ""}
          </Text>
          {(plan?.days ?? []).map((d) => {
            // Past days cannot receive a meal either — the same r6 rule that
            // makes them read-only as a source.
            const disabled = d.date < localToday() || d.date === acting?.onDate;
            return (
              <Pressable
                key={d.date}
                disabled={disabled || busy}
                onPress={() => acting && doMove(acting.slot, acting.onDate, d.date)}
                style={[styles.moveRow, disabled && styles.moveRowDisabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                accessibilityLabel={`Move to ${shortDate(d.date)}`}
              >
                <Text style={[styles.moveRowText, disabled && styles.moveRowTextDisabled]}>
                  {shortDate(d.date)}
                  {d.date === acting?.onDate ? "  ·  current day" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* Swap (r9). 🔴 NO "why did you swap?" step — "A passive swap alone is
          not a rejection", and asking here would corrupt the Fit signal. */}
      <Modal
        visible={picker === "swap"}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable
          style={styles.moveBackdrop}
          onPress={() => { setPicker(null); setActing(null); }}
        />
        <View style={styles.moveSheet}>
          <Text style={styles.moveTitle}>Swap for a saved meal</Text>
          <Text style={styles.moveSub}>
            {savedMeals.length
              ? "Keeps the same day and slot."
              : "Save a recipe first and it will show up here."}
          </Text>
          <ScrollView style={styles.swapList}>
            {savedMeals.map((f) => {
              // 🔴 `currentVersionId` is nullable, and undefined against an
              // older server. Either way the meal cannot be planned, so show
              // it as unavailable rather than offer it and fail.
              const usable = !!f.currentVersionId;
              return (
                <Pressable
                  key={f.id}
                  disabled={!usable || busy}
                  onPress={() => acting && doSwap(acting.slot, acting.onDate, f)}
                  style={[styles.moveRow, !usable && styles.moveRowDisabled]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !usable }}
                  accessibilityLabel={`Swap in ${f.name}`}
                >
                  <Text
                    style={[styles.moveRowText, !usable && styles.moveRowTextDisabled]}
                    numberOfLines={1}
                  >
                    {f.name}
                    {usable ? "" : "  ·  unavailable"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Rebuild the week (MY PLAN r11) ───────────────────────────────
          Confirmed BEFORE, not undoable after: r11's member column is
          "Accept / continue editing", where r9 and r10 both say "Undo".
          🔴 The copy has to name what it replaces, and what it does NOT. A
          rebuild redraws from today to Sunday: r6 scopes member editing to
          "any future/current planned meal", so the days already behind the
          member are left exactly as they were — the same read-only line this
          screen already draws in the move picker. Swaps and moves from today
          on are gone, which is the part worth warning about.
          📌 BRYAN'S COPY, verbatim (Slack, 2026-10-16), replacing my stand-in.
          The Meals workbook carries no member-facing wording for rebuild —
          a full 25-tab sweep confirmed that — so this came from him directly.
          Do not reword it. His title says "the rest of your week", which
          states the r6 scoping in the member's own terms; he also confirmed
          the scope call itself ("your call is right") against SWAPS + EDITS
          r12's looser "user rebuilds whole week". */}
      <Modal
        visible={confirmRebuild}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmRebuild(false)}
      >
        <Pressable style={styles.moveBackdrop} onPress={() => setConfirmRebuild(false)} />
        <View style={styles.moveSheet}>
          <Text style={styles.moveTitle}>Rebuild the rest of your week?</Text>
          <Text style={styles.moveSub}>
            I'll create a new plan starting today. Earlier days and saved
            meals stay as they are. Any swaps or changes for the rest of this
            week will be replaced.
          </Text>
          <Pressable
            style={styles.moveRow}
            onPress={doRebuild}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Rebuild the rest of your week"
          >
            <Text style={styles.moveRowText}>{busy ? "Rebuilding…" : "Rebuild my week"}</Text>
          </Pressable>
          <Pressable
            style={styles.moveRow}
            onPress={() => setConfirmRebuild(false)}
            accessibilityRole="button"
            accessibilityLabel="Keep my current week"
          >
            <Text style={styles.moveRowTextQuiet}>Keep what I have</Text>
          </Pressable>
        </View>
      </Modal>

      {/* The rebuild's "Accept" half: it announces and clears itself. There is
          deliberately no action here — continuing to edit IS the other half. */}
      {notice && !undo ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>{notice}</Text>
        </View>
      ) : null}

      {/* 🔴 UNDO — required by r9 and r10, and the only way back: both write a
          new revision, so there is nothing to "cancel" afterwards. */}
      {undo ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>
            {undo.kind === "move"
              ? "Moved"
              : undo.kind === "swap"
                ? "Swapped in"
                : "Removed"}{" "}
            {undo.title}
          </Text>
          <Pressable
            onPress={doUndo}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Undo"
          >
            <Text style={styles.undoAction}>{busy ? "…" : "Undo"}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SlotRow({
  slot,
  first,
  emptyCopy,
  onPress,
  onLongPress,
  saved,
  onToggleSave,
}: {
  slot: MyPlanSlot;
  first: boolean;
  emptyCopy: string | null;
  onPress?: () => void;
  /**
   * Rearrange. 🔑 A LONG PRESS, not new chrome on the row: Lang's My Plan
   * frame has no edit affordance, and inventing one would be writing layout
   * rather than implementing it. Long-press keeps her row untouched.
   */
  onLongPress?: () => void;
  saved: boolean;
  onToggleSave?: () => void;
}) {
  const label = SLOT_LABEL[slot.slotType];
  const recipe = slot.recipe;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={[styles.slotRow, !first && styles.slotDivider]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={recipe ? `${label}: ${recipe.title}` : `${label}: empty`}
      accessibilityHint={onLongPress ? "Press and hold to move this meal to another day" : undefined}
    >
      {/* 🔑 The saved badge sits INSIDE the thumbnail, bottom-right, per Lang's
          frame (the "Saved" layer on Recipe Image 1:1). Its own Pressable
          handles the touch, so tapping the bookmark saves rather than opening
          the recipe — RN does not bubble a press to the parent Pressable.
          `hitSlop` brings a 21pt badge up to a comfortable target without
          growing the visual chip. */}
      <View style={styles.thumbWrap}>
        {recipe?.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}
        {/* Legibility scrim. The frame darkens the bottom of every recipe
            thumbnail (a page-surface gradient from 22% to 69% of its height),
            and that is the ONLY reason a translucent light chip with a white
            glyph reads at all. Without it the chip and the bookmark dissolve
            into a bright photo — which is exactly what happened on the first
            device pass. Drawn with react-native-svg to match NextMealScreen's
            `heroScrim` rather than adding a native gradient dependency. */}
        {recipe?.imageUrl ? (
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="thumbScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.31" stopColor={K.brown} stopOpacity={0} />
                <Stop offset="1" stopColor={K.brown} stopOpacity={0.78} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx="8" fill="url(#thumbScrim)" />
          </Svg>
        ) : null}
        {recipe && onToggleSave ? (
          <Pressable
            onPress={onToggleSave}
            hitSlop={8}
            style={styles.savedBadge}
            accessibilityRole="button"
            accessibilityLabel={
              saved ? `Remove ${recipe.title} from saved` : `Save ${recipe.title}`
            }
          >
            <BookmarkIcon filled={saved} color={K.cream} width={13} height={16} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.slotText}>
        <Text style={styles.slotLabel}>{label}</Text>
        {recipe ? (
          <Text style={styles.slotTitle} numberOfLines={2}>
            {recipe.title}
          </Text>
        ) : (
          <Text style={styles.slotEmpty}>{emptyCopy ?? "Nothing planned"}</Text>
        )}
        {/* Tag pills, worded by `buildTags` so this row and the legacy daily
            card label the same meal identically. A meal can legitimately have
            none — render nothing rather than an empty strip. */}
        {recipe ? <TagRow recipe={recipe} /> : null}
      </View>

      {/* 🔑 The chevron follows the ACTION, not the data. While a row cannot
          navigate there must be nothing suggesting it can — the same mistake
          as the back arrow left behind when Opening was deleted: it rendered,
          it was tappable, and it did nothing. It comes back on its own once
          `onPress` is wired. */}
      {/**
       * 🔑 INTERIM, and deliberately easy to delete. Lang's My Plan frame
       * (`5039:29721`) carries no edit affordance, so the four actions Bryan's
       * spec gives a planned meal — swap, move, remove, "didn't work for me" —
       * were reachable only by long-pressing the row, which nobody discovers.
       * Cole chose a "…" button on 2026-10-21 while Lang decides between this,
       * swipe-to-reveal, and moving the actions to Recipe Details.
       *
       * 📌 It opens the SAME sheet as the long press, which stays: the gesture
       * costs nothing, and VoiceOver already announces it. When Lang rules,
       * only this block and its two styles should need to change.
       */}
      {onLongPress ? (
        <Pressable
          onPress={onLongPress}
          hitSlop={10}
          style={styles.rowMenu}
          accessibilityRole="button"
          accessibilityLabel={
            recipe ? `Edit ${recipe.title}` : `Edit ${label.toLowerCase()}`
          }
        >
          <Text style={styles.rowMenuGlyph}>{"···"}</Text>
        </Pressable>
      ) : null}
      {onPress ? <Text style={styles.chevron}>{"›"}</Text> : null}
    </Pressable>
  );
}

function TagRow({ recipe }: { recipe: MyPlanRecipe }) {
  const tags = buildTags(recipe);
  if (!tags.length) return null;
  return (
    <View style={styles.tagRow}>
      {tags.map((t) => (
        <View key={t} style={styles.tag}>
          <Text style={styles.tagText} numberOfLines={1}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.brown },
  centered: { alignItems: "center", justifyContent: "center" },
  // 🔑 paddingBottom clears the floating tab bar (~119pt tall with the safe
  // area on an iPhone 16), the same reserve HomeScreenV2 keeps. As a pushed
  // screen 48 was enough; as a tab root the pill would sit on the last card.
  scroll: { padding: 20, paddingBottom: 120 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  headerButtons: { flexDirection: "row", gap: 8 },
  headerButtonBusy: { opacity: 0.5 },
  titleText: { flex: 1 },
  cartButton: {
    width: 40, height: 40, borderRadius: 999, marginTop: 4,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(243,239,227,0.12)",
  },
  title: {
    fontFamily: fonts.playfair,
    fontSize: 34,
    color: K.bone,
    letterSpacing: -0.5,
  },
  range: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: K.bone,
    opacity: 0.7,
    marginTop: 2,
  },
  /** The error branch renders outside `scroll`, so it carries its own gutter. */
  errorPad: { paddingHorizontal: 20, paddingTop: 8 },
  retry: {
    alignSelf: "flex-start",
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.35)",
  },
  retryText: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    color: K.bone,
  },
  error: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: K.bone,
    opacity: 0.8,
    marginTop: 16,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 6,
  },
  dayChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.22)",
  },
  dayChipActive: { borderColor: K.blue, borderWidth: 1.5 },
  dayLetter: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    color: K.bone,
    opacity: 0.6,
  },
  dayNum: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 16,
    color: K.bone,
    opacity: 0.85,
    marginTop: 2,
  },
  dayTextActive: { opacity: 1 },
  card: {
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.18)",
    overflow: "hidden",
  },
  slotRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  slotDivider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(243,239,227,0.14)",
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: "rgba(243,239,227,0.08)" },
  thumbWrap: { width: 64, height: 64 },
  // Frame: translucent light chip, fully rounded, 4pt inset from the image
  // corner. Light-on-translucent keeps it legible over any photo.
  savedBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
  },
  thumbEmpty: {
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.25)",
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  slotText: { flex: 1 },
  slotLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    color: K.bone,
    opacity: 0.6,
  },
  slotTitle: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 17,
    color: K.bone,
    marginTop: 2,
    letterSpacing: -0.17,
  },
  slotEmpty: {
    fontFamily: fonts.dmSans,
    fontSize: 17,
    color: K.bone,
    opacity: 0.5,
    marginTop: 2,
  },
  chevron: { fontSize: 26, color: K.bone, opacity: 0.5 },
  /**
   * The interim edit affordance. Quieter than the chevron on purpose, so the
   * row still reads "tap to open the recipe" first.
   *
   * 🔴 ANCHORED to the row's top-right, never placed in the flow. In the flow
   * it took ~70pt of width from the title and the row went from
   * "Cheesy Frittata with Spinach, Asparagus and Mushrooms" to
   * "Cheesy Frittata with Spinach, Asp…", pushing the tags onto a second line
   * and making the row taller — i.e. redrawing Lang's row, the exact thing
   * reaching for a long-press was meant to avoid. The slot label leaves that
   * corner empty, so anchored it costs no layout at all.
   *
   * 🔴 NOT the "…" character (U+2026). Three spaced middle dots are drawn from
   * the text font; an ellipsis is one glyph the font may letterspace
   * differently per platform, and a dot-leader character is exactly the shape
   * that went wrong with ▶ on iOS.
   */
  rowMenu: {
    position: "absolute",
    top: 2,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rowMenuGlyph: {
    fontFamily: fonts.dmSans,
    fontSize: 17,
    letterSpacing: 1,
    color: K.bone,
    opacity: 0.55,
  },
  // Pills wrap rather than truncate: on the S24's narrow screen three tags do
  // not fit on one line beside a 64pt thumbnail, and clipping a cuisine name
  // reads as a rendering fault.
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(250,253,254,0.12)",
  },
  tagText: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    color: K.bone,
    opacity: 0.8,
  },
  emptyDay: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    color: K.bone,
    opacity: 0.6,
    padding: 16,
  },

  // ── Rearrange (MY PLAN r10) ───────────────────────────────────────────
  // Borrowed from the Grocery List sheet so the two edit surfaces in Meals
  // feel like one thing rather than two people's work.
  moveBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  moveSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: K.brown,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 18,
    paddingBottom: 34,
    paddingHorizontal: 18,
  },
  moveTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: K.cream,
    letterSpacing: -0.2,
  },
  moveSub: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: K.bone,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 10,
  },
  moveRow: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: "rgba(243,239,227,0.14)" },
  moveRowDisabled: { opacity: 0.35 },
  moveRowText: { fontFamily: fonts.dmSans, fontSize: 16, color: K.cream },
  moveRowTextQuiet: { fontFamily: fonts.dmSans, fontSize: 16, color: "rgba(243,239,227,0.6)" },
  moveRowTextDisabled: { color: K.bone },
  swapList: { maxHeight: 320 },

  undoBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(20,14,14,0.96)",
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.18)",
  },
  undoText: { flex: 1, fontFamily: fonts.dmSans, fontSize: 14, color: K.cream },
  /* ── Explore more meals (Lang 5039:29721, last element) ───────────────
     Full-width ghost button in her bone-on-brown register, matching the
     Saved Meals block's horizontal inset. */
  exploreMore: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 28,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  exploreMoreText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.bone,
  },
  /* ── Saved Meals (Lang 5039:29742) ────────────────────────────────────
     🔴 Her node's text token resolves to #361416 in the LIGHT theme, which is
     the fallback the Figma export prints. My Plan is the DARK surface, and her
     own render of this frame is bone-on-maroon — so these use K.bone, not the
     literal from the export. Taking that hex at face value is the colour drift
     already logged against Recipe Details. */
  savedBlock: { marginTop: 32, gap: 16 },
  savedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  /* Title 3: 20px, tracking -0.2. Her frame uses the sans face here, NOT the
     Playfair that the screen's own h1 uses — this is a section head, a step
     below the page title. */
  savedTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: K.bone,
    letterSpacing: -0.2,
  },
  /* Body 2 medium, 14px. A quiet text link, not a filled button. */
  savedSeeAll: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: K.bone,
    opacity: 0.8,
  },
  savedRow: { gap: 16, paddingRight: 4 },
  savedCard: { width: 120, gap: 12 },
  savedThumbWrap: { width: 120, height: 120 },
  /* 🔑 Her corner radii are deliberately ASYMMETRIC — 8 / 4 / 16 / 4 clockwise
     from top-left. The heavy corner is bottom-right, under the saved badge.
     Rounding all four equally would flatten a detail she repeated on every
     recipe image in the file. */
  savedThumb: {
    width: 120,
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: "rgba(243,239,227,0.08)",
  },
  savedThumbEmpty: { backgroundColor: "rgba(243,239,227,0.12)" },
  /* Body 1: 16px, tracking -0.16. */
  savedName: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: K.bone,
    letterSpacing: -0.16,
  },
  /* 🔑 Body 2 QUADRANT — her time stamp is the SERIF face, not the sans the
     title above it uses. `fonts.quadrant` is that face, already loaded. */
  savedTime: {
    fontFamily: fonts.quadrant,
    fontSize: 14,
    color: K.bone,
    opacity: 0.6,
    letterSpacing: -0.14,
  },
  undoAction: {
    fontFamily: fonts.dmSansBold,
    fontSize: 14,
    color: K.blue,
  },
});

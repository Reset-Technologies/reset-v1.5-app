import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { MainStackParamList } from "../../navigation/MainNavigator";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useResetWindow } from "../../hooks/useResetWindow";
import {
  getMyPlan,
  movePlannedMeal,
  findMovedSlot,
  buildTags,
  MyPlanResponse,
  MyPlanRecipe,
  MyPlanSlot,
  MealSlotType,
} from "../../services/myPlan";
import { getFavorites, addFavorite, removeFavorite } from "../../services/meals";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Path } from "react-native-svg";
import { BookmarkIcon } from "../../components/BookmarkIcon";
import { logEvent } from "../../services/amplitude";

/**
 * 🔑 Typed against the real param list, NOT `any`.
 *
 * The first version of this screen used `NativeStackScreenProps<any, "MyPlan">`
 * and navigated to RecipeDetail with `{ recipeId, versionId }`. That route
 * takes `{ meal: Meal }` and destructures it on arrival, so the tap would have
 * pushed a screen with `undefined` params. `any` meant tsc said nothing, and
 * the device walk never tapped a row. Typing it makes the compiler catch the
 * next one.
 */
type Props = NativeStackScreenProps<MainStackParamList, "MyPlan">;

/**
 * My Plan — the weekly plan surface. Lang's frame 5039:29721 (page 🟢 Meals).
 *
 * 🔴 BEHIND A FLAG AND NOT IN THE TAB BAR. The design puts this in a four-tab
 * bar (Today · Meals · Progress · Ester); the app ships two tabs (Home ·
 * Profile). Restructuring primary navigation is a product decision, so this is
 * registered as an ordinary stack screen until that call is made and the
 * legacy `daily-plan` surface is cut over. Both surfaces run in parallel; this
 * one is dark.
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
      setError(e?.message ?? "Could not refresh your plan.");
      return null;
    }
  }, []);

  /**
   * REARRANGE (MY PLAN r10). The slot the member is moving, plus the day it
   * started on so an undo knows where to put it back.
   */
  const [moving, setMoving] = useState<{ slot: MyPlanSlot; fromDate: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * 🔴 UNDO IS REQUIRED, not a nicety — r10 lists it in the member's column
   * ("Member can: Undo"), as does r9 for swap. There is no undo endpoint, so
   * it is the inverse move, and it needs the meal's NEW id, which only a
   * re-read can give us.
   */
  const [undoMove, setUndoMove] = useState<
    { plannedMealId: string; toDate: string; title: string } | null
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
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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
      getFavorites()
        .then((favs) => setSavedIds(new Set(favs.map((f) => f.id))))
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
      setMoving(null);
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
        setUndoMove(
          landed && slot.recipe
            ? { plannedMealId: landed.id, toDate: fromDate, title: slot.recipe.title }
            : null,
        );
        const i = (fresh?.days ?? []).findIndex((d) => d.date === toLocalDate);
        if (i >= 0) setSelected(i);
      } catch {
        setError("That meal could not be moved.");
      } finally {
        setBusy(false);
      }
    },
    [plan, busy, reloadPlan],
  );

  /** Undo is simply the inverse move, against the id the re-read gave us. */
  const doUndo = useCallback(async () => {
    if (!plan || !undoMove || busy) return;
    setBusy(true);
    const target = undoMove;
    setUndoMove(null);
    try {
      await movePlannedMeal({
        plannedMealId: target.plannedMealId,
        mealPlanId: plan.mealPlanId,
        toLocalDate: target.toDate,
      });
      const fresh = await reloadPlan();
      const i = (fresh?.days ?? []).findIndex((d) => d.date === target.toDate);
      if (i >= 0) setSelected(i);
    } catch {
      setError("That move could not be undone.");
    } finally {
      setBusy(false);
    }
  }, [plan, undoMove, busy, reloadPlan]);

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
    (recipe: MyPlanRecipe, slotType: MealSlotType, slot: MyPlanSlot) => {
      navigation.navigate("RecipeDetail", {
        // 🔑 The ONLY entry point with plan context, so the only one where the
        // serving control can save. `slot.id` is the planned_meal row and
        // `slot.servings` is the multiplier already stored.
        plannedMeal: plan
          ? { id: slot.id, mealPlanId: plan.mealPlanId, servings: slot.servings }
          : undefined,
        meal: {
          id: recipe.id,
          name: recipe.title,
          whyLine: "",
          calories: 0,
          protein: 0,
          prepTime: recipe.readyInMinutes ?? 0,
          time: SLOT_TO_LEGACY_TIME[slotType],
          imageUrl: recipe.imageUrl ?? undefined,
        },
      });
    },
    [navigation, plan],
  );

  const range = useMemo(() => {
    if (!plan?.days.length) return "";
    const first = plan.days[0].date;
    const last = plan.days[plan.days.length - 1].date;
    return `${shortDate(first)}–${dayOfMonth(last)}`;
  }, [plan]);

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>My Plan</Text>
        <Text style={styles.error}>{error}</Text>
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
          <View style={styles.titleText}>
            <Text style={styles.title}>My Plan</Text>
            <Text style={styles.range}>{range}</Text>
          </View>
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
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((slot, idx) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                first={idx === 0}
                emptyCopy={emptyCopy(slot.slotType)}
                onPress={
                  slot.recipe
                    ? () => openRecipe(slot.recipe!, slot.slotType, slot)
                    : undefined
                }
                onLongPress={
                  // 🔴 r6: "Edit any future/current planned meal" — a past day
                  // is history, not a draft, so it stays read-only.
                  slot.recipe && day && day.date >= localToday()
                    ? () => setMoving({ slot, fromDate: day.date })
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
      </ScrollView>

      {/* ── Rearrange sheet (MY PLAN r10) ───────────────────────────────
          Day picker only for this slice. The endpoint also takes a slot
          type, but moving BETWEEN slots needs a slot list Lang has not
          drawn, and the server keeps the slot when only a date is sent. */}
      <Modal
        visible={!!moving}
        transparent
        animationType="slide"
        onRequestClose={() => setMoving(null)}
      >
        <Pressable style={styles.moveBackdrop} onPress={() => setMoving(null)} />
        <View style={styles.moveSheet}>
          <Text style={styles.moveTitle}>Move to another day</Text>
          <Text style={styles.moveSub} numberOfLines={1}>
            {moving?.slot.recipe?.title ?? ""}
          </Text>
          {(plan?.days ?? []).map((d) => {
            // Past days cannot receive a meal either — the same r6 rule that
            // makes them read-only as a source.
            const disabled = d.date < localToday() || d.date === moving?.fromDate;
            return (
              <Pressable
                key={d.date}
                disabled={disabled || busy}
                onPress={() => moving && doMove(moving.slot, moving.fromDate, d.date)}
                style={[styles.moveRow, disabled && styles.moveRowDisabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                accessibilityLabel={`Move to ${shortDate(d.date)}`}
              >
                <Text style={[styles.moveRowText, disabled && styles.moveRowTextDisabled]}>
                  {shortDate(d.date)}
                  {d.date === moving?.fromDate ? "  ·  current day" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* 🔴 UNDO — required by r10, and the ONLY way back: a move writes a new
          revision, so there is nothing to "cancel" afterwards. */}
      {undoMove ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>
            Moved {undoMove.title}
          </Text>
          <Pressable
            onPress={doUndo}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Undo the move"
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
  scroll: { padding: 20, paddingBottom: 48 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
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
  error: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: K.bone,
    opacity: 0.8,
    marginTop: 16,
    paddingHorizontal: 20,
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
  moveRowTextDisabled: { color: K.bone },

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
  undoAction: {
    fontFamily: fonts.dmSansBold,
    fontSize: 14,
    color: K.blue,
  },
});

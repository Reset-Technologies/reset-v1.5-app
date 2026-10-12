import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useResetWindow } from "../../hooks/useResetWindow";
import {
  getMyPlan,
  buildTags,
  MyPlanResponse,
  MyPlanRecipe,
  MyPlanSlot,
  MealSlotType,
} from "../../services/myPlan";

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
        const today = new Date().toISOString().slice(0, 10);
        const i = p.days.findIndex((d) => d.date === today);
        setSelected(i >= 0 ? i : 0);
      })
      .catch((e) => !cancelled && setError(e?.message ?? "Could not load your plan."));
    return () => {
      cancelled = true;
    };
  }, []);

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
    (recipe: MyPlanRecipe, slotType: MealSlotType) => {
      navigation.navigate("RecipeDetail", {
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
    [navigation],
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
        <Text style={styles.title}>My Plan</Text>
        <Text style={styles.range}>{range}</Text>

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
                  slot.recipe ? () => openRecipe(slot.recipe!, slot.slotType) : undefined
                }
              />
            ))}
          {!day?.slots.length && (
            <Text style={styles.emptyDay}>No meals planned for this day.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SlotRow({
  slot,
  first,
  emptyCopy,
  onPress,
}: {
  slot: MyPlanSlot;
  first: boolean;
  emptyCopy: string | null;
  onPress?: () => void;
}) {
  const label = SLOT_LABEL[slot.slotType];
  const recipe = slot.recipe;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.slotRow, !first && styles.slotDivider]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={recipe ? `${label}: ${recipe.title}` : `${label}: empty`}
    >
      {recipe?.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}

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
});

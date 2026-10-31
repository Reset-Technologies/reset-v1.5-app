import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ArrowBackIcon } from "../../components/PaywallIcons";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import {
  buildTags,
  getMyPlan,
  swapPlannedMeal,
  type MealSlotType,
  type MyPlanDay,
  type MyPlanResponse,
  type MyPlanSlot,
} from "../../services/myPlan";
import type { MainStackParamList } from "../../navigation/MainNavigator";

/**
 * ADD MEAL TO PLAN — Lang `5055:49011` ("Meal planning", 402×843).
 *
 * 🔴 This was a bottom SHEET inside `RecipeDetailScreen` and it was the wrong
 * container. Her frame is a full screen: a header with `arrow_back`, the meal
 * being added pinned at the top, her instruction line, a 7-cell day selector
 * and then the week listed DAY BY DAY. The sheet version could only ever show
 * one day, and sized to its content — which is how the day selector ended up
 * scrolling horizontally with the SELECTED day off-screen (measured on the iOS
 * sim 2026-10-31: `Sat 31` sat at x=419..487 on a 402pt screen, so the sheet
 * opened showing four unselected chips above a meal list belonging to a day the
 * member could not see).
 *
 * 🔑 Her Date Selector cells are `flex: 1` — seven equal columns that always
 * fit — which is the actual fix for that, not a wider chip.
 *
 * 📌 Pushed, never `presentation: "modal"`. `RecipeDetail` is itself a pushed
 * screen for exactly this reason (see MainNavigator), and a screen pushed after
 * a modal stays inside the modal's card.
 */

type Props = NativeStackScreenProps<MainStackParamList, "AddToPlan">;

const SLOT_LABEL: Record<MealSlotType, string> = {
  first_meal: "Breakfast",
  midday: "Lunch",
  evening: "Dinner",
  snack: "Snack",
};

const DOW_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * 🔴 Never `new Date("2026-10-31")` for a plan date: that parses as UTC
 * midnight and renders in local time, moving the day backwards for anyone west
 * of Greenwich. Plan dates are plain local calendar days — split the string.
 */
function parts(iso: string): { y: number; m: number; d: number; dow: number } | null {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/**
 * Today as a LOCAL calendar day, `YYYY-MM-DD`.
 *
 * 🔴 Not `toISOString().slice(0,10)` — that is UTC, so anyone west of
 * Greenwich gets yesterday for most of their evening. Plan days are local.
 */
function todayLocal(): string {
  const n = new Date();
  const mm = String(n.getMonth() + 1).padStart(2, "0");
  const dd = String(n.getDate()).padStart(2, "0");
  return `${n.getFullYear()}-${mm}-${dd}`;
}

/** `2026-10-31` → `Saturday 10.31`, her heading format. */
function dayHeading(iso: string): string {
  const p = parts(iso);
  return p ? `${DOW_FULL[p.dow]} ${p.m}.${p.d}` : iso;
}

export function AddToPlanScreen({ route, navigation }: Props) {
  const { recipeId, recipeVersionId, title, imageUrl, fromDate } = route.params;

  const [plan, setPlan] = useState<MyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(fromDate ?? null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  /** Section tops, so the selector can scroll the week to a day. */
  const offsets = useRef<Record<string, number>>({});
  const autoScrolled = useRef(false);

  useEffect(() => {
    let alive = true;
    getMyPlan()
      .then((p) => {
        if (!alive) return;
        setPlan(p);
        // 🔑 Open on the day the member is on, not on the first day of the
        // week. `fromDate` wins when they came from a planned meal; otherwise
        // today if the week contains it; `days[0]` only as a last resort.
        const today = todayLocal();
        setSelected(
          (cur) =>
            cur ??
            (p.days.some((d) => d.date === today) ? today : null) ??
            p.days[0]?.date ??
            null,
        );
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const pickDay = useCallback((date: string) => {
    setSelected(date);
    const y = offsets.current[date];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, []);

  /**
   * Swap this recipe INTO an existing planned meal.
   *
   * 🔴 REPLACES, never appends — `POST my-plan/meals` appends, which once gave
   * a member two dinners on the same day. MY PLAN r9: *"Replace planned meal in
   * same slot; refresh grocery delta."* A swap is also NOT a rejection, so
   * nothing here touches Fit or emits `meal_rejected`.
   */
  const swap = useCallback(
    async (slot: MyPlanSlot, date: string) => {
      if (!plan || busy) return;
      setBusy(true);
      try {
        await swapPlannedMeal({
          plannedMealId: slot.id,
          mealPlanId: plan.mealPlanId,
          recipeVersionId,
        });
        // Name the meal AND the day: the member needs to know which day changed.
        setToast(`Swapped in for ${slot.recipe?.title ?? "that meal"} on ${dayHeading(date)}`);
        setTimeout(() => navigation.goBack(), 900);
      } catch {
        // 🔴 Not silent. An empty catch makes a failed swap look identical to a
        // successful one.
        setToast("That didn't go through. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [plan, busy, recipeVersionId, navigation],
  );

  const days: MyPlanDay[] = plan?.days ?? [];

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            {/* Her `arrow_back` is a 24 instance in a 40 slot. */}
            <ArrowBackIcon size={24} color={K.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Add Meal to Plan</Text>
        </View>
      </SafeAreaView>

      {/* ── The meal being added, pinned at the top — her `5055:49015` ──
          🔴 COLOUR: her CSS fallback reads `--text-strong,#361416`, but
          `get_variable_defs` resolves `Text Strong` to #fafdfe — the fallback
          is the wrong MODE. `K.white` IS #FAFDFE. */}
      <View style={styles.addingCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.addingThumb} resizeMode="cover" />
        ) : (
          <View style={styles.addingThumb} />
        )}
        <View style={styles.addingText}>
          <Text style={styles.addingEyebrow}>Adding:</Text>
          <Text style={styles.addingTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <Text style={styles.instruction}>Choose a meal to swap this one in for</Text>

      {/* 🔑 Seven `flex: 1` cells. Her row never scrolls, which is the whole
          reason the selected day cannot go off-screen. */}
      {days.length > 0 ? (
        <>
          <View style={styles.daySelector}>
            {days.map((d) => {
              const p = parts(d.date);
              const on = d.date === selected;
              return (
                <Pressable
                  key={d.date}
                  onPress={() => pickDay(d.date)}
                  style={[styles.dayCell, on ? styles.dayCellOn : styles.dayCellOff]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={dayHeading(d.date)}
                >
                  <Text style={[styles.dayLetter, on ? styles.dayTextOn : styles.dayTextOff]}>
                    {p ? DOW_LETTER[p.dow] : "?"}
                  </Text>
                  <Text style={[styles.dayNumber, on ? styles.dayTextOn : styles.dayTextOff]}>
                    {p ? p.d : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.divider} />
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator color={K.white} style={{ marginTop: 32 }} />
      ) : failed ? (
        <Text style={styles.instruction}>Couldn't load your week. Try again.</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {days.map((d) => {
            /**
             * 🔴 Bryan, 2026-10-30: *"fix 'Add to plan' so a recipe can't
             * replace itself."* Without this the list offers the slot this
             * recipe already occupies, and tapping it swaps the meal for
             * itself — a write, a fresh plan revision, and nothing changed on
             * screen. 📌 Matched on the MEAL id, not the version: a different
             * version of the same recipe is still the same meal to a member.
             */
            const rows = d.slots.filter((s) => s.recipe && s.recipe.id !== recipeId);
            return (
              <View
                key={d.date}
                style={styles.daySection}
                onLayout={(e) => {
                  offsets.current[d.date] = e.nativeEvent.layout.y;
                  // Once, on first layout: bring the selected day into view.
                  if (d.date === selected && !autoScrolled.current) {
                    autoScrolled.current = true;
                    const y = e.nativeEvent.layout.y;
                    if (y > 0) scrollRef.current?.scrollTo({ y: y - 8, animated: false });
                  }
                }}
              >
                <Text style={styles.dayHeading}>{dayHeading(d.date)}</Text>
                {rows.length === 0 ? (
                  <Text style={styles.empty}>
                    {d.slots.some((s) => s.recipe)
                      ? "This meal is already planned for that day."
                      : "Nothing planned that day yet."}
                  </Text>
                ) : (
                  <View>
                    {rows.map((slot, i) => {
                      const tags = slot.recipe ? buildTags(slot.recipe) : [];
                      return (
                        <Pressable
                          key={slot.id}
                          onPress={() => void swap(slot, d.date)}
                          disabled={busy}
                          style={[
                            styles.mealRow,
                            i > 0 && styles.mealRowStacked,
                            i === 0 && styles.mealRowFirst,
                            i === rows.length - 1 && styles.mealRowLast,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Swap ${slot.recipe?.title ?? "this meal"} on ${dayHeading(d.date)}`}
                        >
                          <View style={styles.mealContent}>
                            {slot.recipe?.imageUrl ? (
                              <Image source={{ uri: slot.recipe.imageUrl }} style={styles.mealThumb} />
                            ) : (
                              <View style={[styles.mealThumb, styles.mealThumbEmpty]} />
                            )}
                            <View style={styles.mealText}>
                              <Text style={styles.mealSlot}>{SLOT_LABEL[slot.slotType]}</Text>
                              <Text style={styles.mealTitle} numberOfLines={2}>
                                {slot.recipe?.title}
                              </Text>
                              {tags.length > 0 ? (
                                <View style={styles.tagRow}>
                                  {tags.map((t) => (
                                    <View key={t} style={styles.tag}>
                                      <Text style={styles.tagText}>{t}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.chevron}>{"\u203A"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {toast ? (
        <SafeAreaView edges={["bottom"]} style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText} numberOfLines={2}>
              {toast}
            </Text>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const PAGE_PAD = 24;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: K.brown },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: PAGE_PAD,
    height: 40,
    marginTop: 8,
  },
  backButton: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fonts.catalogue, fontSize: 20, color: K.white, letterSpacing: -0.2 },

  /* Lang `5055:49015`: Page surface 20% fill, a Blue Surface hairline and its
     glow, and the swept TOP-RIGHT corner (Large 24) against three XSmall 4s. */
  addingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: PAGE_PAD,
    marginTop: 24,
    backgroundColor: "rgba(81,52,54,0.2)",
    borderWidth: 1,
    borderColor: K.blue,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 18,
    paddingLeft: 12,
    // 🔴 boxShadow, NOT elevation/shadow*: elevation draws Android's own hard
    // grey shadow and ignores the shadow* props, losing her blue glow.
    boxShadow: "0px 0px 11.2px 0px rgba(146,180,189,0.4)",
  },
  addingThumb: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(62,56,56,0.1)",
    borderTopLeftRadius: 4.889,
    borderTopRightRadius: 2.444,
    borderBottomRightRadius: 9.778,
    borderBottomLeftRadius: 2.444,
  },
  // 🔴 RN defaults flexShrink to 0: without this a long name pushes the
  // thumbnail off the card instead of wrapping.
  addingText: { flex: 1, flexShrink: 1, gap: 2 },
  addingEyebrow: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12, color: K.white },
  addingTitle: { fontFamily: fonts.catalogue, fontSize: 16, letterSpacing: -0.16, color: K.white },

  instruction: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: K.white,
    opacity: 0.7,
    textAlign: "center",
    marginTop: 12,
    marginHorizontal: PAGE_PAD,
  },

  /* Her Day Selector (`5055:49469`): gap 6, every cell `flex: 1`. */
  daySelector: { flexDirection: "row", gap: 6, marginTop: 16, marginHorizontal: PAGE_PAD },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: "rgba(81,52,54,0.2)",
  },
  // Selected: a 2pt Blue Surface edge. Unselected: a 1pt Ghost Surface edge.
  dayCellOn: { borderWidth: 2, borderColor: K.blue },
  dayCellOff: { borderWidth: 1, borderColor: "rgba(250,253,254,0.24)" },
  dayLetter: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
  dayNumber: { fontFamily: fonts.catalogue, fontSize: 16, letterSpacing: -0.16 },
  dayTextOn: { color: K.white },
  dayTextOff: { color: "#b0a3a4" },

  divider: {
    height: 1,
    backgroundColor: "rgba(250,253,254,0.14)",
    marginTop: 20,
  },

  listContent: { paddingBottom: 48 },
  daySection: { paddingHorizontal: PAGE_PAD, paddingTop: 24, gap: 16 },
  dayHeading: { fontFamily: fonts.catalogue, fontSize: 24, letterSpacing: -0.24, color: K.white },
  empty: { fontFamily: fonts.catalogue, fontSize: 14, color: K.white, opacity: 0.6 },

  /* Her day section is a TABLE (`5055:49495`): every Meal row carries its own
     0.5pt Divider Line edge, and the stack is closed with the house sweep —
     top-right 24 on the first row, bottom-left 24 on the last.

     🔴🔴 COLOUR, fifth time on this screen: the CSS fallbacks read
     `--divider-line,#c3b9ba` and `--page-surface,#fafdfe`, but
     `get_variable_defs` resolves **Divider Line #7e6869** and **Page Surface
     #361416**. The fallbacks are the LIGHT mode; this screen is dark. Taking
     them literally would have drawn pale grey rules on white rows. */
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 18,
    paddingLeft: 12,
    borderWidth: 0.5,
    borderColor: "#7e6869",
    backgroundColor: K.brown,
  },
  // Collapse the shared edge: two abutting 0.5pt borders otherwise read as a
  // 1pt rule between rows and a 0.5pt one at the ends.
  mealRowStacked: { marginTop: -0.5 },
  mealRowFirst: { borderTopRightRadius: 24 },
  mealRowLast: { borderBottomLeftRadius: 24 },
  mealContent: { flex: 1, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 16 },
  /* Her Recipe Image 1:1 at "Med": 72 square, tl 8 / tr 4 / br 16 / bl 4. */
  mealThumb: {
    width: 72,
    height: 72,
    backgroundColor: "rgba(243,239,227,0.08)",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  mealThumbEmpty: { borderWidth: 0.5, borderColor: "#7e6869", borderStyle: "dashed" },
  mealText: { flex: 1, flexShrink: 1, gap: 2 },
  mealSlot: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12, color: K.white, opacity: 0.6 },
  mealTitle: { fontFamily: fonts.catalogue, fontSize: 16, letterSpacing: -0.16, color: K.white },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 8 },
  tag: {
    backgroundColor: "rgba(250,253,254,0.24)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontFamily: fonts.quadrant, fontSize: 12, letterSpacing: -0.12, color: K.white },
  chevron: { fontSize: 26, color: K.bone, opacity: 0.5 },

  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  toast: {
    marginHorizontal: PAGE_PAD,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(81,52,54,0.95)",
    borderWidth: 1,
    borderColor: "rgba(250,253,254,0.24)",
  },
  toastText: { fontFamily: fonts.catalogue, fontSize: 14, color: K.white },
});

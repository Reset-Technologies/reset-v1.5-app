import React, { useState, useEffect, useMemo, useCallback } from "react";
import { formatPrepTime } from "../../utils/prepTime";
import { shareWithLink } from "../../constants/links";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
  CommonActions,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Circle } from "react-native-svg";
import { K, toMetabolicType, type MetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import type { Meal } from "../../components";
import { AiConsentNudge } from "../../components";
import { AskEsterSheet } from "./AskEsterSheet";
import { useAiConsentGate } from "../../hooks/useAiConsentGate";
import { useResetWindow } from "../../hooks/useResetWindow";
import { BookmarkIcon } from "../../components/BookmarkIcon";
import { ArrowBackIcon } from "../../components/PaywallIcons";
import {
  getMealDetail,
  getMealIngredients,
  getSubstituteSuggestions,
  applySubstitution,
  getPlanSubstitutions,
  revertSubstitution,
  PlanSubstitution,
  SubstituteSuggestion,
  getCachedDailyPlan,
  addFavorite,
  removeFavorite,
  getFavorites,
  MealDetail,
  MealIngredient,
  MealNutrient,
  DailyPlanMeal,
} from "../../services/meals";
import { getMealWhy } from "../../services/mealInsights";
import { abbreviateMeasurement, formatAmount } from "../../utils/amount";
import {
  MealSlotType,
  MyPlanResponse,
  MyPlanSlot,
  getMyPlan,
  setPlannedMealServings,
  swapPlannedMeal,
} from "../../services/myPlan";
import { dietLabel } from "../../utils/dietLabel";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import { logEvent } from "../../services/braze";

// 🔴 The local `RecipeRouteParams` that used to live here is gone. It was a
// second, hand-maintained copy of this route's params, and it had already
// drifted: `MainStackParamList` gained `plannedMeal` and this screen could not
// see it, so `route.params.plannedMeal` failed to compile against a type that
// claimed to describe the same route. One definition, in the navigator.

const HERO_HEIGHT = 360;
const SCREEN_WIDTH = Dimensions.get("window").width;

/** Height of the persistent action bar, so scroll content can clear it. */
const ACTION_BAR_H = 64;

/**
 * Slot display names for the add sheet.
 *
 * 🔑 MY PLAN r16 keeps the MODEL semantic (`first_meal · midday · evening ·
 * snack`) because a member on a Window may not eat three times a day — but
 * *"Display can still say Breakfast/Lunch/Dinner when appropriate."* So this
 * mapping lives in the view and the semantic code is what gets sent.
 * 📌 Deliberately duplicated from `MyPlanScreen` rather than exported: these
 * are two screens' presentation choices, and a shared constant would imply the
 * model had settled on these words.
 */
const ADD_SLOT_LABEL: Record<MealSlotType, string> = {
  first_meal: "Breakfast",
  midday: "Lunch",
  evening: "Dinner",
  snack: "Snack",
};

/**
 * `2026-10-20` -> `Mon 20`, without constructing a Date.
 *
 * 🔴 Parsing `YYYY-MM-DD` with `new Date()` reads it as UTC midnight and then
 * renders it in local time, which moves the day backwards for anyone west of
 * Greenwich. The plan's dates are plain local calendar days and must not be
 * shifted — the same trap that produced "Mon Oct 12" from a date column.
 */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${names[dow]} ${d}`;
}

function parseInstructions(instructions: string | null): string[] {
  if (!instructions) return [];

  const normalized = instructions
    .replace(/\.(?=[A-Za-z])/g, ". ")
    // 🔴 Line-start markers must be stripped BEFORE newlines are collapsed —
    // afterwards `^` can only mean the start of the whole string, and a
    // newline-delimited list ("1. Chop\n2. Fry") keeps its numbers.
    .replace(/^\s*\d+\.\s*/gm, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/^\s*Instructions\s*:?\s*/i, " ")
    .replace(/^\s*Instructions(?=[A-Z])/, " ")
    /**
     * 🔴🔴 A number followed by a full stop is only a LIST MARKER where one
     * can occur: at the start, or straight after a sentence ended. The old
     * rule matched `\d+\.` after ANY whitespace, so
     * *"Preheat oven to 325.In a 10-inch skillet…"* rendered as **"Preheat
     * oven to In a 10-inch skillet"** — the oven temperature silently deleted
     * from a cooking instruction. Found walking Recipe Details 2026-10-21;
     * the source data was correct, we were destroying it on the way to the
     * screen. "Bake for 45." lost its 45 the same way.
     *
     * 📌 Capped at two digits as a second guard: list markers are small, oven
     * temperatures and quantities are not.
     */
    .replace(/(^|[.!?])\s*\d{1,2}\.\s+/g, "$1 ")
    .replace(/\bStep\s*\d+\s*:?\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.!?]+$/, ""))
    .filter((s) => s.length > 5)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

// The user's metabolic-type mascot, used as the avatar in the "Message from
// Ester" bubble so the card reflects who Ester is talking to. (Ember's asset is
// the legacy "Restorer" file name.)
const TYPE_LOGO: Record<MetabolicType, ReturnType<typeof require>> = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
};

// Per-type 3-stop ramp for the Ester card background. Same structure as the
// original gradient (bright type hue → darkened mid → brand dark #361416, so
// the light text stays legible at the bottom) — only the hue changes per type.
// Burner keeps the original terracotta ramp.
const TYPE_GRADIENT: Record<MetabolicType, [string, string, string]> = {
  Burner: ["#B44420", "#7A2A18", "#361416"], // terracotta / orange
  Rebounder: ["#7E5C93", "#522F54", "#361416"], // lavender / plum
  Ember: ["#5B8794", "#34505A", "#361416"], // slate blue
  Chameleon: ["#8B6F4E", "#574029", "#361416"], // earthy brown
  Explorer: ["#B89A2E", "#6E5418", "#361416"], // gold / ochre
};

const DEFAULT_CARD_GRADIENT: [string, string, string] = [
  "#B44420",
  "#7A2A18",
  "#361416",
];

function CardGradient({
  colors = DEFAULT_CARD_GRADIENT,
}: {
  colors?: [string, string, string];
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]}
      onLayout={(e) =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient
              id="cardGradient"
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={size.w}
              y2={size.h}
            >
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="0.55" stopColor={colors[1]} />
              <Stop offset="1" stopColor={colors[2]} />
            </LinearGradient>
          </Defs>
          <Rect
            width={size.w}
            height={size.h}
            fill="url(#cardGradient)"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function renderBoldSegments(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text key={i} style={{ fontFamily: fonts.catalogueBold }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return <Text key={i}>{part}</Text>;
    });
}

const STEP_LABELS = [
  "STEP ONE",
  "STEP TWO",
  "STEP THREE",
  "STEP FOUR",
  "STEP FIVE",
  "STEP SIX",
  "STEP SEVEN",
  "STEP EIGHT",
  "STEP NINE",
  "STEP TEN",
];

function dailyPlanMealToMeal(d: DailyPlanMeal): Meal {
  return {
    id: d.id,
    name: d.name,
    whyLine: d.whyLine,
    calories: d.calories,
    protein: d.protein,
    prepTime: d.prepTime,
    time: d.time,
    imageUrl: d.imageUrl,
    iliScore: d.iliScore,
    inflammatoryIndex: d.inflammatoryIndex,
    foodQuality: d.foodQuality,
    primaryProtein: d.primaryProtein,
    cuisineCluster: d.cuisineCluster,
  };
}

function capitalizeSlot(time: Meal["time"]): string {
  return time.charAt(0).toUpperCase() + time.slice(1);
}

/**
 * The only three serving options the product has — and the only three the
 * backend accepts (`SERVING_MULTIPLIERS` = {0.5, 1, 2}; `setServings` throws
 * on anything else).
 */
export type ServingMultiplier = 0.5 | 1 | 2;

const SERVING_OPTIONS: ServingMultiplier[] = [0.5, 1, 2];

const SERVING_LABEL: Record<ServingMultiplier, string> = {
  0.5: "Half",
  1: "Standard",
  2: "Double",
};

/**
 * The two ingredient-row controls from Lang's `5055:47476`.
 *
 * 🔴 Drawn, not typed. The arrow characters she uses (↩ / ↻) are in Unicode's
 * emoji data, and U+25B6 on the Cook Mode timer shipped as a BLUE EMOJI on
 * iOS for exactly that reason. A path cannot be re-presented by the platform.
 */
function SwapGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2.5 5.5h9M9 3l2.5 2.5L9 8M13.5 10.5h-9M7 8l-2.5 2.5L7 13"
        stroke={K.textMuted}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RevertGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5"
        stroke={K.brown}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Path
        d="M2.6 2.4v2.8h2.8"
        stroke={K.brown}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function RecipeDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "RecipeDetail">>();
  const { meal } = route.params;
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const { aiConsentGranted, runWithAiConsent } = useAiConsentGate();
  /**
   * TEST CASES **M34**: the planned-meal Ester entry's context must include
   * *"planned_meal_id + recipe_version + plan + Window"*. Ester cannot judge
   * whether a meal suits the member's day without knowing when they eat.
   */
  const { state: windowState } = useResetWindow();
  // The Ester bubble's avatar + gradient reflect the user's metabolic type.
  const metabolicType: MetabolicType =
    toMetabolicType(state.user.metabolicType) ?? "Explorer";

  const [detail, setDetail] = useState<MealDetail | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [siblings, setSiblings] = useState<Meal[]>(
    route.params.siblings ?? [],
  );
  /**
   * 🔴 A MULTIPLIER (0.5 / 1 / 2), not a serving count.
   *
   * The sheet is explicit in two places: MY PLAN r20 — *"Member-facing half /
   * standard / double maps to multiplier … 0.5 / 1 / 2 … Simple segmented
   * control"* — and RECIPE MODEL's `servings_base`: *"UI uses half/standard/
   * double multiplier."* SERVINGS + ING then defines what each does: Standard
   * is **base quantities**, Half scales ×0.5, Double ×2.
   *
   * This screen shipped a +/− stepper holding a COUNT, which is a different
   * model: it let a member ask for 7 servings, a value the backend rejects
   * outright (`SERVING_MULTIPLIERS` is {0.5, 1, 2} and `setServings` throws on
   * anything else). Lang's frame shows a "4 servings" dropdown, which is the
   * same mismatch.
   *
   * 🔑 What each option MEANS is Bryan's 2026-10-12 decision, which supersedes
   * SERVINGS + ING r2: *"I'd make Standard one serving. Half is 0.5 and Double
   * is 2."* So Standard shows ONE serving of the recipe, not all of it.
   */
  const plannedMeal = route.params.plannedMeal;

  /**
   * Ingredient substitution (P0 #8b), Lang's frame 5046:44621.
   *
   * 🔑 Only offered when there is a PLANNED MEAL behind the screen, for the
   * same reason the serving control is: a substitution changes a planned
   * recipe INSTANCE. Opened from Home, Saved Meals or Ester chat there is no
   * instance to change, so the rows are plain text — the same distinction this
   * screen already draws rather than a new one.
   */
  const [swapFor, setSwapFor] = useState<MealIngredient | null>(null);
  const [suggestions, setSuggestions] = useState<SubstituteSuggestion[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  /**
   * The substitutions in force on THIS slot.
   *
   * 🔴 Without these the screen cannot show a swap at all. The ingredient list
   * comes from `GET /meals/:id/ingredients`, which is keyed by meal id and
   * serves the recipe — a substitution changes the planned recipe INSTANCE
   * (SERVINGS + ING r2), never the recipe, so that endpoint returns byte-identical
   * rows before and after. Measured: apply a swap, refetch, every name the same,
   * while the grocery list had already switched to the substitute.
   */
  const [subs, setSubs] = useState<PlanSubstitution[]>([]);
  const [revertFor, setRevertFor] = useState<PlanSubstitution | null>(null);
  const [reverting, setReverting] = useState(false);
  /** Lang's `5055:47291` toast. Cleared on a timer, and on unmount. */
  const [toast, setToast] = useState<string | null>(null);

  /**
   * Ask Ester (Lang `5062:56495`, ESTER CONTEXT r8 — the only entry Bryan
   * marks CURRENT).
   *
   * 📌 Gated on AI consent like the Ester block above it: opening a chat is
   * the same promise as generating a why-line, so it goes through the same
   * gate rather than around it.
   */
  const [askEsterOpen, setAskEsterOpen] = useState(false);
  const openAskEster = useCallback(() => {
    runWithAiConsent(() => setAskEsterOpen(true));
  }, [runWithAiConsent]);
  // Rides along on the detail fetch so the server can record `recipe_viewed`
  // with r15's `source_surface`. Undefined from a call site that does not set
  // it, which records the view with an unknown surface rather than losing it.
  const sourceSurface = route.params.sourceSurface;

  // Opens where the member left it when there is a planned meal behind this
  // recipe; Standard otherwise, since there is nothing saved to restore.
  const [multiplier, setMultiplier] = useState<ServingMultiplier>(
    (plannedMeal?.servings as ServingMultiplier) ?? 1,
  );
  const [esterText, setEsterText] = useState<string | null>(null);

  // ── Add to plan (new 2026-10-19) ───────────────────────────────────────
  const [addSheet, setAddSheet] = useState(false);
  const [plan, setPlan] = useState<MyPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [addDate, setAddDate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const [esterLoading, setEsterLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    logEvent("home_recipe_detail", { mealId: meal.id });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRecipe() {
      try {
        const [mealDetail, mealIngredients] = await Promise.all([
          getMealDetail(meal.id, sourceSurface),
          getMealIngredients(meal.id),
        ]);
        if (cancelled) return;
        setDetail(mealDetail);
        setIngredients(mealIngredients);
        // 🔴 Do NOT reset to Standard here. This fires when the recipe detail
        // finishes loading, and clobbering the member's saved multiplier at
        // that point would make a planned Double silently snap back.
      } catch {
        // Keep meal card data as fallback
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadRecipe();
    return () => {
      cancelled = true;
    };
    // 🔑 `sourceSurface` is deliberately NOT a dependency. It is fixed for the
    // life of this screen (it is where the member came FROM), and adding it
    // would only risk a second fetch — which the server would count as a
    // second view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal.id]);

  useEffect(() => {
    // RES-188 — the "message from Ester" why-blurb is OpenAI-generated. Skip
    // the fetch when third-party-AI consent is off; the render shows the
    // AiConsentNudge in its place. Granting re-runs this effect.
    if (!aiConsentGranted) {
      setEsterLoading(false);
      setEsterText(null);
      return;
    }
    let cancelled = false;
    setEsterLoading(true);
    setEsterText(null);
    getMealWhy(meal.id)
      .then((res) => {
        if (cancelled) return;
        setEsterText(res.text);
      })
      .catch(() => {
        if (cancelled) return;
        setEsterText(null);
      })
      .finally(() => {
        if (!cancelled) setEsterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meal.id, aiConsentGranted]);

  useEffect(() => {
    if (siblings.length > 0) return;
    let cancelled = false;
    getCachedDailyPlan()
      .then((plan) => {
        if (cancelled || !plan) return;
        const raw = (plan as unknown as Record<string, unknown>)[meal.time];
        let pool: DailyPlanMeal[] = [];
        if (Array.isArray(raw)) pool = raw as DailyPlanMeal[];
        else if (raw && typeof raw === "object")
          pool = [raw as DailyPlanMeal];
        const others = pool
          .filter((m) => m.id !== meal.id)
          .map(dailyPlanMealToMeal);
        setSiblings(others);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meal.id, meal.time, siblings.length]);

  useEffect(() => {
    let cancelled = false;
    getFavorites()
      .then((favs) => {
        if (cancelled) return;
        setIsFavorited(favs.some((f) => f.id === meal.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meal.id]);

  /**
   * Which substitutions apply to the meal on screen.
   *
   * 📌 Filtered by `localDate` + `slotType`, the slot's stable identity. A
   * plan can hold the same recipe in several slots and only one of them may
   * have been changed — keying on the recipe would paint the swap onto all of
   * them.
   */
  const loadSubstitutions = useCallback(async () => {
    if (!plannedMeal) return;
    try {
      const all = await getPlanSubstitutions(plannedMeal.mealPlanId);
      setSubs(
        all.filter(
          (sub) =>
            sub.structured &&
            sub.localDate === plannedMeal.localDate &&
            sub.slotType === plannedMeal.slotType,
        ),
      );
    } catch {
      // Leave the list as it was. A failed read must not erase a swap the
      // member can see — that would look like their change was undone.
    }
  }, [plannedMeal]);

  useEffect(() => {
    void loadSubstitutions();
  }, [loadSubstitutions]);

  /** Index by the ingredient being replaced, which is what a row knows. */
  const subByIngredient = useMemo(() => {
    const m = new Map<string, PlanSubstitution>();
    for (const sub of subs) m.set(sub.fromIngredientId, sub);
    return m;
  }, [subs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /** The recipe's own yield — the divisor that turns a multiplier into servings of food. */
  const servingsBase = detail?.servingsMin ?? 1;

  /**
   * Open the swap drawer for one ingredient and fetch its options.
   *
   * 📌 Fetched on open, not with the screen. Each call is an Ester round-trip
   * (~4s measured), and a member opens at most one ingredient's drawer —
   * prefetching every row would spend that per ingredient for nothing.
   */
  const openSwap = useCallback(
    async (ing: MealIngredient) => {
      if (!plannedMeal) return;
      setSwapFor(ing);
      setSuggestions(null);
      setChosen(null);
      try {
        const opts = await getSubstituteSuggestions({
          plannedMealId: plannedMeal.id,
          mealPlanId: plannedMeal.mealPlanId,
          fromIngredientId: ing.ingredientId,
          /**
           * 🔴 THE MEMBER'S AMOUNT, not the recipe's. This sent
           * `ing.quantity` raw, so the drawer asked Ester for substitutes for
           * "3 pounds" of short ribs while the row right behind it read
           * "⅜ lbs" — the recipe's full 8-serving yield against the one
           * serving actually planned. Every suggestion came back captioned
           * "3 lbs", 8× what the member would buy. Found on Cole's S24,
           * 2026-10-22.
           *
           * 🔑 Same expression as the row (`ing.quantity * multiplier /
           * servingsBase`), and it has to stay that way for the reason the
           * row already states: the screen, the grocery list and now the swap
           * drawer must agree, or cooking from the recipe does not match what
           * was bought.
           *
           * 📌 It is not only a caption. This string is the PROMPT — Ester
           * reasons about the amount she is given, so the wrong scale skews
           * the substitutes themselves, not just the number under them.
           */
          amount: `${formatAmount(
            (ing.quantity * multiplier) / (servingsBase || 1),
            ing.measurement,
          )} ${abbreviateMeasurement(ing.measurement)}`.trim(),
          recipeTitle: meal.name,
        });
        setSuggestions(opts);
        // 📌 Nothing pre-selected. Lang draws two states for this sheet:
        // `5046:46228` with no radio filled and the primary dimmed, and
        // `5046:44621` with one chosen and the primary live. Pre-selecting
        // the first skipped her empty state and let a member confirm a
        // substitute they never actually picked.
        setChosen(null);
      } catch {
        // An empty list renders the honest "no substitutes" state rather than
        // an error the member can do nothing with.
        setSuggestions([]);
      }
    },
    [plannedMeal, meal.name, multiplier, servingsBase],
  );

  /**
   * Apply the chosen substitute.
   *
   * 🔑 Sends the canonical id, so this takes the STRUCTURED path: new plan
   * revision, recomputed nutrition and grocery, same Reset Score plan version
   * (SERVINGS + ING r7, SCORE CONTRACT r20).
   *
   * 📌 Refetches the ingredient list afterwards rather than patching it
   * locally. The server decides what the swap actually did — including
   * refusing to make it structured when a restriction cannot be verified — so
   * reading the result back is the only honest way to show it.
   */
  const confirmSwap = useCallback(async () => {
    if (!plannedMeal || !swapFor || !chosen || swapping) return;
    setSwapping(true);
    try {
      const applied = await applySubstitution({
        plannedMealId: plannedMeal.id,
        mealPlanId: plannedMeal.mealPlanId,
        fromIngredientId: swapFor.ingredientId,
        toIngredientId: chosen,
      });
      setSwapFor(null);
      // 🔴 The result decides the message. A restriction we cannot verify
      // turns the request into a NOTE that changes nothing, and announcing
      // "swapped successfully" over that would be the screen telling the
      // member something the plan does not say. The server's own reason is
      // already written for them to read.
      setToast(
        applied.structured
          ? "Ingredient swapped successfully"
          : (applied.unstructuredReason ??
            "We saved that as a note — it did not change the recipe."),
      );
      // The recipe never changes, so this re-read is only for servings; the
      // swap itself shows up through `loadSubstitutions`.
      const [fresh] = await Promise.all([
        getMealIngredients(meal.id),
        loadSubstitutions(),
      ]);
      setIngredients(fresh);
    } catch {
      // Leave the drawer open so the member can try again or back out; a
      // silent close would look like it worked.
      //
      // 🔴 And SAY so. This catch used to be empty, which is how a 400 from a
      // stale planned-meal id went unnoticed: the member pressed the button,
      // nothing happened, and nothing explained why.
      setToast("That didn't go through. Try again.");
    } finally {
      setSwapping(false);
    }
  }, [plannedMeal, swapFor, chosen, swapping, meal.id, loadSubstitutions]);

  /**
   * Take one back — Lang's `5065:58762` *"Revert to original ingredient"*.
   *
   * 🔴 Not in Bryan's workbook: SERVINGS + ING has no undo column and EVENTS
   * declares no revert event. MY PLAN r9/r10 give every other plan edit an
   * "Undo", so a swap you cannot take back is the odd one out — built on that
   * reading, with the event name left to Bryan rather than invented here.
   */
  const confirmRevert = useCallback(async () => {
    if (!plannedMeal || !revertFor || reverting) return;
    setReverting(true);
    try {
      await revertSubstitution({
        substitutionId: revertFor.id,
        mealPlanId: plannedMeal.mealPlanId,
      });
      setRevertFor(null);
      setToast("Reverted to the original ingredient");
      await loadSubstitutions();
    } catch {
      // Same reasoning as a failed swap: keep the sheet open, and say so.
      setToast("That didn't go through. Try again.");
    } finally {
      setReverting(false);
    }
  }, [plannedMeal, revertFor, reverting, loadSubstitutions]);

  /**
   * Pick a serving size, and save it when there is a planned meal behind it.
   *
   * 🔑 Optimistic: the ingredient amounts redraw immediately, because waiting
   * on a round-trip to move a segment feels broken. On failure it goes back,
   * rather than showing a size the plan does not actually hold.
   *
   * 🔴 Only persists with plan context. Servings belongs to a PLANNED MEAL, so
   * opening this recipe from Home or Saved Meals has nothing to write to — the
   * control still scales the display, it just does not pretend to save.
   *
   * ⚠️ The server makes a new `meal_plan_revision` and the grocery list
   * rescales on its next read, which is why the list has pull-to-refresh.
   */
  const chooseMultiplier = async (next: ServingMultiplier) => {
    const previous = multiplier;
    if (next === previous) return;
    setMultiplier(next);
    if (!plannedMeal) return;
    try {
      await setPlannedMealServings({
        plannedMealId: plannedMeal.id,
        mealPlanId: plannedMeal.mealPlanId,
        servings: next,
      });
    } catch {
      setMultiplier(previous);
    }
  };

  const handleClose = () => {
    navigation.dispatch(CommonActions.goBack());
  };

  const handleShare = async () => {
    try {
      await Share.share(
        shareWithLink(`${meal.name} — recommended by Ester on Reset`),
      );
    } catch {
      // Cancelled or share failed silently
    }
  };

  const handleToggleFavorite = async () => {
    const next = !isFavorited;
    // Favouriting from the recipe page fired nothing — only the bookmark on the
    // Home meal card was instrumented, so saves made after opening a recipe
    // were invisible. Named for this screen rather than reusing Home's
    // `home_meal_favoriteCTA` so the two entry points stay countable apart;
    // matches `home_recipe_detail` above.
    logEvent("home_recipe_detail_favoriteCTA", {
      mealId: meal.id,
      ...(meal.name ? { mealName: meal.name } : {}),
      action: next ? "favorite" : "unfavorite",
    });
    setIsFavorited(next);
    try {
      if (next) await addFavorite(meal.id);
      else await removeFavorite(meal.id);
      // Lang's "Saving a Meal" annotation on `5039:39399`. The bookmark fills
      // in, which is easy to miss on a photo; this says what happened.
      setToast(next ? "Meal saved" : "Removed from Saved Meals");
    } catch {
      setIsFavorited(!next);
      setToast("That didn't go through. Try again.");
    }
  };

  const handleMoreRecipes = () => {
    if (siblings.length === 0) return;
    const [next, ...rest] = siblings;
    const nextSiblings = [...rest, meal];
    navigation.push("RecipeDetail", { meal: next, siblings: nextSiblings });
  };

  const steps = parseInstructions(detail?.instructions ?? null);
  const prepTime = detail?.prepTime ?? meal.prepTime;
  const esterMessage = esterText ?? (esterLoading ? null : meal.whyLine);
  // 🔑 Through the shared `dietLabel` so this screen and the My Plan rows
  // word the same diet identically. This used to render the raw lower-case
  // name ("gluten free") while My Plan rendered "Gluten-free".
  const dietTags = (detail?.diets ?? [])
    .map((d) => d.name)
    .filter(Boolean)
    .map(dietLabel)
    .slice(0, 3);

  const heroSource = meal.imageUrl
    ? { uri: meal.imageUrl }
    : detail?.imageAsset
      ? { uri: detail.imageAsset }
      : null;

  /** The chosen day's planned meals — what the member picks between. */
  const dayMeals: MyPlanSlot[] =
    plan?.days.find((d) => d.date === addDate)?.slots.filter((sl) => sl.recipe) ?? [];

  const canCook = Boolean(detail?.recipeVersionId) && (detail?.cookStepCount ?? 0) > 0;
  /**
   * 🔴 Gated on `recipeVersionId`, not on the recipe existing. The route
   * freezes the version a planned meal points at (MY PLAN r19), so without one
   * there is nothing to add and the button must not pretend otherwise.
   */
  const canAdd = Boolean(detail?.recipeVersionId);

  const openAddSheet = useCallback(() => {
    setAddSheet(true);
    if (plan || planLoading) return;
    setPlanLoading(true);
    getMyPlan()
      .then((p) => {
        setPlan(p);
        /**
         * 🔴 The day the member CAME FROM, not day one of the week.
         *
         * This used to default to `p.days[0]`, and the comment claimed that
         * was "the day the member is actually shown". It was not. Opened from
         * Tuesday's dinner, the sheet listed MONDAY's three meals — the same
         * recipes in a different order, so it looked entirely plausible —
         * and the swap landed on Monday's lunch. The button said "Added" and
         * it was telling the truth: something was added, just not where the
         * member was looking.
         *
         * Caught by finally doing the one check I had left open for two days:
         * swap into a slot holding a DIFFERENT recipe and watch the plan.
         */
        const cameFrom = plannedMeal?.localDate ?? null;
        const today = new Date().toISOString().slice(0, 10);
        const fallback = p.days.some((d) => d.date === today)
          ? today
          : (p.days[0]?.date ?? null);
        setAddDate((cur) => cur ?? cameFrom ?? fallback);
      })
      .catch(() => setPlan(null))
      .finally(() => setPlanLoading(false));
  }, [plan, planLoading, plannedMeal]);

  /**
   * Swap this recipe INTO one of the day's existing meals.
   *
   * 🔴 This REPLACES; it does not append — and the correction came from
   * Lang's own flow. Her "Add to meal plan" section (5055:48783) reads
   * *"Choose a meal to swap this one in for"*, confirms with an
   * **Original Meal → New Meal** sheet, and calls the result "Swap confirmed".
   *
   * The first cut of this screen used `POST my-plan/meals`, whose own doc says
   * it *"Appends into the named day and slot"*. On device that gave the member
   * a Tuesday with TWO dinners — the original plus the one they added, the same
   * recipe twice in one day. A plan that grows every time you like something is
   * not a plan.
   *
   * 🔑 MY PLAN r9: *"Replace planned meal in same slot; refresh grocery
   * delta."* Day, slot, sort order and servings survive; only the content
   * changes. It writes a new revision and leaves the Score plan version alone
   * (START HERE r7), which is why an approved swap can still count as On plan.
   *
   * 📌 A swap is NOT a rejection — SWAPS + EDITS is explicit that *"a passive
   * swap alone is not a rejection"* — so nothing here emits `meal_rejected` or
   * touches Fit. The member is choosing, not complaining.
   */
  const confirmPlanSwap = useCallback(
    async (slot: MyPlanSlot) => {
      const versionId = detail?.recipeVersionId;
      const planId = plan?.mealPlanId;
      if (!versionId || !planId || adding) return;
      setAdding(true);
      setAddSheet(false);
      try {
        await swapPlannedMeal({
          plannedMealId: slot.id,
          mealPlanId: planId,
          recipeVersionId: versionId,
        });
        setAddedTo(slot.recipe?.title ?? null);
        // Name the day as well as the meal. The whole defect above was the
        // member not knowing WHICH day they had just changed.
        setToast(
          `Swapped in for ${slot.recipe?.title ?? "that meal"} on ${dayLabel(addDate ?? "")}`,
        );
      } catch {
        // 🔴 Was silent. "Deliberately silent" is how a failed swap looks
        // identical to a successful one — the same empty-catch shape that hid
        // a 400 on the ingredient swap for weeks.
        setToast("That didn't go through. Try again.");
      } finally {
        setAdding(false);
      }
    },
    [detail, plan, adding, addDate],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          // Clears the persistent action bar.
          { paddingBottom: insets.bottom + ACTION_BAR_H + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <View style={styles.heroContainer}>
          {heroSource ? (
            <Image
              source={heroSource}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroPlaceholderText}>🍽️</Text>
            </View>
          )}
          {/* Top scrim so floating header buttons stay readable */}
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#361416" stopOpacity="0.55" />
                <Stop offset="0.5" stopColor="#361416" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroScrim)" />
          </Svg>
        </View>

        {/* Content sheet (overlaps hero) */}
        <View style={styles.sheet}>
          {/* Title + tag chips */}
          <View style={styles.titleBlock}>
            <Text style={styles.mealName}>{meal.name}</Text>
            <View style={styles.tagRow}>
              {prepTime ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{formatPrepTime(prepTime, "minutes")}</Text>
                </View>
              ) : null}
              <View style={styles.tag}>
                <Text style={styles.tagText}>{capitalizeSlot(meal.time)}</Text>
              </View>
              {dietTags.map((d) => (
                <View key={d} style={styles.tag}>
                  <Text style={styles.tagText}>{d}</Text>
                </View>
              ))}
              {servingsBase ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {servingsBase}{" "}
                    {servingsBase === 1 ? "serving" : "servings"}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 🔴 NO NUTRITION HERE, DELIBERATELY — this screen used to render a
              Calories pill, Protein/Carbs/Fat/Fiber chips and a
              "% of daily vitamins + minerals" rollup. The spec says it must
              not, in three places:
                · START HERE r34 (RULE) — "User-facing calories/macros: Do not
                  build. Energy is internal only."
                · FOOD STANDARD r2 — "The member never sees calories, macros,
                  nutrient scores, or a weekly nutrition scorecard."
                · RECIPE MODEL r17 — `internal_nutrition` ("verified kcal,
                  protein, fiber, sugar"), **Member-facing? NO**, CURRENT.
              Lang's frame (5046:43237) has no nutrition on it either.
              🔑 The %DV rollup went too: a "% of daily vitamins and minerals"
              IS a nutrient score, and micronutrients are part of
              internal_nutrition. That one is an inference from the rule rather
              than a row naming it — the sheet never mentions vitamins at all.
              📌 The data still arrives on the detail payload and still drives
              Reset Food eligibility server-side. Internal, not hidden. */}

          {/* Message from Ester */}
          {!aiConsentGranted ? (
            <View style={styles.esterBlock}>
              <View style={styles.esterEyebrowRow}>
                <View style={styles.esterEyebrowDot} />
                <Text style={styles.esterEyebrowText}>Message from Ester</Text>
              </View>
              <AiConsentNudge />
            </View>
          ) : esterLoading || esterMessage ? (
            <View style={styles.esterBlock}>
              <View style={styles.esterEyebrowRow}>
                <View style={styles.esterEyebrowDot} />
                <Text style={styles.esterEyebrowText}>Message from Ester</Text>
              </View>
              <View style={styles.esterCard}>
                <CardGradient colors={TYPE_GRADIENT[metabolicType]} />
                <Image
                  source={TYPE_LOGO[metabolicType]}
                  style={styles.esterAvatar}
                  resizeMode="contain"
                />
                <View style={styles.esterTextWrap}>
                  {esterLoading ? (
                    <Text style={[styles.esterText, styles.esterLoadingText]}>
                      Thinking through why this fits you today…
                    </Text>
                  ) : (
                    <Text style={styles.esterText}>
                      {renderBoldSegments(esterMessage ?? "")}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ) : null}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Ingredients */}
          {ingredients.length > 0 ? (
            <View style={styles.section}>
              {/* 🔑 The control sits on its OWN row, not beside the title.
                  Three word labels are much wider than the +/− stepper they
                  replaced, and sharing the row squeezed the heading until
                  "Ingredients" wrapped to "Ingredie / nts" on an S24. The
                  selected segment is also the only label needed — the separate
                  meta line under the title printed "Standard" a second time. */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Ingredients</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>
                        {ingredients.length}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.servingsRow}>
                <View style={styles.servingsSegmented}>
                  {SERVING_OPTIONS.map((m) => {
                    const active = m === multiplier;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.segment,
                          active && styles.segmentActive,
                        ]}
                        onPress={() => chooseMultiplier(m)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${SERVING_LABEL[m]} servings`}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            active && styles.segmentTextActive,
                          ]}
                        >
                          {SERVING_LABEL[m]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.ingredientsList}>
                {ingredients.map((ing, idx) => {
                  // 🔑 Standard is ONE SERVING — Bryan, 2026-10-12: *"I'd make
                  // Standard one serving. Half is 0.5 and Double is 2."* That
                  // supersedes SERVINGS + ING r2, which had Standard as the
                  // recipe's base quantities.
                  //
                  // `quantity` is the recipe as written, feeding
                  // `servingsBase`, so the divisor is what turns the multiplier
                  // into servings of food. This MUST match the grocery list's
                  // scaling: if the screen says "2 cans" at Standard while the
                  // list buys half a can, cooking from the recipe would not
                  // match what was bought.
                  const qty = (ing.quantity * multiplier) / (servingsBase || 1);
                  const qtyDisplay = formatAmount(qty, ing.measurement);
                  // 🔑 Tappable ONLY with a planned meal behind the screen —
                  // a substitution changes a planned recipe instance, so from
                  // Home or Saved Meals there is nothing to change. Same
                  // distinction the serving control already draws.
                  const Row: React.ElementType = plannedMeal ? Pressable : View;
                  // 🔑 The substitution, if this row has one. Its name is the
                  // only thing on the screen that proves the swap happened.
                  const sub = subByIngredient.get(ing.ingredientId);
                  const shownName = sub?.toIngredientName ?? ing.ingredientName;
                  return (
                    <Row
                      key={ing.id + idx}
                      onPress={
                        plannedMeal
                          ? () => (sub ? setRevertFor(sub) : openSwap(ing))
                          : undefined
                      }
                      style={[
                        styles.ingredientRow,
                        idx === 0 ? styles.ingredientRowFirst : null,
                      ]}
                      accessibilityRole={plannedMeal ? "button" : undefined}
                      accessibilityLabel={
                        plannedMeal
                          ? sub
                            ? `Revert ${shownName} to ${sub.fromIngredientName ?? ing.ingredientName}`
                            : `Swap ${ing.ingredientName}`
                          : undefined
                      }
                    >
                      <Text style={styles.ingredientQty} numberOfLines={2}>
                        {qtyDisplay} {abbreviateMeasurement(ing.measurement)}
                      </Text>
                      <Text style={styles.ingredientName}>
                        {shownName}
                        {sub ? (
                          // Lang's `5055:47291` marks the changed row in
                          // italics beside the name.
                          <Text style={styles.ingredientSwapped}> Swapped</Text>
                        ) : null}
                      </Text>
                      {/* 🔴 A visible affordance. The row was already
                          pressable but drew nothing, so the only way to find
                          ingredient swaps was to tap a list that looks like
                          text. Lang puts a control on every row. */}
                      {plannedMeal ? (
                        <View
                          style={[
                            styles.ingredientAction,
                            sub ? styles.ingredientActionOn : null,
                          ]}
                        >
                          {sub ? <RevertGlyph /> : <SwapGlyph />}
                        </View>
                      ) : null}
                    </Row>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── Cook Mode ────────────────────────────────────────────────
              DECISION LOG r12, CURRENT: recipe detail carries *"Cook Mode +
              serving controls + ingredient swaps + single Save"*.
              🔴 Gated on `cookStepCount`, NOT on parsed instruction text.
              Salmon Frittata shows four instruction paragraphs and has ZERO
              cook steps — gating on `steps.length` offered a button that
              400s, which the device walk caught.
              20 of 520 recipes are genuinely no-cook
              (smoothie bowls, salads, dressings) and the API 400s for them —
              so the button is hidden rather than letting a member tap into an
              error.
              📌 It sits ABOVE Instructions on purpose: it is the same content
              in a form you can cook from, so offering it before the wall of
              text is the point. */}
          {/* 📌 Cook moved into the persistent bottom bar on 2026-10-19 — that
              is where Lang's "Recipe Details - Scroll" frame puts it, beside
              Ask Ester and Add to plan. The gate is unchanged: a recipe with no
              parsed steps still offers no Cook action. */}

          {/* Instructions */}
          {steps.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <View style={styles.stepsList}>
                {steps.map((step, idx) => (
                  <View key={idx} style={styles.stepCard}>
                    <Text style={styles.stepLabel}>
                      {STEP_LABELS[idx] ?? `STEP ${idx + 1}`}
                    </Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* More recipes CTA */}
          {siblings.length > 0 ? (
            <TouchableOpacity
              style={styles.moreCta}
              onPress={handleMoreRecipes}
              activeOpacity={0.85}
            >
              <CardGradient colors={TYPE_GRADIENT[metabolicType]} />
              <Image
                source={TYPE_LOGO[metabolicType]}
                style={styles.moreCtaAvatar}
                resizeMode="contain"
              />
              <View style={styles.moreCtaRight}>
                <Text style={styles.moreCtaText}>
                  I have some more recipes!
                </Text>
                <View style={styles.moreCtaButton}>
                  <Text style={styles.moreCtaButtonLabel}>Show me!</Text>
                  <Text style={styles.moreCtaButtonGlyph}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Persistent actions ────────────────────────────────────────────
          Lang's "Recipe Details - Scroll" frame (5046:44118) carries a bottom
          bar of three: Cook · Ask Ester · Add to plan.

          🔴 ADD TO PLAN IS NEW. `POST /api/meals/my-plan/meals` has been live
          the whole time, emitting `meal_added` (M33), and nothing in the app
          ever called it — so a member could search all of Explore, open a
          recipe, and had no way to put it in their week.

          ✅ Three buttons now — Lang's **Cook · Ask Ester · Add to plan**.
          Ask Ester landed 2026-10-21 with the first half of #14's context
          contract: all six `ester_opened_from_*` events declared, and this
          entry passes `recipe_version_id` plus the serving and substitution
          state r8 requires. The other five entries are still unbuilt. */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom || 12 }]}>
        {canCook ? (
          <Pressable
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={() =>
              navigation.navigate("CookMode", {
                recipeVersionId: detail!.recipeVersionId as string,
                plannedMealId: plannedMeal?.id ?? null,
                imageUrl: detail?.imageAsset ?? meal.imageUrl,
                mealId: meal.id,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Start cook mode"
          >
            <Text style={styles.actionSecondaryText}>Cook</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.actionButton, styles.actionSecondary]}
          onPress={openAskEster}
          accessibilityRole="button"
          accessibilityLabel="Ask Ester"
        >
          <Text style={styles.actionSecondaryText}>Ask Ester</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionPrimary, !canAdd && styles.actionDisabled]}
          disabled={!canAdd || adding}
          onPress={openAddSheet}
          accessibilityRole="button"
          accessibilityLabel="Add to plan"
        >
          <Text style={styles.actionPrimaryText}>
            {adding ? "Adding…" : addedTo ? "Added" : "Add to plan"}
          </Text>
        </Pressable>
      </View>

      {/* ── Add to plan: pick a day, then a slot ──────────────────────────
          🔑 Two taps, no confirm step. The member already chose the recipe by
          being here; day and slot are the only facts the route needs that it
          cannot infer (`mealPlanId` and `recipeVersionId` come from state).

          🔴 Slot labels are the VIEW's (MY PLAN r16: the model stays semantic
          — first_meal · midday · evening · snack — because a member on a Window
          may not eat three times, but *"Display can still say
          Breakfast/Lunch/Dinner when appropriate"*). The code is what is sent. */}
      <Modal
        visible={addSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setAddSheet(false)}
      >
        <Pressable style={styles.addBackdrop} onPress={() => setAddSheet(false)} />
        <View style={styles.addSheet}>
          <Text style={styles.addTitle}>Add to your week</Text>
          {/* Lang's instruction, verbatim from the frame. */}
          <Text style={styles.addSub} numberOfLines={2}>
            Choose a meal to swap this one in for
          </Text>

          {planLoading ? (
            <ActivityIndicator color={K.cream} style={{ marginVertical: 24 }} />
          ) : !plan ? (
            <Text style={styles.addSub}>Couldn't load your week. Try again.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayRow}>
                {plan.days.map((d) => (
                  <Pressable
                    key={d.date}
                    style={[styles.dayChip, d.date === addDate && styles.dayChipOn]}
                    onPress={() => setAddDate(d.date)}
                    accessibilityRole="button"
                    accessibilityLabel={dayLabel(d.date)}
                  >
                    <Text style={[styles.dayChipText, d.date === addDate && styles.dayChipTextOn]}>
                      {dayLabel(d.date)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* 🔴 The day's EXISTING meals, not a list of empty slots. Her
                  frame puts each day's meals under the selector and asks the
                  member to pick one — the thing being replaced has to be
                  visible, or "swap" is a guess. */}
              {dayMeals.length === 0 ? (
                <Text style={styles.addSub}>Nothing planned that day yet.</Text>
              ) : (
                dayMeals.map((slot) => (
                  <Pressable
                    key={slot.id}
                    style={styles.slotRow}
                    disabled={adding}
                    onPress={() => void confirmPlanSwap(slot)}
                    accessibilityRole="button"
                    accessibilityLabel={`Swap ${slot.recipe?.title ?? "this meal"}`}
                  >
                    <Text style={styles.slotRowLabel}>{ADD_SLOT_LABEL[slot.slotType]}</Text>
                    <Text style={styles.slotRowText} numberOfLines={1}>
                      {slot.recipe?.title ?? "Empty slot"}
                    </Text>
                  </Pressable>
                ))
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Floating header buttons */}
      <SafeAreaView
        edges={["top"]}
        style={styles.floatingHeader}
        pointerEvents="box-none"
      >
        <View style={styles.floatingHeaderRow}>
          {/* An arrow, not a ✕: this screen is PUSHED (see MainNavigator), and
              Lang's frame draws arrow_back here. A ✕ promises a sheet that
              dismisses downward, which is no longer what happens. Sized 18 to
              sit with the ↗ and the 16pt bookmark beside it rather than at the
              frame's 24, which would tower over both. */}
          <TouchableOpacity
            style={styles.headerCloseButton}
            onPress={handleClose}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <ArrowBackIcon size={18} color={K.brown} />
          </TouchableOpacity>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleShare}
              hitSlop={8}
              accessibilityLabel="Share recipe"
            >
              <Text style={styles.headerActionGlyph}>↗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleToggleFavorite}
              hitSlop={8}
              accessibilityLabel={
                isFavorited ? "Remove from favorites" : "Save to favorites"
              }
            >
              <BookmarkIcon filled={isFavorited} color={K.brown} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={K.brown} />
        </View>
      ) : null}

      {/* ── Swap ingredient (P0 #8b) ─────────────────────────────────────
          Lang's frame 5046:44621: title, Ester's line, radio options each
          with a reason and an amount, then confirm or keep.

          🔴 Every option is a REAL canonical ingredient. The server builds the
          pool from the ingredient table, filters it against the member's
          restrictions, and Ester only chooses among it — so confirming takes
          the STRUCTURED path (new revision, recomputed grocery and nutrition,
          same Score plan version) instead of being stored as a note.

          🔴 An EMPTY list is a real answer, not an error: no candidates, Ester
          declining, or a restriction the server cannot verify all return one.
          We say so plainly rather than inventing options. */}
      <Modal
        visible={!!swapFor}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapFor(null)}
      >
        <Pressable style={styles.swapBackdrop} onPress={() => setSwapFor(null)} />
        <View style={styles.swapSheet}>
          <View style={styles.swapHeader}>
            <Text style={styles.swapTitle}>Swap ingredient</Text>
            <Pressable
              onPress={() => setSwapFor(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.swapClose}>✕</Text>
            </Pressable>
          </View>

          {suggestions === null ? (
            <View style={styles.swapLoading}>
              <ActivityIndicator size="small" color={K.brown} />
            </View>
          ) : suggestions.length === 0 ? (
            <Text style={styles.swapEmpty}>
              No substitutes we can suggest for this one.
            </Text>
          ) : (
            <>
              <Text style={styles.swapEsterLabel}>Ester's suggestions</Text>
              <View style={styles.swapEsterCard}>
                <Text style={styles.swapEsterText}>
                  Here's some substitutes for{" "}
                  <Text style={styles.swapEsterStrong}>
                    {swapFor?.ingredientName}
                  </Text>
                  .
                </Text>
              </View>

              <ScrollView style={styles.swapList}>
                {suggestions.map((opt) => {
                  const selected = chosen === opt.ingredientId;
                  return (
                    <Pressable
                      key={opt.ingredientId}
                      onPress={() => setChosen(opt.ingredientId)}
                      style={[styles.swapOption, selected && styles.swapOptionOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={opt.name}
                    >
                      <View style={styles.swapOptionBody}>
                        <Text style={styles.swapOptionName}>{opt.name}</Text>
                        {/* Ester's one line — never a nutrition claim. */}
                        <Text style={styles.swapOptionWhy}>{opt.rationale}</Text>
                        <Text style={styles.swapOptionQty}>{opt.quantity}</Text>
                      </View>
                      <View
                        style={[styles.swapRadio, selected && styles.swapRadioOn]}
                      >
                        {selected ? <Text style={styles.swapTick}>✓</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                style={[styles.swapConfirm, (!chosen || swapping) && styles.swapConfirmOff]}
                onPress={confirmSwap}
                disabled={!chosen || swapping}
                accessibilityRole="button"
                accessibilityLabel="Swap ingredient"
              >
                <Text style={styles.swapConfirmText}>
                  {swapping ? "Swapping…" : "Swap ingredient"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSwapFor(null)}
                style={styles.swapKeep}
                accessibilityRole="button"
                accessibilityLabel="Keep original"
              >
                <Text style={styles.swapKeepText}>Keep original</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>

      {/* ── Revert to original ingredient (Lang 5065:58762) ──────────────
          Her sheet names both sides and strikes through the one being
          given up, so the member can see exactly what they are undoing.

          🔴 The layer names in this frame still read "Original Meal" and
          "Basil and Tomato One-Pan Pasta" — a reused component. The RENDER
          is the spec: Swapped Ingredient → Original Ingredient. */}
      <Modal
        visible={!!revertFor}
        transparent
        animationType="slide"
        onRequestClose={() => setRevertFor(null)}
      >
        <Pressable
          style={styles.swapBackdrop}
          onPress={() => setRevertFor(null)}
        />
        <View style={styles.swapSheet}>
          <View style={styles.swapHeader}>
            <Text style={styles.swapTitle}>Revert to original ingredient</Text>
            <Pressable
              onPress={() => setRevertFor(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
            >
              <Text style={styles.swapClose}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.revertCompare}>
            <View style={styles.revertSide}>
              <Text style={styles.revertLabel}>Swapped Ingredient</Text>
              <Text style={[styles.revertName, styles.revertNameOld]}>
                {revertFor?.toIngredientName ?? ""}
              </Text>
            </View>
            <View style={styles.revertArrow}>
              <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                <Path
                  d="M4 10h11M11.5 6.5 15 10l-3.5 3.5"
                  stroke={K.textMuted}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.revertSide}>
              <Text style={styles.revertLabel}>Original Ingredient</Text>
              <Text style={styles.revertName}>
                {revertFor?.fromIngredientName ?? ""}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.swapConfirm, reverting && styles.swapConfirmOff]}
            onPress={confirmRevert}
            disabled={reverting}
            accessibilityRole="button"
            accessibilityLabel="Revert to original"
          >
            <Text style={styles.swapConfirmText}>
              {reverting ? "Reverting…" : "Revert to original"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setRevertFor(null)}
            style={styles.swapKeep}
            accessibilityRole="button"
            accessibilityLabel="Keep current"
          >
            <Text style={styles.swapKeepText}>Keep current</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Ask Ester (Lang 5062:56495 · ESTER CONTEXT r8) ───────────────
          🔑 The context is the point. r8 requires the recipe version plus the
          CURRENT serving and substitution state — not just "a meal" — so the
          multiplier on screen and the substitutions in force are handed over
          rather than left for the model to guess at. */}
      <AskEsterSheet
        visible={askEsterOpen}
        onClose={() => setAskEsterOpen(false)}
        title="Meal Details"
        openingMessage={esterMessage}
        openingLoading={esterLoading}
        mealId={meal.id}
        sourceSurface={sourceSurface}
        renderRich={renderBoldSegments}
        context={{
          recipeId: meal.id,
          recipeVersionId: (detail?.recipeVersionId as string) ?? null,
          plannedMealId: plannedMeal?.id ?? null,
          mealPlanId: plannedMeal?.mealPlanId ?? null,
          localDate: plannedMeal?.localDate ?? null,
          slotType: plannedMeal?.slotType ?? null,
          servings: multiplier,
          substitutionIds: subs.map((x) => x.id),
          windowStatus: windowState?.status ?? null,
          windowOpensAt: windowState?.plan?.openLocalTime ?? null,
        }}
      />

      {/* ── Toast (Lang 5055:47291) ──────────────────────────────────────
          Sits over the hero, below the status bar. The ONLY confirmation
          either of these actions gives — the recipe text itself cannot
          change, so without this a successful swap looked like nothing
          happened at all. */}
      {toast ? (
        <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="polite">
          <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
            <Circle cx={10} cy={10} r={8.25} stroke={K.textLight} strokeWidth={1.4} />
            <Path
              d="m6.5 10.2 2.4 2.4 4.6-5"
              stroke={K.textLight}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Hero
  heroContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: K.bone,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlaceholderText: {
    fontSize: 64,
  },
  // Sheet (overlaps hero with rounded top-right corner)
  sheet: {
    marginTop: -90,
    backgroundColor: K.white,
    borderTopRightRadius: 64,
    paddingHorizontal: 18,
    paddingTop: 30,
    paddingBottom: 25,
    gap: 30,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 19.2,
    shadowOffset: { width: 0, height: -4 },
  },
  // Title block
  titleBlock: {
    gap: 12,
  },
  mealName: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.32,
    color: K.brown,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: K.bone,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  // Nutrition row
  macroLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  macroValue: {
    fontFamily: fonts.catalogueBold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  macroUnit: {
    fontFamily: fonts.catalogueBold,
    fontSize: 13,
  },
  // %DV row
  // Ester message
  esterBlock: {
    gap: 6,
  },
  esterEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  esterEyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.ochre,
  },
  esterEyebrowText: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  esterCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: K.brown,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 40,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  esterAvatar: {
    width: 48,
    height: 48,
  },
  esterTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  esterText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: "#F3EFE3",
  },
  esterLoadingText: {
    opacity: 0.6,
    fontStyle: "italic",
  },
  // Section
  divider: {
    height: 1,
    backgroundColor: K.border,
  },
  /* Cook Mode entry. Recipe Details is the LIGHT surface (bone bg, dark
     text), unlike My Plan and Cook Mode itself — so this is a dark button on
     bone, the inverse of the "Done" button inside Cook Mode. */
  cookModeButton: {
    height: 56,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.brown,
  },
  cookModeText: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.bone,
  },
  section: {
    gap: 30,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 30,
  },
  sectionHeaderLeft: {
    flex: 1,
    gap: 6,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.brown,
  },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: K.border,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
  },
  servingsRow: { marginTop: 12, alignItems: "flex-start" },
  servingsSegmented: {
    flexDirection: "row",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(54,20,22,0.08)",
  },
  segment: { paddingHorizontal: 14, paddingVertical: 8 },
  segmentActive: { backgroundColor: K.brown, borderRadius: 999 },
  segmentText: { fontFamily: fonts.catalogue, fontSize: 13, color: K.brown },
  segmentTextActive: { color: K.cream },
  // Ingredients list
  ingredientsList: {
    gap: 0,
  },
  /**
   * 🔴 Two separate things used to push every row's contents upward, and they
   * cancelled out on the FIRST row only — which is how Cole spotted it on his
   * S24 (2026-10-22): row one looked right, every row under it did not.
   *
   *   · the swap control is 28dp tall against a 24dp text line, so IT sets the
   *     row height — and `alignItems: "flex-start"` pinned the text to the top
   *     of it rather than centring the two against each other;
   *   · `paddingTop: 0` with `paddingBottom: 12` then tipped the whole block
   *     up again, leaving all the slack underneath.
   *
   * Measured before the fix: row 117px, text 63px, 0px above it and 54px
   * below. `ingredientRowFirst`'s `paddingTop: 10` was the only thing putting
   * any air above a row, which is why row one alone read as centred.
   *
   * 📌 Rows are ~12dp taller now. The first row no longer needs its own top
   * padding — it keeps only the top border, which is all it was ever for.
   */
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: K.border,
  },
  ingredientRowFirst: {
    borderTopWidth: 1,
    borderTopColor: K.border,
  },
  ingredientQty: {
    width: 70,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
  },
  ingredientName: {
    flex: 1,
    fontFamily: fonts.catalogueBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
  },
  /** Lang marks the changed row beside the name, in italics. */
  ingredientSwapped: {
    fontFamily: fonts.catalogue,
    fontStyle: "italic",
    fontSize: 14,
    color: K.textMuted,
  },
  ingredientAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: K.border,
    marginTop: -2,
  },
  ingredientActionOn: {
    borderColor: K.brown,
    backgroundColor: K.cream,
  },
  // Revert to original ingredient (Lang 5065:58762)
  revertCompare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  revertSide: {
    flex: 1,
    gap: 4,
  },
  revertLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: 0.2,
    color: K.textMuted,
    textAlign: "center",
  },
  revertName: {
    fontFamily: fonts.catalogueBold,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
    textAlign: "center",
  },
  /** Struck through, because it is the side being given up. */
  revertNameOld: {
    color: K.textMuted,
    textDecorationLine: "line-through",
  },
  revertArrow: {
    width: 20,
    alignItems: "center",
  },
  // Toast (Lang 5055:47291)
  toast: {
    position: "absolute",
    // 🔑 Below the floating back / share / bookmark circles, not over them.
    // At 56 it covered all three for the three seconds it was up — visible on
    // both platforms once I looked at Android, and I had missed it on iOS.
    top: 112,
    left: 11,
    right: 11,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: K.brown,
  },
  toastText: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 15,
    letterSpacing: -0.15,
    color: K.textLight,
  },
  // Instructions
  stepsList: {
    gap: 12,
  },
  stepCard: {
    backgroundColor: K.bone,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 8,
    padding: 16,
    gap: 10,
  },
  stepLabel: {
    fontFamily: fonts.catalogueBold,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.sub,
  },
  stepText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: K.brown,
  },
  // More recipes CTA
  moreCta: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: K.brown,
    borderRadius: 18,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    marginTop: 10,
    overflow: "hidden",
  },
  moreCtaAvatar: {
    width: 96,
    height: 122,
  },
  moreCtaRight: {
    flex: 1,
    alignItems: "flex-end",
    gap: 16,
  },
  moreCtaText: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: "#F3EFE3",
    textAlign: "right",
  },
  moreCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.white,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 32,
  },
  moreCtaButtonLabel: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.brown,
  },
  moreCtaButtonGlyph: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: K.brown,
  },
  // Floating header
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  floatingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 21,
    paddingTop: 8,
  },
  headerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: K.bone,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: K.white,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionGlyph: {
    fontSize: 18,
    color: K.brown,
    fontFamily: fonts.catalogue,
  },
  // Loading
  /* ── Swap ingredient (Lang 5046:44621) ──────────────────────────────
     🔑 Recipe Details is the LIGHT surface — her frame draws this sheet on
     bone with dark text, unlike My Plan's sheets. Reusing My Plan's dark
     `moveSheet` values here would be the colour drift already logged against
     this screen, so these take the page's own palette. */
  swapBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(54,20,22,0.35)" },
  swapSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "86%",
    backgroundColor: K.bone,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  swapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  swapTitle: { fontFamily: fonts.catalogue, fontSize: 26, color: K.brown, letterSpacing: -0.3 },
  swapClose: { fontFamily: fonts.catalogue, fontSize: 20, color: K.brown, opacity: 0.7 },
  swapLoading: { paddingVertical: 36, alignItems: "center" },
  swapEmpty: {
    fontFamily: fonts.catalogue,
    fontSize: 15,
    color: K.brown,
    opacity: 0.7,
    paddingVertical: 24,
  },
  swapEsterLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 13,
    color: K.brown,
    opacity: 0.6,
  },
  swapEsterCard: {
    borderWidth: 1,
    borderColor: "rgba(54,20,22,0.15)",
    borderRadius: 10,
    padding: 12,
  },
  swapEsterText: { fontFamily: fonts.catalogue, fontSize: 15, color: K.brown, lineHeight: 21 },
  swapEsterStrong: { fontFamily: fonts.catalogueBold },
  swapList: { maxHeight: 330 },
  /* Her option card: name, reason, amount, radio on the right. */
  swapOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(54,20,22,0.15)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  swapOptionOn: { borderColor: K.brown, borderWidth: 1.5 },
  swapOptionBody: { flex: 1, gap: 4 },
  swapOptionName: { fontFamily: fonts.catalogueMedium, fontSize: 16, color: K.brown },
  swapOptionWhy: {
    fontFamily: fonts.catalogue,
    fontSize: 13,
    color: K.brown,
    opacity: 0.7,
    lineHeight: 18,
  },
  swapOptionQty: { fontFamily: fonts.quadrant, fontSize: 13, color: K.brown, opacity: 0.55 },
  swapRadio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(54,20,22,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  swapRadioOn: { backgroundColor: K.brown, borderColor: K.brown },
  swapTick: { color: K.bone, fontSize: 13, lineHeight: 16 },
  swapConfirm: {
    backgroundColor: K.brown,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  swapConfirmOff: { opacity: 0.45 },
  swapConfirmText: { fontFamily: fonts.catalogueMedium, fontSize: 16, color: K.bone },
  swapKeep: { alignItems: "center", paddingVertical: 10 },
  swapKeepText: { fontFamily: fonts.catalogueMedium, fontSize: 14, color: K.brown },
  // ── Persistent action bar + add sheet (2026-10-19) ───────────────────
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: ACTION_BAR_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: K.brown,
    borderTopWidth: 1,
    borderTopColor: "rgba(243,239,227,0.14)",
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPrimary: { backgroundColor: K.cream },
  actionPrimaryText: { fontFamily: fonts.catalogue, fontSize: 16, color: K.brown },
  actionSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.35)",
  },
  actionSecondaryText: { fontFamily: fonts.catalogue, fontSize: 16, color: K.cream },
  actionDisabled: { opacity: 0.4 },
  addBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  addSheet: {
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
  addTitle: { fontFamily: fonts.catalogue, fontSize: 20, color: K.cream, letterSpacing: -0.2 },
  addSub: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: K.bone,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 12,
  },
  dayRow: { flexGrow: 0, marginBottom: 6 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(243,239,227,0.25)",
    marginRight: 8,
  },
  dayChipOn: { backgroundColor: K.cream, borderColor: K.cream },
  dayChipText: { fontFamily: fonts.catalogue, fontSize: 14, color: K.cream },
  dayChipTextOn: { color: K.brown },
  slotRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(243,239,227,0.14)",
  },
  slotRowLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    color: K.bone,
    opacity: 0.7,
    marginBottom: 2,
  },
  slotRowText: { fontFamily: fonts.catalogue, fontSize: 16, color: K.cream },
  loadingOverlay: {
    position: "absolute",
    top: HERO_HEIGHT - 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});

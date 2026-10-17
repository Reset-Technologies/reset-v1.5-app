import React, { useState, useEffect, useMemo, useCallback } from "react";
import { shareWithLink } from "../../constants/links";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  Dimensions,
  Share,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
  CommonActions,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Rect, Stop, Circle } from "react-native-svg";
import { K, toMetabolicType, type MetabolicType } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import type { Meal } from "../../components";
import { AiConsentNudge } from "../../components";
import { useAiConsentGate } from "../../hooks/useAiConsentGate";
import { BookmarkIcon } from "../../components/BookmarkIcon";
import { ArrowBackIcon } from "../../components/PaywallIcons";
import {
  getMealDetail,
  getMealIngredients,
  getSubstituteSuggestions,
  applySubstitution,
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
import { COUNTABLE_UNITS } from "../../utils/countableUnits";
import { setPlannedMealServings } from "../../services/myPlan";
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

function parseInstructions(instructions: string | null): string[] {
  if (!instructions) return [];

  const normalized = instructions
    .replace(/\.(?=[A-Za-z])/g, ". ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/^\s*Instructions\s*:?\s*/i, " ")
    .replace(/^\s*Instructions(?=[A-Z])/, " ")
    .replace(/^\s*\d+\.\s*/gm, " ")
    .replace(/(?:^|\s)\d+\.\s+/g, " ")
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

const UNIT_ABBREVIATIONS: Record<string, string> = {
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  ounce: "oz",
  ounces: "oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  pound: "lb",
  pounds: "lbs",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  milliliter: "ml",
  milliliters: "ml",
  liter: "L",
  liters: "L",
};

function abbreviateMeasurement(measurement: string): string {
  if (!measurement) return "";
  const lower = measurement.trim().toLowerCase();
  return UNIT_ABBREVIATIONS[lower] ?? measurement;
}


const FRACTION_STOPS: Array<{ value: number; glyph: string }> = [
  { value: 0, glyph: "" },
  { value: 1 / 8, glyph: "⅛" },
  { value: 1 / 4, glyph: "¼" },
  { value: 1 / 3, glyph: "⅓" },
  { value: 3 / 8, glyph: "⅜" },
  { value: 1 / 2, glyph: "½" },
  { value: 5 / 8, glyph: "⅝" },
  { value: 2 / 3, glyph: "⅔" },
  { value: 3 / 4, glyph: "¾" },
  { value: 7 / 8, glyph: "⅞" },
  { value: 1, glyph: "" },
];

function formatQty(qty: number, measurement: string): string {
  if (!isFinite(qty) || qty <= 0) return "0";
  const unit = (measurement || "").trim().toLowerCase();
  if (COUNTABLE_UNITS.has(unit)) {
    return Math.max(1, Math.round(qty)).toString();
  }
  if (qty >= 10) return Math.round(qty).toString();

  const intPart = Math.floor(qty);
  const fracPart = qty - intPart;
  let best = FRACTION_STOPS[0];
  let bestDelta = 1;
  for (const stop of FRACTION_STOPS) {
    const delta = Math.abs(fracPart - stop.value);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = stop;
    }
  }
  if (best.value === 1) return (intPart + 1).toString();
  if (best.value === 0) {
    if (intPart > 0) return intPart.toString();
    // 🔴 A real amount must never print as "0". This branch was unreachable
    // until Standard became one serving and quantities started being divided:
    // 1/4 tsp of cayenne in a 4-serving recipe is 1/16, whose nearest stop is
    // zero, and the screen told the member to use NONE of it. "< 1/8" is the
    // honest reading — smaller than the finest fraction we show, but present.
    return `< ${FRACTION_STOPS[1].glyph}`;
  }
  if (intPart === 0) return best.glyph;
  return `${intPart} ${best.glyph}`;
}

function renderBoldSegments(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text key={i} style={{ fontFamily: fonts.dmSansBold }}>
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

export function RecipeDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "RecipeDetail">>();
  const { meal } = route.params;
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const { aiConsentGranted } = useAiConsentGate();
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
          amount: `${ing.quantity} ${ing.measurement}`.trim(),
          recipeTitle: meal.name,
        });
        setSuggestions(opts);
        // Lang's frame has the first option pre-selected.
        setChosen(opts[0]?.ingredientId ?? null);
      } catch {
        // An empty list renders the honest "no substitutes" state rather than
        // an error the member can do nothing with.
        setSuggestions([]);
      }
    },
    [plannedMeal, meal.name],
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
      await applySubstitution({
        plannedMealId: plannedMeal.id,
        mealPlanId: plannedMeal.mealPlanId,
        fromIngredientId: swapFor.ingredientId,
        toIngredientId: chosen,
      });
      setSwapFor(null);
      const fresh = await getMealIngredients(meal.id);
      setIngredients(fresh);
    } catch {
      // Leave the drawer open so the member can try again or back out; a
      // silent close would look like it worked.
    } finally {
      setSwapping(false);
    }
  }, [plannedMeal, swapFor, chosen, swapping, meal.id]);

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
    } catch {
      setIsFavorited(!next);
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
  const servingsBase = detail?.servingsMin ?? 1;
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
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
                  <Text style={styles.tagText}>{prepTime} minutes</Text>
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
                  const qtyDisplay = formatQty(qty, ing.measurement);
                  // 🔑 Tappable ONLY with a planned meal behind the screen —
                  // a substitution changes a planned recipe instance, so from
                  // Home or Saved Meals there is nothing to change. Same
                  // distinction the serving control already draws.
                  const Row: React.ElementType = plannedMeal ? Pressable : View;
                  return (
                    <Row
                      key={ing.id + idx}
                      onPress={plannedMeal ? () => openSwap(ing) : undefined}
                      style={[
                        styles.ingredientRow,
                        idx === 0 ? styles.ingredientRowFirst : null,
                      ]}
                      accessibilityRole={plannedMeal ? "button" : undefined}
                      accessibilityLabel={
                        plannedMeal ? `Swap ${ing.ingredientName}` : undefined
                      }
                    >
                      <Text style={styles.ingredientQty} numberOfLines={2}>
                        {qtyDisplay} {abbreviateMeasurement(ing.measurement)}
                      </Text>
                      <Text style={styles.ingredientName}>
                        {ing.ingredientName}
                      </Text>
                    </Row>
                  );
                })}
              </View>
            </View>
          ) : null}

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
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  // Nutrition row
  macroLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  macroValue: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  macroUnit: {
    fontFamily: fonts.dmSansBold,
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
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSans,
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
  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingBottom: 12,
    paddingTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: K.border,
  },
  ingredientRowFirst: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: K.border,
  },
  ingredientQty: {
    width: 70,
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
  },
  ingredientName: {
    flex: 1,
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
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
    fontFamily: fonts.dmSansBold,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.sub,
  },
  stepText: {
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: K.brown,
  },
  moreCtaButtonGlyph: {
    fontFamily: fonts.dmSans,
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
    fontFamily: fonts.dmSans,
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
  swapTitle: { fontFamily: fonts.dmSans, fontSize: 26, color: K.brown, letterSpacing: -0.3 },
  swapClose: { fontFamily: fonts.dmSans, fontSize: 20, color: K.brown, opacity: 0.7 },
  swapLoading: { paddingVertical: 36, alignItems: "center" },
  swapEmpty: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    color: K.brown,
    opacity: 0.7,
    paddingVertical: 24,
  },
  swapEsterLabel: {
    fontFamily: fonts.dmSans,
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
  swapEsterText: { fontFamily: fonts.dmSans, fontSize: 15, color: K.brown, lineHeight: 21 },
  swapEsterStrong: { fontFamily: fonts.dmSansBold },
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
  swapOptionName: { fontFamily: fonts.dmSansMedium, fontSize: 16, color: K.brown },
  swapOptionWhy: {
    fontFamily: fonts.dmSans,
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
  swapConfirmText: { fontFamily: fonts.dmSansMedium, fontSize: 16, color: K.bone },
  swapKeep: { alignItems: "center", paddingVertical: 10 },
  swapKeepText: { fontFamily: fonts.dmSansMedium, fontSize: 14, color: K.brown },
  loadingOverlay: {
    position: "absolute",
    top: HERO_HEIGHT - 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});

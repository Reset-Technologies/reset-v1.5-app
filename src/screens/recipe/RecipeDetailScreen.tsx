import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { BookmarkIcon } from "../../components/BookmarkIcon";
import {
  getMealDetail,
  getMealIngredients,
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
import type { MainStackParamList } from "../../navigation/MainNavigator";
import { logEvent } from "../../services/braze";

type RecipeRouteParams = {
  RecipeDetail: {
    meal: Meal;
    siblings?: Meal[];
  };
};

const HERO_HEIGHT = 360;
const SCREEN_WIDTH = Dimensions.get("window").width;

// Spoonacular nutrient names that are *macros* (and thus excluded from the
// vitamins-and-minerals %DV rollup).
const MACRO_NAMES = new Set([
  "Calories",
  "Fat",
  "Saturated Fat",
  "Trans Fat",
  "Mono Unsaturated Fat",
  "Poly Unsaturated Fat",
  "Carbohydrates",
  "Net Carbohydrates",
  "Sugar",
  "Cholesterol",
  "Protein",
  "Fiber",
  "Alcohol",
  "Caffeine",
]);

function computeMicrosPctRollup(nutrients: MealNutrient[] | null): number | null {
  if (!nutrients || nutrients.length === 0) return null;
  const micros = nutrients.filter(
    (n) =>
      !MACRO_NAMES.has(n.name) &&
      typeof n.percentOfDailyNeeds === "number" &&
      n.percentOfDailyNeeds > 0,
  );
  if (micros.length === 0) return null;
  const sum = micros.reduce(
    (acc, n) => acc + Math.min(100, n.percentOfDailyNeeds!),
    0,
  );
  return Math.round(sum / micros.length);
}

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

const WHOLE_PIECE_UNITS = new Set([
  "",
  "egg",
  "eggs",
  "piece",
  "pieces",
  "slice",
  "slices",
  "clove",
  "cloves",
  "head",
  "heads",
  "leaf",
  "leaves",
  "stalk",
  "stalks",
  "stick",
  "sticks",
  "sprig",
  "sprigs",
  "can",
  "cans",
  "bottle",
  "bottles",
  "jar",
  "jars",
  "package",
  "packages",
  "packet",
  "packets",
  "small",
  "medium",
  "large",
  "serving",
  "servings",
]);

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
  if (WHOLE_PIECE_UNITS.has(unit)) {
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
  if (best.value === 0) return intPart > 0 ? intPart.toString() : "0";
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

export function RecipeDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<RecipeRouteParams, "RecipeDetail">>();
  const { meal } = route.params;
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  // The Ester bubble's avatar + gradient reflect the user's metabolic type.
  const metabolicType: MetabolicType =
    toMetabolicType(state.user.metabolicType) ?? "Explorer";

  const [detail, setDetail] = useState<MealDetail | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [siblings, setSiblings] = useState<Meal[]>(
    route.params.siblings ?? [],
  );
  const [servings, setServings] = useState<number>(1);
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
          getMealDetail(meal.id),
          getMealIngredients(meal.id),
        ]);
        if (cancelled) return;
        setDetail(mealDetail);
        setIngredients(mealIngredients);
        setServings(mealDetail.servingsMin ?? 1);
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
  }, [meal.id]);

  useEffect(() => {
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
  }, [meal.id]);

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

  const handleClose = () => {
    navigation.dispatch(CommonActions.goBack());
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${meal.name} — recommended by Ester on Reset`,
      });
    } catch {
      // Cancelled or share failed silently
    }
  };

  const handleToggleFavorite = async () => {
    const next = !isFavorited;
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
  const calories = detail?.calories ?? meal.calories;
  const protein = detail?.proteinGrams ?? meal.protein;
  const carbs = detail?.carbsGrams ?? 0;
  const fat = detail?.fatGrams ?? 0;
  const fiber = detail?.fiberGrams ?? 0;
  const prepTime = detail?.prepTime ?? meal.prepTime;
  const esterMessage = esterText ?? (esterLoading ? null : meal.whyLine);
  const servingsBase = detail?.servingsMin ?? 1;
  const dietTags = (detail?.diets ?? [])
    .map((d) => d.name)
    .filter(Boolean)
    .slice(0, 3);

  const microsPct = useMemo(
    () => computeMicrosPctRollup(detail?.nutrientsJson ?? null),
    [detail?.nutrientsJson],
  );

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

          {/* Nutrition: calories pill + 4 macro chips */}
          <View style={styles.nutritionRow}>
            <View style={styles.caloriesPill}>
              <Text style={styles.caloriesLabel}>Calories</Text>
              <Text style={styles.caloriesValue}>
                {Math.round(Number(calories ?? 0))}
              </Text>
            </View>
            <View style={styles.macrosPill}>
              <MacroChip
                label="Protein"
                value={Math.round(Number(protein ?? 0))}
              />
              <MacroChip
                label="Carbs"
                value={Math.round(Number(carbs ?? 0))}
              />
              <MacroChip label="Fat" value={Math.round(Number(fat ?? 0))} />
              <MacroChip
                label="Fiber"
                value={Math.round(Number(fiber ?? 0))}
              />
            </View>
          </View>

          {/* %DV rollup (vitamins + minerals) */}
          {microsPct !== null ? (
            <View style={styles.dvRow}>
              <DvMeter pct={microsPct} />
              <Text style={styles.dvValue}>{microsPct}%</Text>
              <Text style={styles.dvCaption}>
                of daily vitamins + minerals
              </Text>
            </View>
          ) : null}

          {/* Message from Ester */}
          {esterLoading || esterMessage ? (
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
                  <Text style={styles.sectionMeta}>
                    {servings} {servings === 1 ? "Serving" : "Servings"}
                  </Text>
                </View>
                <View style={styles.servingsStepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() =>
                      setServings((s) => Math.max(1, s - 1))
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.stepperGlyph}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{servings}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setServings((s) => s + 1)}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperGlyph}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.ingredientsList}>
                {ingredients.map((ing, idx) => {
                  const scale = servingsBase > 0 ? servings / servingsBase : 1;
                  const qty = ing.quantity * scale;
                  const qtyDisplay = formatQty(qty, ing.measurement);
                  return (
                    <View
                      key={ing.id + idx}
                      style={[
                        styles.ingredientRow,
                        idx === 0 ? styles.ingredientRowFirst : null,
                      ]}
                    >
                      <Text style={styles.ingredientQty} numberOfLines={2}>
                        {qtyDisplay} {abbreviateMeasurement(ing.measurement)}
                      </Text>
                      <Text style={styles.ingredientName}>
                        {ing.ingredientName}
                      </Text>
                    </View>
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
          <TouchableOpacity
            style={styles.headerCloseButton}
            onPress={handleClose}
            hitSlop={8}
            accessibilityLabel="Close"
          >
            <Text style={styles.headerCloseGlyph}>✕</Text>
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
    </View>
  );
}

function MacroChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.macroChip}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>
        {value}
        <Text style={styles.macroUnit}>g</Text>
      </Text>
    </View>
  );
}

function DvMeter({ pct }: { pct: number }) {
  const size = 20;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - filled / 100);
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={K.border}
        strokeWidth={3}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={K.brown}
        strokeWidth={3}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
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
  nutritionRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "stretch",
  },
  caloriesPill: {
    width: 77,
    height: 80,
    backgroundColor: K.blue,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  caloriesLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.brown,
  },
  caloriesValue: {
    fontFamily: fonts.dmSansBold,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
  macrosPill: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: K.bone,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 8,
    paddingVertical: 4,
  },
  macroChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
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
  dvRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dvValue: {
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
    marginLeft: 5,
  },
  dvCaption: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.sub,
  },
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
  sectionMeta: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.brown,
  },
  servingsStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: K.white,
    borderColor: K.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: {
    fontSize: 22,
    fontFamily: fonts.dmSans,
    color: K.brown,
    lineHeight: 24,
  },
  stepperValue: {
    minWidth: 30,
    textAlign: "center",
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.brown,
  },
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
  headerCloseGlyph: {
    fontSize: 18,
    color: K.brown,
    fontFamily: fonts.dmSans,
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
  loadingOverlay: {
    position: "absolute",
    top: HERO_HEIGHT - 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});

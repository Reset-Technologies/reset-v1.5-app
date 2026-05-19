import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, CommonActions, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import {
  getDailyPlan,
  submitMealFeedback,
  replaceMealInSlot,
  getMealIngredients,
  type DailyPlan,
  type DailyPlanMeal,
  type MealIngredient,
} from "../../services/meals";
import { getResetScore } from "../../services/resetScore";
import { useAppPalette } from "../../hooks/useAppPalette";
import { useSwipeToAdvance } from "../../hooks/useSwipeToAdvance";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";
import { logEvent } from "../../services/braze";

type FeedbackState = "idle" | "up" | "down";

type Slot = "breakfast" | "lunch" | "dinner" | "snack";

const SLOT_ORDER: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

function preferredSlot(): Slot {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}

function mealsForSlot(plan: DailyPlan, slot: Slot): DailyPlanMeal[] {
  if (slot === "snack") return plan.snack ? [plan.snack] : [];
  return plan[slot] ?? [];
}

function pickMealInSlot(
  plan: DailyPlan,
  slot: Slot,
): DailyPlanMeal | null {
  const meals = mealsForSlot(plan, slot);
  if (meals.length === 0) return null;
  const eaten = new Set(plan.eatenMealIds?.[slot] ?? []);
  return meals.find((m) => !eaten.has(m.id)) ?? meals[0];
}

function pickNextMeal(plan: DailyPlan): { slot: Slot; meal: DailyPlanMeal } | null {
  const preferred = preferredSlot();
  const start = SLOT_ORDER.indexOf(preferred);
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const slot = SLOT_ORDER[(start + i) % SLOT_ORDER.length];
    const meal = pickMealInSlot(plan, slot);
    if (meal) return { slot, meal };
  }
  return null;
}

function formatPrep(meal: DailyPlanMeal): string {
  return meal.prepTime ? `${meal.prepTime} mins` : "";
}

function formatMacros(meal: DailyPlanMeal): string | null {
  const parts: string[] = [];
  if (meal.calories) parts.push(`~${Math.round(meal.calories)} cal`);
  if (meal.protein) parts.push(`${Math.round(meal.protein)}g protein`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Build tag pills from the meal's classification fields. Only surface
// positively-framed values — "neutral" and "ultra_processed" don't read as
// helpful selling points on a recommendation card.
function buildTags(meal: DailyPlanMeal): string[] {
  const tags: string[] = [];
  if (meal.inflammatoryIndex === "anti") tags.push("Anti-inflammatory");
  if (meal.foodQuality === "whole") tags.push("Whole foods");
  if (meal.cuisineCluster) {
    tags.push(
      meal.cuisineCluster.charAt(0).toUpperCase() + meal.cuisineCluster.slice(1),
    );
  }
  return tags.slice(0, 3);
}

export function NextMealScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const route = useRoute<RouteProp<AppOpenStackParamList, "NextMeal">>();
  // True when the user just finished onboarding (paywall → NextMeal). Switches
  // the header + intro to a first-meal/welcome variant instead of the daily
  // "Thinking of you" framing.
  const fromOnboarding = route.params?.fromOnboarding === true;
  const insets = useSafeAreaInsets();
  const { outerBg, innerBg, nestedBg, textColor, subtleText, borderColor, statusBarStyle } =
    useAppPalette();

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [slot, setSlot] = useState<Slot>("breakfast");
  const [meal, setMeal] = useState<DailyPlanMeal | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [hasScore, setHasScore] = useState(false);

  useEffect(() => {
    getResetScore()
      .then((res) => {
        setHasScore(
          res.status === "active" && !!res.score && res.score.score > 0,
        );
      })
      .catch(() => setHasScore(false));
  }, []);

  useEffect(() => {
    getDailyPlan()
      .then((dp) => {
        setPlan(dp);
        const next = pickNextMeal(dp);
        if (next) {
          setSlot(next.slot);
          setMeal(next.meal);
        }
      })
      .catch(() => {
        setPlan(null);
      });
  }, []);

  useEffect(() => {
    if (!meal?.id) {
      setIngredients([]);
      return;
    }
    let cancelled = false;
    getMealIngredients(meal.id)
      .then((list) => {
        if (!cancelled) setIngredients(list);
      })
      .catch(() => {
        if (!cancelled) setIngredients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [meal?.id]);

  const advanceToInsights = () => {
    const parent = navigation.getParent();
    if (fromOnboarding) {
      // Post-onboarding entry: land on the home tab, not the scan-insights
      // screen — the user just finished setup, they should see Home next.
      parent?.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Tabs" }],
        }),
      );
      return;
    }
    parent?.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Tabs" },
          { name: "ScanInsights", params: { fromAppOpen: true } },
        ],
      }),
    );
  };

  const handleAskEster = () => {
    logEvent("home_meal_askEsterCTA", { mealId: meal?.id, surface: "nextMeal" });
    const parent = navigation.getParent();
    if (meal) {
      parent?.navigate("EsterChat", { context: "meal", meal });
    } else {
      parent?.navigate("EsterChat", { context: "general" });
    }
  };

  const handleFeedback = async (value: "up" | "down") => {
    if (!meal || !plan) return;
    logEvent(
      value === "up" ? "home_meal_thumbsUpCTA" : "home_meal_thumbsDownCTA",
      { slot, mealId: meal.id, surface: "nextMeal" },
    );
    setFeedback(value);
    try {
      await submitMealFeedback({
        mealId: meal.id,
        planId: plan.id,
        slot,
        feedback: value,
      });
    } catch {
      setFeedback("idle");
    }
  };

  const handleRegenerate = async () => {
    if (!plan || !meal || refreshing || slot === "snack") return;
    logEvent("home_meal_replaceCTA", { mealId: meal.id, slot, surface: "nextMeal" });
    setRefreshing(true);
    try {
      const updated = await replaceMealInSlot(
        plan.id,
        slot,
        [meal.id],
        meal.id,
      );
      setPlan(updated);
      const nextInSlot = pickMealInSlot(updated, slot);
      if (nextInSlot) setMeal(nextInSlot);
      setFeedback("idle");
    } catch {
      // keep current state
    } finally {
      setRefreshing(false);
    }
  };

  const loading = plan === null && meal === null;
  const prepMeta = meal ? formatPrep(meal) : "";
  const macrosLine = meal ? formatMacros(meal) : null;
  const tags = meal ? buildTags(meal) : [];
  const ingredientsLine =
    ingredients.length > 0
      ? ingredients
          .slice(0, 4)
          .map((i) =>
            i.ingredientName.charAt(0).toUpperCase() +
            i.ingredientName.slice(1),
          )
          .join(" · ")
      : null;

  const swipeHandlers = useSwipeToAdvance({
    axis: "down",
    onAdvance: advanceToInsights,
  });

  return (
    <View
      style={[styles.root, { backgroundColor: outerBg }]}
      {...swipeHandlers}
    >
      <StatusBar barStyle={statusBarStyle} translucent />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={[styles.card, { backgroundColor: innerBg }]}>
          <View style={styles.cardInner}>
            <View style={styles.cardTop}>
              <View style={styles.header}>
                <View style={styles.brandLogo}>
                  <Image
                    source={require("../../../assets/images/quick-scan-mascot.png")}
                    style={[styles.brandLogoImage, { tintColor: textColor }]}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  style={[styles.title, { color: textColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  pointerEvents="none"
                >
                  {fromOnboarding ? "Welcome to Reset" : "Thinking of you"}
                </Text>
                {/* Symmetric spacer balancing the logo width so the title's
                    flex-1 region stays centered on screen. */}
                <View style={styles.brandLogoSpacer} />
              </View>

              <Text style={[styles.intro, { color: textColor }]}>
                {fromOnboarding
                  ? meal?.whyLine
                    ? `Here's your first meal recommendation, picked for your body. ${meal.whyLine}`
                    : "Here's your first meal recommendation, picked for your body."
                  : meal?.whyLine
                  ? hasScore
                    ? `Based on your recent score, I picked this for you. ${meal.whyLine}`
                    : `I picked this one out for you. ${meal.whyLine}`
                  : "This meal just came across my desk. I think you'd love it — want to add it to the rotation?"}
              </Text>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color={textColor} />
                </View>
              ) : meal ? (
                <View style={[styles.recipeCard, { backgroundColor: nestedBg }]}>
                  <View style={styles.recipeRow}>
                    <View style={[styles.recipeImageWrap, { backgroundColor: borderColor }]}>
                      {meal.imageUrl ? (
                        <Image
                          source={{ uri: meal.imageUrl }}
                          style={styles.recipeImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.recipeImagePlaceholder, { backgroundColor: borderColor }]} />
                      )}
                    </View>
                    <View style={styles.recipeInfo}>
                      <Text style={[styles.recipeName, { color: textColor }]} numberOfLines={2}>
                        {meal.name}
                      </Text>
                      {prepMeta ? (
                        <Text style={[styles.recipeMeta, { color: subtleText }]}>{prepMeta}</Text>
                      ) : null}
                      {ingredientsLine ? (
                        <Text
                          style={[styles.ingredients, { color: subtleText }]}
                          numberOfLines={3}
                        >
                          {ingredientsLine}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {macrosLine ? (
                    <Text style={[styles.macros, { color: textColor }]}>
                      {macrosLine}
                    </Text>
                  ) : null}

                  {tags.length > 0 ? (
                    <View style={styles.tagsRow}>
                      {tags.map((tag) => (
                        <View
                          key={tag}
                          style={[styles.tagPill, { backgroundColor: innerBg }]}
                        >
                          <Text style={[styles.tagLabel, { color: textColor }]}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {feedback === "idle" ? (
                    <View style={styles.feedbackRow}>
                      <TouchableOpacity
                        style={[styles.feedbackButton, { backgroundColor: innerBg }]}
                        onPress={() => handleFeedback("up")}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.feedbackLabel, { color: textColor }]}>Sounds great</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.feedbackButton,
                          styles.feedbackButtonMuted,
                          { backgroundColor: innerBg },
                        ]}
                        onPress={() => handleFeedback("down")}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.feedbackLabel, { color: textColor }]}>Not into it</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.feedbackAck}>
                      <Text style={[styles.feedbackAckText, { color: textColor }]}>
                        {feedback === "up"
                          ? "Added to your rotation — I'll work it in this week."
                          : "Got it — I'll steer clear of ones like this."}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.regenerateRow}
                    onPress={handleRegenerate}
                    disabled={refreshing || slot === "snack"}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.regenerateIcon, { color: textColor }]}>↻</Text>
                    <Text style={[styles.regenerateLabel, { color: textColor }]}>
                      {refreshing
                        ? "Finding another…"
                        : "What else you got for me?"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: subtleText }]}>
                    No meal plan yet — pull one together on the home screen.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={[styles.askEsterPill, { backgroundColor: innerBg, borderColor }]}
                onPress={handleAskEster}
                activeOpacity={0.8}
              >
                <View style={styles.askEsterAvatar}>
                  <Image
                    source={require("../../../assets/images/ester-logo.png")}
                    style={styles.askEsterAvatarImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.askEsterLabel, { color: textColor }]}>Ask Ester</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.arrowButton, { backgroundColor: innerBg, borderColor: textColor }]}
                onPress={advanceToInsights}
                activeOpacity={0.8}
              >
                <Text style={[styles.arrowIcon, { color: textColor }]}>↓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  card: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 28,
    overflow: "hidden",
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cardTop: {
    flex: 1,
    gap: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandLogo: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoImage: {
    width: "100%",
    height: "100%",
  },
  brandLogoSpacer: {
    width: 48,
    height: 48,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.dmSansBold,
    fontSize: 26,
    letterSpacing: -0.3,
  },
  intro: {
    fontFamily: fonts.dmSans,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyWrap: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    textAlign: "center",
  },
  recipeCard: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.md,
  },
  recipeRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  recipeImageWrap: {
    width: 114,
    height: 114,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  recipeImagePlaceholder: {
    width: "100%",
    height: "100%",
  },
  recipeInfo: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 4,
  },
  recipeName: {
    fontFamily: fonts.dmSansBold,
    fontSize: 16,
    letterSpacing: -0.16,
  },
  recipeMeta: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    letterSpacing: -0.14,
  },
  ingredients: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.13,
  },
  macros: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    letterSpacing: -0.14,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  tagPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  tagLabel: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  feedbackRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  feedbackButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackButtonMuted: {
    opacity: 0.7,
  },
  feedbackLabel: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
  },
  feedbackAck: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  feedbackAckText: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  regenerateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 8,
  },
  regenerateIcon: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 16,
  },
  regenerateLabel: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  askEsterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: 7,
    paddingRight: 16,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  askEsterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: K.brown,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  askEsterAvatarImage: {
    width: "108%",
    height: "108%",
  },
  askEsterLabel: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
  },
  arrowButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowIcon: {
    fontSize: 22,
    fontWeight: "400",
  },
});

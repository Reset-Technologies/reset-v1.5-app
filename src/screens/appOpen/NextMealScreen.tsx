import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, CommonActions, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";
import { K, toMetabolicType } from "../../constants/colors";
import { fonts, spacing, radius } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
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
import { getMealWhy } from "../../services/mealInsights";
import { useAppPalette } from "../../hooks/useAppPalette";
import { useAiConsentGate } from "../../hooks/useAiConsentGate";
import { AiConsentNudge } from "../../components/AiConsentNudge";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";
import { logEvent } from "../../services/braze";

// The user's metabolic-type mark (full-colour), shown centered in the top bar.
// Ember maps to the "Restorer" asset (display name = Restorer, key = Ember).
const TYPE_LOGO = {
  Burner: require("../../../assets/images/type-logos/Burner.png"),
  Rebounder: require("../../../assets/images/type-logos/Rebounder.png"),
  Ember: require("../../../assets/images/type-logos/Restorer.png"),
  Chameleon: require("../../../assets/images/type-logos/Chameleon.png"),
  Explorer: require("../../../assets/images/type-logos/Explorer.png"),
};

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

function pickMealInSlot(plan: DailyPlan, slot: Slot): DailyPlanMeal | null {
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

// Render the LLM why-blurb, turning **double-asterisk** spans into bold runs
// (the generate_meal_why_blurb tool highlights the fit-phrases this way).
function renderBoldSegments(text: string, boldColor: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p.length > 0)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <Text key={i} style={{ fontFamily: fonts.catalogueBold, color: boldColor }}>
          {part.slice(2, -2)}
        </Text>
      ) : (
        <Text key={i}>{part}</Text>
      ),
    );
}

// Per-variant heading — a regular lead-in + a bold emphasis clause, matching the
// Figma "picked for your body." treatment. whyLine moved out of the heading and
// into the "Why this meal?" bubble below the photo.
function headingFor(fromOnboarding: boolean, hasScore: boolean): {
  lead: string;
  strong: string;
} {
  if (fromOnboarding) {
    return {
      lead: "Here's your first meal recommendation, ",
      strong: "picked for your body.",
    };
  }
  if (hasScore) {
    return {
      lead: "Based on your recent score, ",
      strong: "I picked this one for you.",
    };
  }
  return {
    lead: "This one just came across my desk — ",
    strong: "I think you'd love it.",
  };
}

// Chat-style typing indicator shown in the why-bubble while the LLM blurb loads,
// so the user never sees the short template line flash before the paragraph.
function WhyTypingDots({ color }: { color: string }) {
  const d0 = useRef(new Animated.Value(0.3)).current;
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const dots = [d0, d1, d2];
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [d0, d1, d2]);

  return (
    <View style={styles.typingRow}>
      {[d0, d1, d2].map((d, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { backgroundColor: color, opacity: d }]}
        />
      ))}
    </View>
  );
}

export function NextMealScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const route = useRoute<RouteProp<AppOpenStackParamList, "NextMeal">>();
  // True when the user just finished onboarding (paywall → NextMeal). Switches
  // the heading to a first-meal/welcome variant instead of the daily framing.
  const fromOnboarding = route.params?.fromOnboarding === true;
  const { state } = useApp();
  const { aiConsentGranted } = useAiConsentGate();
  const metabolicType = toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const insets = useSafeAreaInsets();
  const { evening, outerBg, innerBg, nestedBg, textColor, subtleText, borderColor, statusBarStyle } =
    useAppPalette();

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [slot, setSlot] = useState<Slot>("breakfast");
  const [meal, setMeal] = useState<DailyPlanMeal | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  // Richer LLM "why this meal" blurb (3 sentences). Fetched per-meal; while it's
  // in flight the bubble shows a typing indicator (not the short template
  // whyLine) to avoid a jarring short-text flash. whyError flips the fallback to
  // the template whyLine if the fetch fails.
  const [esterWhy, setEsterWhy] = useState<string | null>(null);
  const [whyError, setWhyError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [hasScore, setHasScore] = useState(false);
  // Tracked separately so an errored fetch doesn't leave the screen stuck
  // in the spinner state. We flip this once the plan-fetch settles either
  // way — the empty-state copy then renders if no meal came back.
  const [planFetchDone, setPlanFetchDone] = useState(false);

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
      })
      .finally(() => {
        setPlanFetchDone(true);
      });
  }, []);

  useEffect(() => {
    if (!meal?.id) {
      setEsterWhy(null);
      setWhyError(false);
      return;
    }
    // RES-188 — the "why this meal" blurb is OpenAI-generated. Skip the fetch
    // when third-party-AI consent is off; the render shows the AiConsentNudge
    // in place. Granting flips aiConsentGranted and re-runs this effect.
    if (!aiConsentGranted) {
      setEsterWhy(null);
      setWhyError(false);
      return;
    }
    let cancelled = false;
    setEsterWhy(null);
    setWhyError(false);
    getMealWhy(meal.id)
      .then((res) => {
        if (!cancelled) setEsterWhy(res.text);
      })
      .catch(() => {
        // Fall back to the template whyLine.
        if (!cancelled) setWhyError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [meal?.id, aiConsentGranted]);

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

  const handleRegenerate = async () => {
    if (!plan || !meal || refreshing || slot === "snack") return;
    logEvent("home_meal_replaceCTA", { mealId: meal.id, slot, surface: "nextMeal" });
    setRefreshing(true);
    try {
      const updated = await replaceMealInSlot(plan.id, slot, [meal.id], meal.id);
      setPlan(updated);
      const nextInSlot = pickMealInSlot(updated, slot);
      if (nextInSlot) setMeal(nextInSlot);
    } catch {
      // keep current state
    } finally {
      setRefreshing(false);
    }
  };

  // "I like it!" — record the positive signal, then move on. Feedback is
  // awaited best-effort but never blocks the advance.
  const handleLike = async () => {
    if (!meal || !plan || advancing) return;
    setAdvancing(true);
    logEvent("home_meal_thumbsUpCTA", { slot, mealId: meal.id, surface: "nextMeal" });
    try {
      await submitMealFeedback({ mealId: meal.id, planId: plan.id, slot, feedback: "up" });
    } catch {
      // advance regardless — the signal is non-critical
    }
    advanceToInsights();
  };

  // "Not a fan, show me another" — record the negative signal (fire-and-forget)
  // and swap in a fresh meal for this slot in place.
  const handleNotAFan = async () => {
    if (!meal || !plan || refreshing) return;
    logEvent("home_meal_thumbsDownCTA", { slot, mealId: meal.id, surface: "nextMeal" });
    submitMealFeedback({ mealId: meal.id, planId: plan.id, slot, feedback: "down" }).catch(
      () => {},
    );
    await handleRegenerate();
  };

  // Show the spinner only while the fetch is in flight. Once it settles
  // (success or failure), fall through to either the meal card or the
  // empty-state copy.
  const loading = !planFetchDone;
  const prepMeta = meal ? formatPrep(meal) : "";
  const ingredientsCount = ingredients.length;
  const tags = meal ? buildTags(meal) : [];
  // Prefer the richer LLM blurb once it arrives; fall back to the short template.
  const whyMessage = esterWhy ?? meal?.whyLine ?? "";
  // True while the LLM blurb is still loading (no result yet, no error) — show
  // the typing indicator instead of the short template line.
  const whyPending = !!meal && !esterWhy && !whyError;
  const heading = headingFor(fromOnboarding, hasScore);
  // RES-166 (Route B): if the just-submitted check-in actually moved this meal,
  // the backend attached the reason. Prefer the change for the slot on screen;
  // else fall back to the first change. Absent when nothing moved. We fold it in
  // as a bold lead sentence on the "Why this meal?" paragraph rather than a
  // separate banner, so it explains the change without stealing screen height.
  const checkInChange = plan?.signalAdjustments?.checkInChange;
  const checkInReason = checkInChange?.changed
    ? (checkInChange.changes.find((c) => c.slot === slot)?.reason ??
      checkInChange.changes[0]?.reason ??
      null)
    : null;
  // "Based on your check-in, {reason}." bolded, prepended to the why blurb. The
  // reason strings already start mid-sentence ("you flagged stress — …"), so the
  // capitalised lead reads naturally.
  const whyLead = checkInReason ? `Based on your check-in, ${checkInReason}.` : "";
  // The blurb the bubble shows: bold lead (when a change happened) + the LLM/why
  // copy. renderBoldSegments turns the **…** into a bold span.
  const whyBody = whyLead
    ? whyMessage
      ? `**${whyLead}** ${whyMessage}`
      : `**${whyLead}**`
    : whyMessage;
  // Chat-bubble surface — brown-tinted ghost on light themes, bone-tinted on dark.
  const chipBg = evening ? "rgba(243,239,227,0.14)" : "rgba(54,20,22,0.12)";
  // Sheet surface = Figma page-surface-alt (#F3EFE3 / K.bone) on light themes;
  // the elevated dark surface on evening. NOT innerBg (white) — the design's
  // sheet is the warm bone tone, not the clean white card interior.
  const cardBg = evening ? innerBg : K.bone;
  // Hero photo overlay flips with the theme: a dark scrim + white text on light
  // themes; a light scrim + dark text on evening (a dark scrim over the dark
  // card reads muddy). Tag pills and text shadows invert to match.
  const scrimColor = evening ? K.bone : K.brown;
  const scrimTopOp = evening ? 0.6 : 0.55;
  const scrimBotOp = evening ? 0.88 : 0.82;
  const heroInk = evening ? K.brown : K.white;
  const heroShadow = evening ? "rgba(250,253,254,0.45)" : "rgba(0,0,0,0.4)";
  const tagBg = evening ? "rgba(243,239,227,0.6)" : "rgba(54,20,22,0.45)";

  return (
    <View style={[styles.root, { backgroundColor: outerBg }]}>
      <StatusBar barStyle={statusBarStyle} translucent />
      <View
        style={[
          styles.card,
          { backgroundColor: cardBg, paddingTop: insets.top },
        ]}
      >
        {/* Top bar — close (takes over the old down-arrow's advance) + centered
            brand mark. No mute icon per the latest design. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={advanceToInsights}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke={textColor}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
          <View style={styles.brandLogo} pointerEvents="none">
            <Image
              source={TYPE_LOGO[metabolicType]}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
          </View>
          {/* Spacer balances the close button so the logo stays centered. */}
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          style={styles.slotScroll}
          contentContainerStyle={[
            styles.slot,
            { paddingBottom: spacing.lg + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.heading, { color: textColor }]}>
            <Text style={styles.headingLead}>{heading.lead}</Text>
            <Text style={styles.headingStrong}>{heading.strong}</Text>
          </Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={textColor} />
            </View>
          ) : meal ? (
            <>
              <View style={styles.mealBlock}>
                {/* Hero photo with overlaid name, tags, and meta. */}
                <View style={[styles.heroCard, { backgroundColor: nestedBg }]}>
                  {meal.imageUrl ? (
                    <Image
                      source={{ uri: meal.imageUrl }}
                      style={styles.heroImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.heroImage, { backgroundColor: borderColor }]} />
                  )}
                  {/* Legibility scrim — dark at top (name/tags) and bottom (meta),
                      bright through the middle. Drawn with react-native-svg so we
                      don't pull in a native gradient module. */}
                  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Defs>
                      <SvgLinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={scrimColor} stopOpacity={scrimTopOp} />
                        <Stop offset="0.32" stopColor={scrimColor} stopOpacity={0} />
                        <Stop offset="0.68" stopColor={scrimColor} stopOpacity={0} />
                        <Stop offset="1" stopColor={scrimColor} stopOpacity={scrimBotOp} />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
                  </Svg>

                  <View style={styles.heroTop}>
                    <Text
                      style={[
                        styles.heroName,
                        { color: heroInk, textShadowColor: heroShadow },
                      ]}
                      numberOfLines={2}
                    >
                      {meal.name}
                    </Text>
                    {tags.length > 0 ? (
                      <View style={styles.tagsRow}>
                        {tags.map((tag) => (
                          <View key={tag} style={[styles.tagPill, { backgroundColor: tagBg }]}>
                            <Text style={[styles.tagLabel, { color: heroInk }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.heroMeta}>
                    {prepMeta ? (
                      <Text
                        style={[
                          styles.heroMetaText,
                          { color: heroInk, textShadowColor: heroShadow },
                        ]}
                      >
                        {prepMeta}
                      </Text>
                    ) : null}
                    {ingredientsCount > 0 ? (
                      <Text
                        style={[
                          styles.heroMetaText,
                          { color: heroInk, textShadowColor: heroShadow },
                        ]}
                      >
                        {ingredientsCount} ingredients
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Why this meal — eyebrow + explanation bubble. The RES-166
                    check-in reason (whyLead) is folded in as a bold lead sentence
                    on this paragraph; it shows immediately even while the LLM
                    blurb is still typing. */}
                {!aiConsentGranted ? (
                  <View style={styles.whyWrap}>
                    <View style={styles.eyebrowRow}>
                      <View style={styles.eyebrowDot} />
                      <Text style={[styles.eyebrowText, { color: textColor }]}>
                        Why this meal?
                      </Text>
                    </View>
                    <AiConsentNudge
                      compact
                      cardBg={nestedBg}
                      textColor={textColor}
                      subtleText={subtleText}
                      borderColor={borderColor}
                    />
                  </View>
                ) : whyBody || whyPending ? (
                  <View style={styles.whyWrap}>
                    <View style={styles.eyebrowRow}>
                      <View style={styles.eyebrowDot} />
                      <Text style={[styles.eyebrowText, { color: textColor }]}>
                        Why this meal?
                      </Text>
                    </View>
                    <View style={styles.whyBubble}>
                      {whyPending ? (
                        <>
                          {whyLead ? (
                            <Text
                              style={[styles.whyText, { color: subtleText }]}
                            >
                              {renderBoldSegments(`**${whyLead}**`, textColor)}
                            </Text>
                          ) : null}
                          <WhyTypingDots color={subtleText} />
                        </>
                      ) : (
                        <Text style={[styles.whyText, { color: subtleText }]}>
                          {renderBoldSegments(whyBody, textColor)}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.prompt, { color: textColor }]}>
                What do you think?
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: chipBg }]}
                  onPress={handleLike}
                  disabled={advancing}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipLabel, { color: textColor }]}>I like it!</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: chipBg }]}
                  onPress={handleNotAFan}
                  disabled={refreshing || slot === "snack"}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipLabel, { color: textColor }]}>
                    {refreshing ? "Finding another…" : "Not a fan, show me another"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: subtleText }]}>
                No meal plan yet — pull one together on the home screen.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    flex: 1,
    overflow: "hidden",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  iconButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogo: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 8,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoImage: {
    width: 40.5,
    height: 40.5,
  },
  slotScroll: {
    flex: 1,
  },
  slot: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  heading: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  headingLead: {
    fontFamily: fonts.catalogue,
  },
  headingStrong: {
    fontFamily: fonts.catalogueBold,
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
    fontFamily: fonts.catalogue,
    fontSize: 16,
    textAlign: "center",
  },
  mealBlock: {
    gap: spacing.md,
  },
  heroCard: {
    height: 240,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroTop: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    gap: spacing.xs,
  },
  heroName: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.white,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  tagPill: {
    // Dark scrim instead of the white ghost so the white tag text stays
    // legible over lighter spots in the meal photo.
    backgroundColor: "rgba(54,20,22,0.45)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm / 2,
  },
  tagLabel: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.white,
  },
  heroMeta: {
    position: "absolute",
    left: 12,
    bottom: 12,
  },
  heroMetaText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
    color: K.white,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  whyWrap: {
    gap: spacing.xs + 2,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: K.blue,
  },
  eyebrowText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  whyBubble: {
    borderWidth: 0.5,
    borderColor: "#C3B9BA",
    borderTopLeftRadius: radius.sm / 2,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingTop: 10,
    paddingRight: spacing.md,
    paddingBottom: spacing.md,
    paddingLeft: spacing.md,
  },
  whyText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 22,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  prompt: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
  },
  actions: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.sm / 2,
  },
  chipLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
  },
});

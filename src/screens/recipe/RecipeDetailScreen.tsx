import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatPrepTime } from "../../utils/prepTime";
import { shareWithLink } from "../../constants/links";
import {
  ActivityIndicator,
  Animated,
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
import { useAppPalette } from "../../hooks/useAppPalette";
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
import { addRecipeIngredientsToGroceryList } from "../../services/grocery";
import { dietLabel } from "../../utils/dietLabel";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import { logEvent } from "../../services/braze";

// 🔴 The local `RecipeRouteParams` that used to live here is gone. It was a
// second, hand-maintained copy of this route's params, and it had already
// drifted: `MainStackParamList` gained `plannedMeal` and this screen could not
// see it, so `route.params.plannedMeal` failed to compile against a type that
// claimed to describe the same route. One definition, in the navigator.

/**
 * 🔴 RESTRUCTURED 2026-10-28 to Lang's `5046:43237`. Her geometry, read from
 * the frame (402x843, absolute positions):
 *
 *     Bg-Image     0 .............. 569.6     (67.6% of the screen)
 *       fade            340 ... 484
 *       title                433 . 509
 *       tags                     525 . 543
 *     Ingredients                      583 ...
 *
 * The title, the chips AND the whole fade live INSIDE the image. Ours had a
 * 360pt hero cut off by an opaque sheet whose top carried the title, so the
 * fade could never reach it — Cole spotted exactly that.
 * Scaled to a 780dp screen (780/843).
 */
const HERO_HEIGHT = 527;
const SCREEN_WIDTH = Dimensions.get("window").width;

/**
 * The sheet pulls up over the hero and pads its own top; both live in
 * `styles.sheet` and both are named here because the condensed header's fade
 * threshold is derived from them. Changing one in the stylesheet alone would
 * silently drift the fade.
 */
const SHEET_OVERLAP = 0;
const SHEET_PAD_TOP = 24;

/**
 * The title + chips block sits over the image, its BOTTOM this far above the
 * image's bottom edge (hers: 569.6 - 543 = 26.6, scaled).
 */
const HERO_TITLE_BOTTOM = 24;

/**
 * Lang's three surface tokens for this screen, from `5046:43885` — the dark
 * values resolved with `get_variable_defs`, the light ones read off the CSS
 * fallbacks in the same response (which ARE the light mode of each token).
 *
 * 🔴🔴 THEY DO NOT MAP ONTO `outerBg` / `innerBg` — the pair CROSSES.
 *
 *            her Page Surface      her Page Surface (alt)
 *   dark     #361416  = outerBg    #513436  = innerBg
 *   light    #fafdfe  = innerBg    #f3efe3  = outerBg
 *                      ^^^^^^^^              ^^^^^^^^
 * In her system the raised surface is LIGHTER than the page in dark mode and
 * DARKER in light mode. `useAppPalette` does not model that, so "the page" is
 * `outerBg` at night and `innerBg` by day. Reaching for one of them would
 * have been right in one mode and wrong in the other — and switching the page
 * to `outerBg` outright, which is what I did first, silently turned the
 * DAYTIME page from #fafdfe to bone.
 * ▶ Hence explicit tokens here rather than a palette lookup. Fixing
 *   `useAppPalette` itself would re-level Home, Ester, Profile and Saved
 *   Meals, which is not this change.
 */
const PAGE_SURFACE = { dark: "#361416", light: K.white };
const PAGE_SURFACE_ALT = { dark: "#513436", light: K.bone };
const DIVIDER_LINE = { dark: "#7e6869", light: "#c3b9ba" };
/** Space the block needs, so the condensed header knows when it scrolls away. */
const HERO_TITLE_RESERVE = 130;

/**
 * Where the in-page recipe title starts, in scroll-content coordinates.
 * It now sits ON the hero rather than on the sheet, so it is measured up from
 * the hero's bottom edge.
 */
const BODY_TITLE_Y = HERO_HEIGHT - HERO_TITLE_RESERVE;

/**
 * The fade, in hero coordinates. Hers starts at 340 and reaches the page
 * colour at 484 of a 569.6 image — so it begins at 59.7% of the image and
 * finishes at 85%, with the title's top (433) landing at 76%, two thirds of
 * the way through the ramp. That overlap is the whole point: the image is
 * still dissolving where the title sits.
 */
const HERO_FADE_START = Math.round(HERO_HEIGHT * 0.597);
const HERO_FADE_LEN = Math.round(HERO_HEIGHT * (0.85 - 0.597));

/** Height of the persistent action bar, so scroll content can clear it. */
const ACTION_BAR_H = 64;

/**
 * Clear space Lang leaves BELOW the action bar.
 *
 * Measured off her own export of `5046:43237` (402x843, so 1:1 in points):
 * the Cook button's fill runs y=739..782 and the frame's last row is 842, so
 * she leaves **60pt** under the buttons. We were leaving `insets.bottom`
 * alone — 15 on the S24 — which sat the bar roughly 26pt too low.
 *
 * Her frame draws a status bar but NO home indicator, so that 60 is measured
 * to the physical screen edge. 34 of it is the iPhone indicator region the
 * system already reserves and reports as `insets.bottom`; the remaining 26 is
 * real breathing room, and that is what this constant is. On the S24
 * `insets.bottom` is 15, so the gap lands at 41 rather than 60 — correct,
 * because that device has no 34pt indicator to clear.
 * 📌 For Lang, with the Android number: she may instead mean a flat 60 from
 *    the screen edge on every device. Ask before assuming.
 */
const ACTION_BAR_LIFT = 26;

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

/**
 * The condensed header's backing, `5046:44135` in "Recipe Details - Scroll".
 *
 * 🔑 THIS one IS a real scrim, unlike the bottom bar's. Lang's is
 * `#180a0a` -> transparent over a page that reads ~`#200c0e` at the top, so
 * it is DARKER than its page and genuinely dims the ingredient row sliding
 * under the title. The bottom bar's gradient was the SAME colour as her page
 * and dimmed nothing — which is exactly why porting that one literally put a
 * solid band across our white screen.
 *
 * 📌 So this is NOT ported literally either. `#180a0a` is near-black; on our
 * daytime page it would be a black bar. What her gradient DOES is "the page
 * colour, deepened, fading out", so ours starts from the page's own
 * background — which gives the same separation in both modes.
 *
 * 📌 Her rect is 95.57 tall with the end stop at 129.8%, so her fill is
 * clipped at ~23% opacity rather than reaching zero. At her contrast that
 * step is invisible; at ours it would not be, so this runs to zero inside
 * the band.
 *
 * 🔑 Numeric sizes via onLayout, not `width="100%"` — `react-native-svg`
 * does not fill on a percentage (see `CardGradient`, same file).
 */
function HeaderScrim({ color }: { color: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={StyleSheet.absoluteFill}
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
              id="headerScrim"
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={0}
              y2={size.h}
            >
              <Stop offset="0" stopColor={color} stopOpacity={1} />
              <Stop offset="0.72" stopColor={color} stopOpacity={0.82} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={size.w} height={size.h} fill="url(#headerScrim)" />
        </Svg>
      ) : null}
    </View>
  );
}

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
/**
 * Her Ester mark for the action bar.
 *
 * 📌 The SILVER variant, not the copper one. `EsterChatScreen` sets the
 * convention in its own names — `ESTER_AVATAR_LIGHT` (ester-avatar) for light
 * surfaces, `ESTER_AVATAR_DARK` (ester-avatar-silver) for dark — and this
 * button is a dark ghost surface. Her frame shows a light mark here too; the
 * copper one read as a muddy smudge at 18pt against `#fafdfe3d`.
 */
/**
 * 🔑 The Ester mark in the action bar is PER METABOLIC TYPE (Cole, 2026-10-28).
 * It was a single fixed `ester-avatar-silver.png`.
 *
 * Uses `TYPE_LOGO`, which this screen ALREADY imports and renders for the
 * type card, and which `EsterChatScreen` uses as its per-type Ester header —
 * so the mark here is the same art the member sees when they actually open
 * Ester. Adding a second registry would have been one more thing to drift.
 */

/**
 * Lang's action-bar icons (`5046:44118` / `5061:55849`).
 *
 * 📌 Drawn as paths rather than exported, matching this file's existing
 * `SwapGlyph`/`RevertGlyph` convention. They are 16pt glyphs that inherit the
 * button's text colour, so they stay correct on both the blue primary and the
 * ghost secondary without a second asset.
 */
/**
 * Lang's `shopping_cart` from `5046:43899`, her path data unchanged.
 * 24pt, as the frame draws it beside "Add ingredients to Grocery List".
 */
function CartGlyph({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.9145 21.047C5.57417 20.7067 5.404 20.2936 5.404 19.8078C5.404 19.3218 5.57417 18.9086 5.9145 18.5683C6.25483 18.2279 6.66792 18.0577 7.15375 18.0577C7.63975 18.0577 8.05292 18.2279 8.39325 18.5683C8.73358 18.9086 8.90375 19.3218 8.90375 19.8078C8.90375 20.2936 8.73358 20.7067 8.39325 21.047C8.05292 21.3875 7.63975 21.5578 7.15375 21.5578C6.66792 21.5578 6.25483 21.3875 5.9145 21.047ZM15.6068 21.047C15.2664 20.7067 15.0963 20.2936 15.0963 19.8078C15.0963 19.3218 15.2664 18.9086 15.6068 18.5683C15.9471 18.2279 16.3603 18.0577 16.8463 18.0577C17.3321 18.0577 17.7452 18.2279 18.0855 18.5683C18.4258 18.9086 18.596 19.3218 18.596 19.8078C18.596 20.2936 18.4258 20.7067 18.0855 21.047C17.7452 21.3875 17.3321 21.5578 16.8463 21.5578C16.3603 21.5578 15.9471 21.3875 15.6068 21.047ZM6.01525 5.75L8.55 11.0577H15.3673C15.4249 11.0577 15.4763 11.0433 15.5213 11.0145C15.5661 10.9857 15.6045 10.9456 15.6365 10.8943L18.3193 6.01925C18.3578 5.94875 18.3609 5.88625 18.3288 5.83175C18.2968 5.77725 18.2423 5.75 18.1653 5.75H6.01525ZM5.29625 4.25H19.1808C19.5898 4.25 19.899 4.42408 20.1085 4.77225C20.3182 5.12025 20.3282 5.47567 20.1385 5.8385L16.9345 11.6422C16.7705 11.9307 16.5536 12.1554 16.2838 12.3162C16.0137 12.4772 15.7179 12.5577 15.3963 12.5577H8.1L6.94225 14.673C6.89092 14.75 6.88933 14.8333 6.9375 14.923C6.9855 15.0128 7.05758 15.0577 7.15375 15.0577H17.8463C18.0589 15.0577 18.2371 15.1295 18.3808 15.273C18.5242 15.4167 18.596 15.5949 18.596 15.8077C18.596 16.0206 18.5242 16.1987 18.3808 16.3422C18.2371 16.4859 18.0589 16.5577 17.8463 16.5577H7.15375C6.48708 16.5577 5.98617 16.2703 5.651 15.6953C5.31567 15.1203 5.30383 14.5462 5.6155 13.973L7.04225 11.4077L3.404 3.75H2.25C2.03717 3.75 1.859 3.67817 1.7155 3.5345C1.57183 3.391 1.5 3.21283 1.5 3C1.5 2.78717 1.57183 2.609 1.7155 2.4655C1.859 2.32183 2.03717 2.25 2.25 2.25H3.77875C3.94942 2.25 4.10842 2.29517 4.25575 2.3855C4.40325 2.476 4.51542 2.60325 4.59225 2.76725L5.29625 4.25Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Lang's chef hat from `5061:54966`, her path data verbatim.
 *
 * 🔴 The previous version was one I drew by hand from two stroked arcs — it
 * read as a chef hat but was not hers. This is a single filled path on an
 * 18×19 viewBox, rendered at 24 to match the frame's icon size.
 */
function ChefHatGlyph({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 19" fill="none">
      <Path
        d="M7.59225 11.0055C7.73592 10.8618 7.80775 10.6838 7.80775 10.4713V7.55775C7.80775 7.34525 7.73583 7.16708 7.592 7.02325C7.44817 6.87958 7.26992 6.80775 7.05725 6.80775C6.84475 6.80775 6.66667 6.87958 6.523 7.02325C6.3795 7.16708 6.30775 7.34525 6.30775 7.55775V10.4713C6.30775 10.6838 6.37967 10.8618 6.5235 11.0055C6.66733 11.1493 6.8455 11.2213 7.058 11.2213C7.27067 11.2213 7.44875 11.1493 7.59225 11.0055ZM2.4135 9.9135C1.68533 9.54933 1.101 9.02558 0.6605 8.34225C0.220167 7.65892 0 6.9115 0 6.1C0 4.959 0.3955 3.99042 1.1865 3.19425C1.9775 2.39808 2.94358 2 4.08475 2C4.28308 2 4.48558 2.01667 4.69225 2.05C4.89892 2.08333 5.1015 2.125 5.3 2.175L5.3865 2.19425L5.43475 2.11725C5.82575 1.47242 6.3305 0.958333 6.949 0.575C7.56767 0.191667 8.25133 0 9 0C9.74867 0 10.4323 0.191667 11.051 0.575C11.6695 0.958333 12.1775 1.47242 12.575 2.11725L12.623 2.19425L12.7 2.175C12.8953 2.125 13.0906 2.08333 13.2858 2.05C13.4811 2.01667 13.6846 2 13.8962 2C15.0436 2 16.0143 2.398 16.8085 3.194C17.6028 3.98983 18 4.96175 18 6.10975C18 6.92125 17.7814 7.667 17.3443 8.347C16.9071 9.02717 16.3212 9.54858 15.5865 9.91125V15.1152H2.4135V9.9135ZM11.4865 11.0055C11.6302 10.8618 11.702 10.6838 11.702 10.4713V7.55775C11.702 7.34525 11.6301 7.16708 11.4863 7.02325C11.3424 6.87958 11.1642 6.80775 10.9515 6.80775C10.739 6.80775 10.5609 6.87958 10.4173 7.02325C10.2738 7.16708 10.202 7.34525 10.202 7.55775V10.4713C10.202 10.6838 10.2739 10.8618 10.4178 11.0055C10.5614 11.1493 10.7396 11.2213 10.9523 11.2213C11.1649 11.2213 11.343 11.1493 11.4865 11.0055ZM3.9135 13.6155H14.0865V8.977L15.0423 8.50375C15.4949 8.28075 15.8527 7.959 16.1155 7.5385C16.3782 7.118 16.5095 6.65242 16.5095 6.14175C16.5095 5.40208 16.2528 4.77683 15.7395 4.266C15.226 3.75533 14.6052 3.5 13.877 3.5C13.7 3.5 13.5349 3.51508 13.3818 3.54525C13.2286 3.57542 13.0718 3.6155 12.9115 3.6655L11.9288 3.94225L11.298 2.88275C11.0455 2.46092 10.7189 2.125 10.3182 1.875C9.91758 1.625 9.47975 1.5 9.00475 1.5C8.52975 1.5 8.09192 1.625 7.69125 1.875C7.29058 2.125 6.964 2.46092 6.7115 2.88275L6.08075 3.94225L5.073 3.6655C4.91283 3.62567 4.75358 3.58817 4.59525 3.553C4.43692 3.51767 4.27442 3.5 4.10775 3.5C3.37958 3.5 2.76292 3.75467 2.25775 4.264C1.75258 4.77317 1.5 5.39658 1.5 6.13425C1.5 6.64342 1.631 7.10767 1.893 7.527C2.155 7.94633 2.51308 8.27192 2.96725 8.50375L3.9135 8.977V13.6155ZM2.4135 15.1152H3.9135V17.1923C3.9135 17.2821 3.94233 17.3558 4 17.4135C4.05767 17.4712 4.13142 17.5 4.22125 17.5H13.7788C13.8686 17.5 13.9423 17.4712 14 17.4135C14.0577 17.3558 14.0865 17.2821 14.0865 17.1923V15.1152H15.5865V17.1923C15.5865 17.6894 15.4095 18.115 15.0555 18.469C14.7015 18.823 14.2759 19 13.7788 19H4.22125C3.72408 19 3.2985 18.823 2.9445 18.469C2.5905 18.115 2.4135 17.6894 2.4135 17.1923V15.1152Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Lang's `share-ios` from the top header (`5046:44136`), her path verbatim.
 *
 * 🔴 This replaced a literal "\u2197" TEXT character in a <Text>. An arrow
 * glyph from the body font is not her icon: wrong weight, wrong metrics, and
 * it sat on the text baseline rather than centred in the button.
 *
 * Authored on her 24 viewBox rather than the glyph's own 15x20 box, so the
 * art sits where she positions it inside the 24pt slot — same convention as
 * `ArrowBackIcon` and `CartGlyph`.
 */
function ShareGlyph({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.17048 20.8809C5.81173 20.8809 5.49784 20.7464 5.22878 20.4773C4.95972 20.2083 4.8252 19.8944 4.8252 19.5356V8.12317C4.8252 7.76443 4.95972 7.45053 5.22878 7.18147C5.49784 6.91242 5.81173 6.77789 6.17048 6.77789H9.28704C9.47762 6.77789 9.6374 6.84278 9.76641 6.97251C9.89524 7.1021 9.95968 7.26277 9.95968 7.45456C9.95968 7.64618 9.89524 7.80555 9.76641 7.93259C9.6374 8.05963 9.47762 8.12317 9.28704 8.12317H6.17048V19.5356H17.8296V8.12317H14.6682C14.4776 8.12317 14.3179 8.05828 14.189 7.92855C14.06 7.79896 13.9955 7.63828 13.9955 7.44649C13.9955 7.25488 14.06 7.09551 14.189 6.96847C14.3179 6.84143 14.4776 6.77789 14.6682 6.77789H17.8296C18.1883 6.77789 18.5022 6.91242 18.7713 7.18147C19.0403 7.45053 19.1748 7.76443 19.1748 8.12317V19.5356C19.1748 19.8944 19.0403 20.2083 18.7713 20.4773C18.5022 20.7464 18.1883 20.8809 17.8296 20.8809H6.17048ZM11.305 3.75101L9.80273 5.25324C9.6682 5.38777 9.51125 5.45503 9.33188 5.45503C9.15251 5.45503 8.99265 5.38777 8.85229 5.25324C8.72359 5.11871 8.65924 4.95804 8.65924 4.77118C8.65924 4.58433 8.72651 4.42365 8.86104 4.28912L11.5068 1.62098C11.6413 1.48645 11.7982 1.41919 11.9776 1.41919C12.157 1.41919 12.3139 1.48645 12.4484 1.62098L15.1166 4.28912C15.2511 4.42365 15.3184 4.58179 15.3184 4.76356C15.3184 4.9453 15.254 5.10225 15.1253 5.2344C14.985 5.36655 14.8216 5.43261 14.6352 5.43261C14.449 5.43261 14.288 5.36534 14.1525 5.23082L12.6502 3.75101V13.3249C12.6502 13.5155 12.5854 13.6752 12.4556 13.8041C12.326 13.9331 12.1654 13.9976 11.9736 13.9976C11.782 13.9976 11.6226 13.9331 11.4955 13.8041C11.3685 13.6752 11.305 13.5155 11.305 13.3249V3.75101Z"
        fill={color}
      />
    </Svg>
  );
}

function PlusGlyph({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Lang's Material `swap_horiz` from `5046:43885`, her path verbatim.
 *
 * 🔴 The previous version was four stroked line segments I drew by hand. It
 * read as a swap icon but was not hers — the same mistake as the chef hat,
 * and it is why the control "looked different" without anything obviously
 * being wrong. Hers is a single FILLED path on a 16 viewBox.
 */
function SwapGlyph({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M3.582 10.391L5.1205 11.9295C5.21283 12.0218 5.26006 12.1362 5.26217 12.2725C5.26428 12.4087 5.21706 12.5286 5.1205 12.632C5.01706 12.7354 4.89828 12.7872 4.76417 12.7872C4.62994 12.7872 4.51111 12.7354 4.40767 12.632L2.0885 10.3128C2.02606 10.2504 1.98206 10.1846 1.9565 10.1153C1.93083 10.0461 1.918 9.97133 1.918 9.891C1.918 9.81067 1.93083 9.73589 1.9565 9.66667C1.98206 9.59744 2.02606 9.53161 2.0885 9.46917L4.418 7.13967C4.51711 7.04056 4.63311 6.99167 4.766 6.993C4.89889 6.99422 5.01706 7.04656 5.1205 7.15C5.21706 7.25344 5.26706 7.37056 5.2705 7.50133C5.27394 7.63211 5.22394 7.74917 5.1205 7.8525L3.582 9.391H7.93583C8.07772 9.391 8.19656 9.43889 8.29233 9.53467C8.388 9.63033 8.43583 9.74911 8.43583 9.891C8.43583 10.0329 8.388 10.1517 8.29233 10.2475C8.19656 10.3432 8.07772 10.391 7.93583 10.391H3.582ZM12.418 6.6025H8.06417C7.92228 6.6025 7.80344 6.55467 7.70767 6.459C7.612 6.36322 7.56417 6.24439 7.56417 6.1025C7.56417 5.96072 7.612 5.84194 7.70767 5.74617C7.80344 5.6505 7.92228 5.60267 8.06417 5.60267H12.418L10.8795 4.06417C10.7872 3.97183 10.7399 3.8575 10.7378 3.72117C10.7357 3.58483 10.7829 3.46494 10.8795 3.3615C10.9829 3.25817 11.1017 3.2065 11.2358 3.2065C11.3701 3.2065 11.4889 3.25817 11.5923 3.3615L13.9115 5.68083C13.9739 5.74317 14.0179 5.80894 14.0435 5.87817C14.0692 5.94739 14.082 6.02217 14.082 6.1025C14.082 6.18294 14.0692 6.25778 14.0435 6.327C14.0179 6.39622 13.9739 6.462 13.9115 6.52433L11.582 8.85383C11.4829 8.95294 11.3669 9.00189 11.234 9.00067C11.1011 8.99933 10.9829 8.947 10.8795 8.84367C10.7829 8.74022 10.7329 8.62311 10.7295 8.49233C10.7261 8.36156 10.7761 8.24444 10.8795 8.141L12.418 6.6025Z" fill={color} />
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
  /**
   * 🔑 Recipe Details was the only Meals screen pinned to a light surface —
   * `container`/`sheet` were hard `K.white` — so at 4pm it stayed bright while
   * Home and the rest of the app went to the evening palette.
   *
   * ⚠️ "Dark mode" in this app is TIME OF DAY (`evening`, 16:00–06:00), not
   * the OS colour scheme. `useAppPalette` owns that and reschedules itself
   * across the boundary, so nothing here needs a timer.
   *
   * `dyn` holds ONLY the values that move. The static StyleSheet keeps
   * everything else, which is why this is an override object rather than a
   * rewrite of 730 lines of styles.
   */
  const palette = useAppPalette();
  const dyn = useMemo(() => {
    const dark = palette.evening;
    return StyleSheet.create({
      /**
       * 🔴 CORRECTED 2026-10-28 — the page is `outerBg`, not `innerBg`.
       *
       * `get_variable_defs` on `5046:43885` resolves her two page tokens:
       *     Page Surface        #361416   <- the PAGE
       *     Page Surface (alt)  #513436   <- raised surfaces ON it
       * which map 1:1 onto our `outerBg` / `innerBg`. This screen was
       * painting `innerBg` as the page, i.e. rendering #513436 where she has
       * #361416: one surface level too high, all the way down.
       *
       * 🔑 The tell was her swap button, whose fill is #513436 sitting ON the
       * page — a hierarchy that only works if the page is a level below it.
       * Cole spotted the colour directly; I had measured #513436 off the
       * device earlier and read it as "the page colour".
       * ▶ This is the standing rule, hit again: a colour token's NAME encodes
       *   its SURFACE. `outer` / `inner` are not decoration.
       */
      container: { backgroundColor: dark ? PAGE_SURFACE.dark : PAGE_SURFACE.light },
      sheet: { backgroundColor: dark ? PAGE_SURFACE.dark : PAGE_SURFACE.light },
      heroContainer: { backgroundColor: palette.nestedBg },
      stepCard: { backgroundColor: palette.nestedBg },
      tag: { backgroundColor: palette.nestedBg },
      divider: { backgroundColor: dark ? DIVIDER_LINE.dark : DIVIDER_LINE.light },
      /**
       * 🔴 Was `palette.borderColor` — K.brown in evening, i.e. THE PAGE, so
       * the badge disappeared and "17" floated loose beside the heading.
       * Her counter (`5046:43254`) is `Ghost Surface` #fafdfe3d, the same
       * 24% token as the action bar and the header buttons, so it reuses
       * `ghost` below rather than carrying a fill of its own.
       */
      countBadge: {
        backgroundColor: dark ? "rgba(250,253,254,0.24)" : "rgba(54,20,22,0.12)",
      },
      moreCtaButton: { backgroundColor: palette.innerBg },
      /**
       * Her `Divider Line` (#7e6869). Dropping the page to `outerBg` made
       * `palette.borderColor` — which is `K.brown`, i.e. #361416 — IDENTICAL
       * to the page in evening, so every rule on the screen would have
       * vanished into it.
       * 📌 Kept local rather than added to `useAppPalette`: Home, Ester,
       * Profile and Saved Meals all read `borderColor`, and changing it there
       * would alter four screens I am not looking at.
       */
      dividerLine: { backgroundColor: dark ? DIVIDER_LINE.dark : DIVIDER_LINE.light },
      dividerBorder: { borderColor: dark ? DIVIDER_LINE.dark : DIVIDER_LINE.light },
      /**
       * The row-level swap control, `I5046:43885;5055:46608`: a 24pt pill
       * FILLED with `Page Surface (alt)` and hairlined in `Divider Line`.
       * Ours was a 28pt transparent circle with a 1px `K.border` ring.
       */
      swapButton: {
        backgroundColor: dark ? PAGE_SURFACE_ALT.dark : PAGE_SURFACE_ALT.light,
        borderColor: dark ? DIVIDER_LINE.dark : DIVIDER_LINE.light,
      },
      swapButtonOn: {
        backgroundColor: dark ? K.bone : K.cream,
        borderColor: dark ? K.bone : K.brown,
      },
      /**
       * 🔴 The serving control had three colours hard-coded for a LIGHT page:
       * an 8% brown wash for the track, a solid `K.brown` pill for the
       * selection and cream text on it. Once the page became `Page Surface`
       * (#361416) at night, the selected pill WAS THE PAGE COLOUR and the
       * selection simply disappeared — same failure as the row rules, which I
       * fixed in the same commit and did not think to look for here.
       *
       * 📌 Lang has no segmented control to copy — her frame has the "4
       * servings" dropdown we deliberately do not build (MY PLAN r20: the
       * model is a 0.5/1/2 MULTIPLIER, and the backend throws on anything
       * else). So this mirrors the light treatment rather than inventing a
       * new one: a faint wash of the opposite tone for the track, and a
       * selected pill in the page's opposite tone with the page's own colour
       * as its text.
       */
      segmentTrack: {
        backgroundColor: dark ? "rgba(250,253,254,0.10)" : "rgba(54,20,22,0.08)",
      },
      segmentActive: { backgroundColor: dark ? K.bone : K.brown },
      segmentTextActive: { color: dark ? K.brown : K.cream },
      // 🔑 `5046:44136`, resolved with get_variable_defs (the CSS fallbacks
      //    were the LIGHT mode of a DARK frame — again):
      //      back          Ghost Surface/Fully Transparent Surface  #fafdfe00
      //      share · save  Ghost Surface/Ghost Surface              #fafdfe3d
      //    The second is the SAME token as the bottom bar's ghost buttons, so
      //    these reuse `ghost` below rather than keeping a second opaque pair.
      headerActionButton: { backgroundColor: "transparent" },
      headerCloseButton: { backgroundColor: "transparent" },
      // text on those surfaces
      text: { color: palette.textColor },
      subtle: { color: palette.subtleText },
      /**
       * The ghost buttons — Ask Ester, Add to plan, and the Add-ingredients
       * button — are Lang's `Ghost Surface` token, which resolves per mode:
       *   dark   #fafdfe3d on #fafdfe   ← her frame (`5061:54966`)
       *   light  rgba(54,20,22,0.12) on #361416
       * The light pair is not invented: it is the SAME token's light-mode
       * value, already shipping on the Add-ingredients button.
       */
      ghost: {
        backgroundColor: dark ? "rgba(250,253,254,0.24)" : "rgba(54,20,22,0.12)",
      },
      ghostText: { color: dark ? K.white : K.brown },
    });
  }, [palette]);
  const ghostGlyph = palette.evening ? K.white : K.brown;
  /** The page's own fill — what the hero and the header scrim dissolve into. */
  const pageSurface = palette.evening ? PAGE_SURFACE.dark : PAGE_SURFACE.light;

  /**
   * Condensed header (`5046:44136`, annotated *"Condensed header that shows
   * recipe title on scroll"*). Lang draws the back arrow, the truncated
   * recipe name and the two ghost buttons on one row over a scrim.
   *
   * The fade is tied to where the IN-PAGE title actually is, so the small
   * title appears as the large one leaves rather than at an invented offset:
   * `BODY_TITLE_Y` minus the header's own height. 48 is the travel of the
   * cross-fade, about the height of one title line.
   */
  const headerH = insets.top + 48;
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );
  const condensed = useMemo(() => {
    const start = Math.max(0, BODY_TITLE_Y - headerH);
    return scrollY.interpolate({
      inputRange: [start, start + 48],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
  }, [scrollY, headerH]);
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
  /** In flight for Lang's `5046:43899` — the button under the ingredients. */
  const [addingToGrocery, setAddingToGrocery] = useState(false);

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

  /**
   * Lang's `5046:43899` — "Add ingredients to Grocery List".
   *
   * 🔑 Sends the CURRENT multiplier, so what lands in the basket is what the
   * rows above the button say. The server scales by the same rule.
   *
   * 🔴 The server dedupes against the whole list, so a recipe already on this
   * week's plan adds nothing — its ingredients are derived already. Reporting
   * "Added 9 items" there would be a lie, so the toast says what actually
   * happened, including the mixed case.
   */
  const handleAddToGroceryList = async () => {
    if (addingToGrocery) return;
    setAddingToGrocery(true);
    try {
      const { added, skipped } = await addRecipeIngredientsToGroceryList({
        mealId: meal.id,
        servings: multiplier,
      });
      const n = added.length;
      const plural = (count: number) =>
        `${count} ingredient${count === 1 ? "" : "s"}`;
      if (n === 0) {
        setToast(
          skipped === 1
            ? "That ingredient is already on your Grocery List"
            : "Already on your Grocery List",
        );
      } else if (skipped > 0) {
        setToast(`${plural(n)} added · ${skipped} already there`);
      } else {
        setToast(`${plural(n)} added to your Grocery List`);
      }
      logEvent("home_recipe_detail_addToGroceryCTA", {
        mealId: meal.id,
        ...(meal.name ? { mealName: meal.name } : {}),
        added: n,
        skipped,
      });
    } catch (err: any) {
      // 🔑 The one failure worth naming. The list is derived from the week's
      // plan, so with no plan there is nothing to add to — and "Try again"
      // would send the member round a loop that cannot succeed.
      const noPlan = /no meal plan/i.test(String(err?.message ?? ""));
      setToast(
        noPlan
          ? "Your plan for this week isn't ready yet"
          : "That didn't go through. Try again.",
      );
    } finally {
      setAddingToGrocery(false);
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
    <View style={[styles.container, dyn.container, dyn.container]}>
      {/* 🔴 Animated.ScrollView, not ScrollView: a native-driven
          `Animated.event` is an AnimatedEvent OBJECT, not a function, so a
          plain ScrollView throws `onScroll is not a function (it is Object)`
          on the first scroll. */}
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          // Clears the persistent action bar.
          { paddingBottom: insets.bottom + ACTION_BAR_H + ACTION_BAR_LIFT + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={[styles.heroContainer, dyn.heroContainer, dyn.heroContainer]}>
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
          {/* 🔴 The bottom fade. Lang's hero DISSOLVES into the page
              (`5046:43237`); ours ended at a hard sheet edge.

              ⚠️ This is a gradient that must NOT match its page to be
              invisible — it must BECOME it. It ends on `palette.outerBg`,
              which is exactly the sheet's own fill, so the image resolves
              into the page with no seam in either mode. Sized numerically
              rather than with `width="100%"`, which does not fill in
              react-native-svg. */}
          <Svg
            style={styles.heroFade}
            width={SCREEN_WIDTH}
            height={HERO_HEIGHT - HERO_FADE_START}
          >
            <Defs>
              <LinearGradient
                id="heroFade"
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={0}
                x2={0}
                y2={HERO_FADE_LEN}
              >
                <Stop offset="0" stopColor={pageSurface} stopOpacity={0} />
                <Stop offset="0.55" stopColor={pageSurface} stopOpacity={0.72} />
                <Stop offset="1" stopColor={pageSurface} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            {/* The RECT runs to the hero's bottom edge while the GRADIENT is
                only defined over `HERO_FADE_LEN`. The default `pad` spread
                fills the rest with the final stop, so the bottom of the image
                is solid `innerBg` — which is what lets the title and chips sit
                on it and still read. */}
            <Rect
              width={SCREEN_WIDTH}
              height={HERO_HEIGHT - HERO_FADE_START}
              fill="url(#heroFade)"
            />
          </Svg>
          {/* 🔴 Title + chips live ON the image, as in `5046:43237` — her title
              top lands at 76% of the image, two thirds through the fade.
              📌 COLOURS stay ours (`dyn.text` / `dyn.tag`), not her white-on-
              brown: our page is WHITE by day, so a white title would vanish
              into the end of its own fade. Lang's LAYOUT, our palette. */}
          <View style={styles.heroTitleBlock}>
            <Text style={[styles.mealName, dyn.text, dyn.text]}>{meal.name}</Text>
            <View style={styles.tagRow}>
              {prepTime ? (
                <View style={[styles.tag, dyn.tag, dyn.tag]}>
                  <Text style={[styles.tagText, dyn.text, dyn.text]}>{formatPrepTime(prepTime, "minutes")}</Text>
                </View>
              ) : null}
              <View style={[styles.tag, dyn.tag, dyn.tag]}>
                <Text style={[styles.tagText, dyn.text, dyn.text]}>{capitalizeSlot(meal.time)}</Text>
              </View>
              {dietTags.map((d) => (
                <View key={d} style={[styles.tag, dyn.tag, dyn.tag]}>
                  <Text style={[styles.tagText, dyn.text, dyn.text]}>{d}</Text>
                </View>
              ))}
              {servingsBase ? (
                <View style={[styles.tag, dyn.tag, dyn.tag]}>
                  <Text style={[styles.tagText, dyn.text, dyn.text]}>
                    {servingsBase}{" "}
                    {servingsBase === 1 ? "serving" : "servings"}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
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
        <View style={[styles.sheet, dyn.sheet, dyn.sheet]}>

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
                <Text style={[styles.esterEyebrowText, dyn.text, dyn.text]}>Message from Ester</Text>
              </View>
              <AiConsentNudge />
            </View>
          ) : esterLoading || esterMessage ? (
            <View style={styles.esterBlock}>
              <View style={styles.esterEyebrowRow}>
                <View style={styles.esterEyebrowDot} />
                <Text style={[styles.esterEyebrowText, dyn.text, dyn.text]}>Message from Ester</Text>
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
          <View style={[styles.divider, dyn.divider, dyn.divider]} />

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
                    <Text style={[styles.sectionTitle, dyn.text, dyn.text]}>Ingredients</Text>
                    <View style={[styles.countBadge, dyn.countBadge, dyn.countBadge]}>
                      <Text style={[styles.countBadgeText, dyn.text, dyn.text]}>
                        {ingredients.length}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.servingsRow}>
                <View style={[styles.servingsSegmented, dyn.segmentTrack]}>
                  {SERVING_OPTIONS.map((m) => {
                    const active = m === multiplier;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.segment,
                          active && styles.segmentActive,
                          active && dyn.segmentActive,
                        ]}
                        onPress={() => chooseMultiplier(m)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${SERVING_LABEL[m]} servings`}
                      >
                        <Text
                          style={[
                            styles.segmentText, dyn.text,
                            active && dyn.segmentTextActive,
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
                        dyn.dividerBorder,
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
                      <Text style={[styles.ingredientQty, dyn.text, dyn.text]} numberOfLines={2}>
                        {qtyDisplay} {abbreviateMeasurement(ing.measurement)}
                      </Text>
                      <Text style={[styles.ingredientName, dyn.text, dyn.text]}>
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
                            dyn.swapButton,
                            sub ? dyn.swapButtonOn : null,
                          ]}
                        >
                          {sub ? <RevertGlyph /> : <SwapGlyph color={ghostGlyph} />}
                        </View>
                      ) : null}
                    </Row>
                  );
                })}
              </View>

              {/* ── Add ingredients to Grocery List ──────────────────────
                  Lang `5046:43899`: full width, 44 tall, radius 4 (XSmall),
                  her cart glyph at 24, gap 12, Catalogue Medium 14.

                  🔑 Her ghost token resolves to `#fafdfe3d` on `#fafdfe`
                  text, because she draws this on the BROWN Recipe Details
                  page. We still ship a white sheet, where white-at-24% is
                  invisible — so this uses the SAME token's light-surface
                  values (`rgba(54,20,22,0.12)` with brown text), which is
                  what her own light mode resolves to. Same button, the mode
                  that fits the surface we actually have. Revisit when the
                  page treatment is settled. */}
              <TouchableOpacity
                style={[
                  styles.addToGrocery,
                  dyn.ghost,
                  addingToGrocery ? styles.addToGroceryBusy : null,
                ]}
                onPress={handleAddToGroceryList}
                disabled={addingToGrocery}
                accessibilityRole="button"
                accessibilityState={{ disabled: addingToGrocery }}
                accessibilityLabel="Add ingredients to Grocery List"
              >
                {addingToGrocery ? (
                  <ActivityIndicator size="small" color={ghostGlyph} />
                ) : (
                  <CartGlyph color={ghostGlyph} />
                )}
                <Text style={[styles.addToGroceryText, dyn.ghostText]}>
                  Add ingredients to Grocery List
                </Text>
              </TouchableOpacity>
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
              <Text style={[styles.sectionTitle, dyn.text, dyn.text]}>Instructions</Text>
              <View style={styles.stepsList}>
                {steps.map((step, idx) => (
                  <View key={idx} style={[styles.stepCard, dyn.stepCard, dyn.stepCard]}>
                    <Text style={styles.stepLabel}>
                      {STEP_LABELS[idx] ?? `STEP ${idx + 1}`}
                    </Text>
                    <Text style={[styles.stepText, dyn.text, dyn.text]}>{step}</Text>
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
                <View style={[styles.moreCtaButton, dyn.moreCtaButton, dyn.moreCtaButton]}>
                  <Text style={[styles.moreCtaButtonLabel, dyn.text, dyn.text]}>Show me!</Text>
                  <Text style={[styles.moreCtaButtonGlyph, dyn.text, dyn.text]}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.ScrollView>

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
      <View
        style={[
          styles.actionBar,
          // 🔑 Cook is the only button that grows, so without it the other two
          //    hug their labels and strand a gap on the right. Centre them.
          !canCook && styles.actionBarCentered,
          { paddingBottom: (insets.bottom || 12) + ACTION_BAR_LIFT },
        ]}
        pointerEvents="box-none"
      >
        {/* 🔑 Lang's bar has NO slab behind it — `5061:54966` is a gradient
            scrim that fades to nothing, so the buttons read as floating over
            the content. This was a solid `K.brown` fill with a hairline top
            border, which is why it looked like a different component.
            ⚠️ SVG gradients band ~2.5× coarser on Android than iOS, so this
            is checked on the S24, not the simulator. */}
        {canCook ? (
          <Pressable
            style={[
              styles.actionButton,
              styles.actionButtonTight,
              styles.actionGrow,
              styles.actionPrimary,
            ]}
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
            <ChefHatGlyph color={K.brown} size={24} />
            <Text style={styles.actionPrimaryText} numberOfLines={1}>
              Cook
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[
            styles.actionButton,
            // Only when Cook is up — see `actionButtonTight`.
            canCook && styles.actionButtonTight,
            styles.actionSecondary,
            dyn.ghost,
          ]}
          onPress={openAskEster}
          accessibilityRole="button"
          accessibilityLabel="Ask Ester"
        >
          <Image
            source={TYPE_LOGO[metabolicType]}
            style={styles.actionEsterMark}
            resizeMode="contain"
          />
          <Text style={[styles.actionSecondaryText, dyn.ghostText]} numberOfLines={1}>
            Ask Ester
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionButton,
            canCook && styles.actionButtonTight,
            styles.actionSecondary,
            dyn.ghost,
            !canAdd && styles.actionDisabled,
          ]}
          disabled={!canAdd || adding}
          onPress={openAddSheet}
          accessibilityRole="button"
          accessibilityLabel="Add to plan"
        >
          {adding || addedTo ? null : <PlusGlyph color={ghostGlyph} size={24} />}
          <Text style={[styles.actionSecondaryText, dyn.ghostText]} numberOfLines={1}>
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
        {/* Fades in with the title, so the hero is never covered at rest. */}
        <Animated.View
          style={[
            styles.headerScrimBox,
            { height: insets.top + 72, opacity: condensed },
          ]}
          pointerEvents="none"
        >
          <HeaderScrim color={pageSurface} />
        </Animated.View>
        <View style={styles.floatingHeaderRow}>
          {/* An arrow, not a ✕: this screen is PUSHED (see MainNavigator), and
              Lang's frame draws arrow_back here. A ✕ promises a sheet that
              dismisses downward, which is no longer what happens.

              🔴 NO background. Her back button is the one control in the
              header on `Ghost Surface/Fully Transparent Surface` (#fafdfe00)
              while share and save sit on the 24% ghost — the arrow floats on
              the hero image on its own. We had it on an opaque `nestedBg`
              pill, which read as a third filled button.

              🔴 Sized 24, her slot size. It was 18, chosen to sit beside a
              "↗" text character that is now gone; at 18 her arrow renders
              ~11pt and looks undersized next to the share glyph. */}
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={[styles.headerCloseButton, dyn.headerCloseButton]}
              onPress={handleClose}
              hitSlop={8}
              accessibilityLabel="Back"
            >
              <ArrowBackIcon size={24} color={ghostGlyph} />
            </TouchableOpacity>
            {/* The truncated recipe name, between the arrow and the two ghost
                buttons — `I5046:44136;4452:7977`, Catalogue Regular 16 with
                -0.16 tracking on Text Strong, one line, tail ellipsis.
                `accessibilityElementsHidden` because the screen's own title
                is already announced; this is a visual echo of it. */}
            <Animated.Text
              style={[styles.headerTitle, dyn.text, { opacity: condensed }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {meal.name}
            </Animated.Text>
          </View>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[styles.headerActionButton, dyn.headerActionButton, dyn.ghost]}
              onPress={handleShare}
              hitSlop={8}
              accessibilityLabel="Share recipe"
            >
              <ShareGlyph color={ghostGlyph} size={24} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerActionButton, dyn.headerActionButton, dyn.ghost]}
              onPress={handleToggleFavorite}
              hitSlop={8}
              accessibilityLabel={
                isFavorited ? "Remove from favorites" : "Save to favorites"
              }
            >
              {/* 13x16 is exactly how large her bookmark sits inside the
                  24pt slot (her asset's path spans x 5.5-18.5, y 3.5-19.5),
                  so the component's own default is already her size. */}
              <BookmarkIcon filled={isFavorited} color={ghostGlyph} />
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
              <Text style={[styles.revertName, dyn.text, styles.revertNameOld]}>
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
              <Text style={[styles.revertName, dyn.text, dyn.text]}>
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
  /**
   * 🔴 Runs to the hero's BOTTOM (`bottom: 0`), not to the sheet's top edge.
   *
   * The first cut ended the fade at `bottom: SHEET_OVERLAP` — the sheet's top
   * edge — reasoning that nothing below it is visible. The ramp itself was
   * correct (measured on device: photo -> `#fafdfe` by the sheet edge) but
   * the sheet's **swept top-right corner** does not paint, so that corner
   * kept showing raw, un-faded photo: a bright notch exactly where the seam
   * was supposed to disappear.
   * 🔑 "Hidden behind a sibling" is not the same as hidden — check what the
   *    sibling's corner radius leaves uncovered.
   */
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlaceholderText: {
    fontSize: 64,
  },
  /**
   * 🔴 Flat. It used to pull up over the hero by 90, carry a 64pt swept
   * top-right corner and cast a shadow upward — none of which is in
   * `5046:43237`. The image now dissolves into this fill instead of being cut
   * by it, so there is no edge left to decorate: the overlap, the radius and
   * the shadow all went with the cut.
   */
  sheet: {
    backgroundColor: K.white,
    paddingHorizontal: 18,
    paddingTop: SHEET_PAD_TOP,
    paddingBottom: 25,
    gap: 30,
  },
  /**
   * The title + chips, over the image. Bottom-anchored so the block grows
   * UPWARD into the fade as the title wraps — a 3-line title must not push
   * the chips off the picture.
   * 📌 18, not her 24: it aligns with the sheet's existing padding so the
   * title sits flush with the ingredient rows beneath it. Her frame has both
   * at 24; ours has had 18 in the sheet all along. For Lang.
   */
  heroTitleBlock: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: HERO_TITLE_BOTTOM,
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
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * `Caption Quandrant` on her counter: Style/Serif (= Quadrant Text — the
   * token names in this file are INVERTED) at 12, not Catalogue 14.
   */
  countBadgeText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  servingsRow: { marginTop: 12, alignItems: "flex-start" },
  // 🔑 Geometry only — every colour here is mode-dependent and lives in `dyn`.
  servingsSegmented: {
    flexDirection: "row",
    borderRadius: 999,
    overflow: "hidden",
  },
  segment: { paddingHorizontal: 14, paddingVertical: 8 },
  segmentActive: { borderRadius: 999 },
  segmentText: { fontFamily: fonts.catalogue, fontSize: 13 },
  // Add ingredients to Grocery List (Lang 5046:43899)
  addToGrocery: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // 📌 Her gap is 12 and her radius is XSmall (4) — not the 999 the action
    // bar uses. Those are different components in her file, so they are
    // different here too.
    gap: 12,
    height: 44,
    borderRadius: 4,
    backgroundColor: "rgba(54, 20, 22, 0.12)",
  },
  addToGroceryBusy: { opacity: 0.6 },
  addToGroceryText: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.brown,
  },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ingredientRowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
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
  /**
   * Her `Rounded Icon button` on the ingredient row (`I5046:43885;5055:46608`):
   * a 16pt icon in `p-[4px]` with `rounded-[999px]`, so **24x24** — not the
   * 28pt ring this was. Filled `Page Surface (alt)` and hairlined `Divider
   * Line` at **0.5**, both supplied by `dyn.swapButton`.
   */
  ingredientAction: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: -2,
  },
  /**
   * The SUBSTITUTED state. Its ring was `K.brown` — the page at night, so the
   * ring vanished; the cream fill kept it legible, which is why this was less
   * obvious than the serving control. `dyn.swapButtonOn` supplies both.
   */
  ingredientActionOn: {},
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
  headerScrimBox: {
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
  /**
   * Back arrow + the condensed title. Her left group is `gap: 8`
   * (`I5046:44136;4613:9845`: the 40pt button at x=0, the text at x=48).
   *
   * 🔑 `flexShrink: 1` and `minWidth: 0` are what let the TITLE truncate
   * instead of shoving the two ghost buttons off the right edge. RN defaults
   * `flexShrink` to 0, unlike the web — the same default that has the
   * three-button bottom bar overflowing today.
   */
  headerLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    flexShrink: 1,
  },
  /**
   * 40x40 is her button: a 24pt icon in `p-[8px]` with `rounded-[999px]`.
   * The FILL is set per mode in `dyn` — transparent for back, 24% ghost for
   * share and save — so nothing static is declared here.
   */
  headerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  // Her `Buttons` row is gap 8, not 12 (`I5046:44136;4455:13089`).
  headerRightActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
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
    // 🔑 Her gap is 8 and her side padding 24 (`px-[24px]` on the container).
    gap: 8,
    // 📌 DEVIATION from Lang's `px-[24px]`, measured not guessed: at 24 the
    //    three buttons need ~976px of an S24's 954px and Cook truncates.
    //    Her frame is 402pt and may not have been checked with all three
    //    present. 16 buys the ~22px and is the smallest change that fits;
    //    worth putting to her rather than quietly keeping.
    paddingHorizontal: 16,
    paddingTop: 12,
    // 🔴🔴 NO background of ANY kind — not a slab, not a border, and not a
    // gradient scrim either. `5046:43237` shows the ingredient list running
    // straight under the buttons ("Olive oil", "Garlic powder · 1 sp" are
    // both legible around them): they genuinely float over the content.
    //
    // I had a brown→transparent scrim here, reasoning from `5061:54966`'s
    // gradient container. That gradient is the same colour as HER page, so on
    // her brown screen it is invisible — but ours is white by day, so the
    // same construction read as a solid band that hid the recipe behind it.
    // 🔑 A gradient that matches its page is not a background. Look at the
    //    rendered frame, not just the CSS.
  },
  /**
   * Lang's bottom bar (`5046:44118`, and `5061:55849` for the planned-meal
   * variant). Her tokens, read from the frame rather than the render:
   *
   *   Blue Surface/Blue Surface    #92b4bd   ← the PRIMARY, and it is COOK
   *   Blue Surface/ON Blue Strong  #361416
   *   Ghost Surface/Ghost Surface  #fafdfe3d ← filled, NOT a transparent border
   *   Ghost Surface/On Ghost Strong #fafdfe
   *   Button  Catalogue Medium 14 / lineHeight 100 / letterSpacing 0
   *
   * 🔴 Four things were off before this: the primary was `K.cream` and sat on
   * "Add to plan", the secondaries were a transparent 1px outline instead of a
   * filled ghost, the type was regular 16 rather than Medium 14, and none of
   * the three carried its icon.
   *
   * 📌 Still only the "Add to plan" variant. She also drew `5061:55849` with
   * **Change meal** for a recipe already in the plan, and that state is NOT
   * built — opening a planned meal still offers "Add to plan". Cole's call
   * 2026-10-26: match the styling for the state we have, leave the second
   * state for later.
   */
  /**
   * 🔴 CORRECTED 2026-10-28 against `5061:54966`, which is the bar Lang
   * actually drew. I had built from `5061:55849` and got the SHAPE wrong:
   *
   *   radius   999 (a pill)      ->  XSmall = **4**, same as every other
   *                                  button in her file
   *   width    all three flex:1  ->  only **Cook** grows; the other two hug
   *                                  their label (`shrink-0` in her frame)
   *   gap      6                 ->  8
   *   padding  centred           ->  pl 10 / pr 12 / py 8, min-height 44
   *   icons    16                ->  **24**
   */
  actionButton: {
    flexDirection: "row",
    minHeight: 44,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 8,
  },
  /**
   * Only Cook grows. Hers is `flex-[1_0_0]` — grow 1, **shrink 0**, basis 0.
   *
   * 🔴 Two RN traps in a row here, both only visible on a device:
   *   `flex: 1`      = grow 1 / **shrink 1** / basis 0%  -> Cook gave way and
   *                    the label wrapped to "Coo / k"
   *   `flexBasis: 0` = base width ZERO, and flexShrink only protects against
   *                    shrinking below the BASIS, not below content -> "Co…"
   * `basis: "auto"` is what actually means "at least my content, grow if
   * there is room".
   */
  actionGrow: { flexGrow: 1, flexShrink: 0, flexBasis: "auto" },
  /**
   * 🔑 Cook is hidden when a recipe has no parsed cook steps
   * (`cookStepCount === 0`), and Cook is the ONLY button that grows. Left as
   * flex-start the two remaining ghost buttons sat jammed against the left
   * edge with dead space to their right, which reads as a missing button
   * rather than a two-button bar. Cole 2026-10-28: centre them instead.
   *
   * 📊 This is the COMMON case, not the rare one: measured on the local
   * catalogue 2026-10-28, only **64 of 522** recipes have parsed cook steps.
   * (Local DB, which drifts from prod — re-measure before quoting it.)
   */
  actionBarCentered: { justifyContent: "center" },
  /**
   * 🔴 THE THREE-BUTTON ROW DOES NOT FIT A 360dp SCREEN AT HER PADDING.
   *
   * Measured on the S24 (1080x2340 at density **480**, so scale 3.0 and the
   * screen is **360dp** — not 392; read `adb shell wm density`, never infer
   * it). With Cook present the row ran 48..1080 of 1080: right padding zero,
   * "Add to plan" clipped by the screen edge.
   *
   * Two things stack up:
   *   · **RN defaults `flexShrink` to 0**, unlike the web, so nothing gives —
   *     the row overflows instead of compressing.
   *   · Lang's frame is **402pt**. Her three buttons need ~376dp with 16dp
   *     page padding: fits her artboard, **16dp over on this phone.** Same
   *     shape as the 874-vs-780 problem in the onboarding audit.
   *
   * Nothing here can truncate — unlike the condensed header's title, these
   * are three labels that all have to stay readable — so the space is bought
   * from the buttons' own horizontal padding, and ONLY when all three are up.
   * pl 10->6 / pr 12->8 frees 8dp per button, 24dp against a 16dp shortfall.
   * 📌 It is her padding being trimmed, so it is on the list for her.
   */
  actionButtonTight: { paddingLeft: 6, paddingRight: 8 },
  actionPrimary: {
    backgroundColor: K.blue,
    // Her Cook carries a drop shadow the ghost buttons do not.
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 25 },
    elevation: 6,
  },
  actionPrimaryText: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.brown,
  },
  actionSecondary: { backgroundColor: "rgba(250,253,254,0.24)" },
  actionSecondaryText: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 14,
    color: K.white,
  },
  /** 24 to match her icon size; the mark is per metabolic type. */
  actionEsterMark: { width: 24, height: 24 },
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

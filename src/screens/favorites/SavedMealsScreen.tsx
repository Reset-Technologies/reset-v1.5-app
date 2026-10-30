import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatPrepTime } from "../../utils/prepTime";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import Svg, {
  Path,
  Defs,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts, typography, spacing, radius } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import { BookmarkIcon } from "../../components/BookmarkIcon";
import { getFavorites, removeFavorite, addFavorite } from "../../services/meals";
import { logEvent } from "../../services/braze";
import type { MealFavorite } from "../../services/meals";

type MealTypeFilter = "all" | "breakfast" | "lunch" | "dinner";

/**
 * Sort options, worded exactly as Lang annotated them on the frame
 * ("Default iOS picker. Options: 1. Most Recent 2. Alphabetical (A-Z)
 * 3. Quickest").
 *
 * 🔑 "Most Recent" is the ORDER THE SERVER RETURNS, which is only meaningful
 * because `getFavorites` now has an explicit `ORDER BY favorite.createdAt DESC`
 * (api #167). Before that the query had no ordering at all, so this label would
 * have been a promise with nothing behind it.
 */
type SortKey = "recent" | "az" | "quickest";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Most Recent",
  az: "Alphabetical (A-Z)",
  quickest: "Quickest",
};
const SORT_ORDER: SortKey[] = ["recent", "az", "quickest"];

// The four filter labels are a fixed-width cost that can't shrink, so on
// narrow screens (e.g. Galaxy S24 ~360dp) the pill row overflows. Tighten the
// pill padding / gap / row inset only on small screens; larger screens
// (iPhone 16 Pro ~393pt and up) keep the original spacing untouched.
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

/** Sort menu geometry — shared by the layout maths and the stylesheet. */
const MENU_W = 216;
const MENU_ROW_H = 44;
const MENU_V_PAD = 6;
const MENU_GAP = 6;
const COMPACT = SCREEN_WIDTH < 380;
/**
 * Her chip (`5044:35868`) is 20 horizontal at 36 tall. Her row holds THREE
 * chips and fits her 402 frame; ours holds FOUR because we add "All", which
 * at her padding overflows a 360dp screen — hence the narrow-screen tighten,
 * which is ours and not in her file.
 */
const PILL_PAD_H = COMPACT ? 16 : 20;
/** Her `Meal filters` row gap, both sizes. */
const PILL_GAP = 8;
const ROW_PAD_H = COMPACT ? spacing.md : spacing.lg;

/**
 * Small inline icons.
 *
 * 🔴 These were text glyphs ("⌕", "✕", "⇅") first. They rendered acceptably on
 * the S24 I tested on, but a glyph depends on the font actually carrying it —
 * and this app has already been bitten by assuming Android and iOS render the
 * same thing. Everything else in the codebase draws icons as SVG paths
 * (BookmarkIcon, TrendIcon, this screen's own back arrow), so these do too and
 * the platform question disappears. Material 24x24 outlines, scaled.
 */
const ICON_PATHS = {
  search:
    "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  close:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  sort: "M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z",
} as const;

function Icon({
  name,
  color,
  size = 20,
}: {
  name: keyof typeof ICON_PATHS;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={ICON_PATHS[name]} fill={color} />
    </Svg>
  );
}

export function SavedMealsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { evening, outerBg, innerBg, textColor, subtleText } = useAppPalette();
  const insets = useSafeAreaInsets();
  // Meal-name color is themed via textColor (#361416 day / bone night). The
  // meta line under it (prep time) is a muted secondary: #7E6869 in light, a
  // dimmed bone at night so it reads as secondary against the bone name.
  const metaColor = evening ? "rgba(243, 239, 227, 0.6)" : "#7E6869";
  const [meals, setMeals] = useState<MealFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<MealTypeFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  /** Window-space box of the sort button, so the menu can hang off it. */
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const sortBtnRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  /** Toast state. `undo` carries the meal so it can be put back. */
  const [toast, setToast] = useState<{ text: string; undo: MealFavorite | null } | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      // Fetch all favorites once; tab filtering is done client-side (below) so
      // switching tabs is instant and we can apply our category rules.
      const favs = await getFavorites();
      setMeals(favs);
    } catch {
      // Keep current list on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFavorites();
  }, [loadFavorites]);

  // Screen view. This screen had no instrumentation at all, so saved meals were
  // a blind spot: we could see a meal favourited and never whether anyone came
  // back to look at it. Paired with `home_savedMealsCTA` on the Home card, which
  // counts the taps that get here.
  useEffect(() => {
    logEvent("saved_meals");
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  /**
   * Unsaving.
   *
   * 🔴 It used to remove the meal on a single tap of the bookmark with no
   * message and no way back. Observed on device — two results became one and
   * nothing on screen acknowledged it. A member who mis-taps a badge the size
   * of a thumbnail corner lost a saved recipe and had to go find it again.
   *
   * Lang's section annotates a confirm ("Remove meal from saved?") *and* an
   * Undo toast. Bryan ruled 2026-10-20: **TEST CASES M14 is the rule
   * throughout — "Tapping Save toggles immediately, with no confirmation."**
   * The grid keeps the Undo toast, because here the meal leaves the screen, so
   * the repair is what the member needs rather than a second tap up front.
   */
  const handleRemove = async (meal: MealFavorite) => {
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));
    try {
      await removeFavorite(meal.id);
      // 📌 The toast holds the meal, not just its id — Undo has to put back
      // something this screen can render before the refetch returns.
      setToast({ text: "Removed from Saved Meals", undo: meal });
    } catch {
      // Reload to restore if API fails
      loadFavorites();
      setToast({ text: "That didn't go through. Try again.", undo: null });
    }
  };

  const undoRemove = async (meal: MealFavorite) => {
    setToast(null);
    setMeals((prev) => (prev.some((m) => m.id === meal.id) ? prev : [meal, ...prev]));
    try {
      await addFavorite(meal.id);
      setToast({ text: "Meal saved", undo: null });
    } catch {
      loadFavorites();
    }
  };

  // 📌 Longer than a plain toast: this one carries Undo, so it has to stay up
  // long enough to be read AND acted on.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleMealPress = (meal: MealFavorite) => {
    navigation.navigate("RecipeDetail", {
      sourceSurface: "saved_meals",
      meal: {
        id: meal.id,
        name: meal.name,
        whyLine: "",
        calories: meal.calories ?? 0,
        protein: meal.protein ?? 0,
        // 🔴 Keep null as null. `?? 0` is what turned "unknown" into "0 min":
        // zero is not a cooking time, and the sort below already treats a
        // missing time as +Infinity rather than as instant.
        prepTime: meal.prepTime ?? null,
        time: meal.isBreakfast ? "breakfast" : meal.isLunch ? "lunch" : "dinner",
        imageUrl: meal.imageAsset ?? undefined,
        primaryProtein: meal.primaryProtein ?? undefined,
        cuisineCluster: meal.cuisineCluster ?? undefined,
      },
    });
  };

  // Tab filtering. Meals can be tagged for multiple meal types, so treat
  // breakfast as the primary category: a breakfast meal shows only under
  // Breakfast, and the Lunch/Dinner tabs exclude breakfast meals (otherwise a
  // breakfast item tagged lunch+dinner would leak into all three tabs).
  const typeFiltered = meals.filter((m) => {
    switch (filter) {
      case "breakfast":
        return m.isBreakfast;
      case "lunch":
        return m.isLunch && !m.isBreakfast;
      case "dinner":
        return m.isDinner && !m.isBreakfast;
      default:
        return true;
    }
  });

  /**
   * Search runs CLIENT-SIDE, deliberately.
   *
   * `GET /api/meals/favorites` does accept `?q=`, but this screen already holds
   * the member's entire saved list in memory — it is their own saves, not a
   * catalogue — so filtering locally is instant and costs no request per
   * keystroke. The server parameter stays the right answer if this ever has to
   * paginate.
   *
   * 🔴 This is NOT the Explore case. The EXPLORE tab's "Scale" rule is explicit
   * that the low-thousands catalogue must paginate and must not be loaded
   * client-side; that rule is about the library, not about a member's saves.
   */
  const q = query.trim().toLowerCase();
  const searched = q
    ? typeFiltered.filter((m) => m.name.toLowerCase().includes(q))
    : typeFiltered;

  /**
   * 📌 "Most Recent" deliberately does NOT sort: it is the server's order, which
   * is newest-save-first. Re-sorting here would just be a second, weaker guess
   * at the same thing — `MealFavorite` carries no `savedAt` to sort on.
   * Meals with no prep time sort last under "Quickest" rather than reading as
   * instant.
   */
  const visibleMeals =
    sort === "recent"
      ? searched
      : [...searched].sort((a, b) => {
          if (sort === "az") return a.name.localeCompare(b.name);
          const at = a.prepTime ?? Number.POSITIVE_INFINITY;
          const bt = b.prepTime ?? Number.POSITIVE_INFINITY;
          return at - bt;
        });

  /**
   * A dropdown anchored to the button, not a system picker.
   *
   * 📌 Lang annotated the control *"Default iOS picker"*, and that is what
   * this was: `ActionSheetIOS` on iOS, and on Android the plain grey system
   * `Alert`, which looks nothing like the rest of the app. Cole called it on
   * the device — *"I don't love the look of the pop up"* — so this is a
   * deliberate departure from her annotation, agreed with him, not an
   * oversight. **Tell Lang.**
   *
   * 🔑 It measures the BUTTON rather than assuming a position, then flips to
   * a drop-UP when there is not enough room below. The sort control sits near
   * the top of this screen today, but it moves down as the filter row wraps
   * on a narrow device, and a menu that opens off-screen is worse than the
   * Alert it replaced.
   */
  const openSortPicker = () => {
    sortBtnRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setSortOpen(true);
    });
  };

  /**
   * Where the menu hangs. Right-aligned to the button because the button is
   * itself right-aligned in the results row, clamped to the screen so a long
   * label can never push it off the edge, and flipped above the button when
   * there is not enough room below.
   */
  const menuH = SORT_ORDER.length * MENU_ROW_H + MENU_V_PAD * 2;
  const dropUp = anchor
    ? anchor.y + anchor.h + MENU_GAP + menuH > SCREEN_HEIGHT - insets.bottom - 24
    : false;
  const menuPos = anchor
    ? {
        left: Math.max(
          12,
          Math.min(anchor.x + anchor.w - MENU_W, SCREEN_WIDTH - MENU_W - 12),
        ),
        /**
         * 🔴 `+ insets.top` IS THE WHOLE TRICK, and it is measured, not
         * guessed. `measureInWindow` reports in WINDOW space (status bar
         * excluded) while a `Modal` lays out in SCREEN space, because this app
         * runs edge-to-edge. On the S24 the button measured y=163 while it
         * actually sits at 197.3 — a gap of 34.33, which is exactly
         * `insets.top`. Without this the menu lands ON the button it hangs
         * from.
         *
         * ⚠️ Removing `statusBarTranslucent` does NOT fix this — I tried, and
         * the position did not move by a pixel. Edge-to-edge means the Modal
         * spans the full screen whatever that flag says. Use the inset.
         */
        top:
          (dropUp
            ? anchor.y - MENU_GAP - menuH
            : anchor.y + anchor.h + MENU_GAP) + insets.top,
      }
    : null;

  // Split the visible meals into rows of two for the grid.
  const rows: MealFavorite[][] = [];
  for (let i = 0; i < visibleMeals.length; i += 2) {
    rows.push(visibleMeals.slice(i, i + 2));
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: outerBg }]} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
            <Path
              d="M2.496 7.9356L7.66525 13.1049C7.81392 13.2535 7.88733 13.4275 7.8855 13.6269C7.8835 13.8262 7.805 14.0034 7.65 14.1586C7.49483 14.3034 7.31917 14.3784 7.123 14.3836C6.92683 14.3888 6.75117 14.3138 6.596 14.1586L0.25575 7.81835C0.162083 7.72468 0.0960833 7.62593 0.0577499 7.5221C0.0192499 7.41827 0 7.3061 0 7.1856C0 7.0651 0.0192499 6.95293 0.0577499 6.8491C0.0960833 6.74527 0.162083 6.64652 0.25575 6.55285L6.596 0.212602C6.7345 0.0741016 6.906 0.0032683 7.1105 0.000101633C7.315 -0.00306503 7.49483 0.0677683 7.65 0.212602C7.805 0.367768 7.8825 0.545935 7.8825 0.747102C7.8825 0.948435 7.805 1.12668 7.65 1.28185L2.496 6.4356H13.873C14.0858 6.4356 14.264 6.50743 14.4075 6.6511C14.5512 6.7946 14.623 6.97277 14.623 7.1856C14.623 7.39843 14.5512 7.5766 14.4075 7.7201C14.264 7.86377 14.0858 7.9356 13.873 7.9356H2.496Z"
              fill={textColor}
            />
          </Svg>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Saved Meals</Text>
        <View style={styles.backButton} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "breakfast", "lunch", "dinner"] as MealTypeFilter[]).map((type) => (
          <FilterChip
            key={type}
            id={type}
            label={type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
            active={filter === type}
            evening={evening}
            onPress={() => setFilter(type)}
          />
        ))}
      </View>

      {/* Search. The clear button only appears with text in the field, as the
          frame shows. */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { borderColor: subtleText }]}>
          <Icon name="search" color={subtleText} size={18} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={subtleText}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search saved meals"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close" color={subtleText} size={18} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Result count + sort. Hidden while loading so the count never flashes
          a momentary "0 results" before the first response lands. */}
      {!loading ? (
        <View style={styles.resultsRow}>
          <Text style={[styles.resultsText, { color: textColor }]}>
            {visibleMeals.length} {visibleMeals.length === 1 ? "result" : "results"}
          </Text>
          <TouchableOpacity
            ref={sortBtnRef}
            style={styles.sortButton}
            onPress={openSortPicker}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${SORT_LABEL[sort]}`}
          >
            <Icon name="sort" color={textColor} size={18} />
            <Text style={[styles.sortText, { color: textColor }]}>
              {SORT_LABEL[sort]}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={K.ochre} />
        </View>
      ) : visibleMeals.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            {q || filter !== "all" ? "No matches" : "No saved meals yet"}
          </Text>
          <Text style={[styles.emptyText, { color: subtleText }]}>
            {q || filter !== "all"
              ? "Try a different search or filter."
              : "Tap the bookmark on any meal card to save it here."}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={K.ochre} />
          }
        >
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {row.map((meal) => (
                <View key={meal.id} style={styles.gridItem}>
                  <TouchableOpacity
                    style={styles.gridCard}
                    onPress={() => handleMealPress(meal)}
                    activeOpacity={0.9}
                  >
                    {meal.imageAsset ? (
                      <Image source={{ uri: meal.imageAsset }} style={styles.gridImage} />
                    ) : (
                      <View style={[styles.gridImage, styles.gridPlaceholder]}>
                        <Text style={styles.gridPlaceholderIcon}>🍽️</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.gridBookmark}
                      onPress={() => void handleRemove(meal)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <BookmarkIcon filled halo />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  <Text
                    style={[styles.gridName, { color: textColor }]}
                    numberOfLines={2}
                  >
                    {meal.name}
                  </Text>
                  {/* 🔴 This tile used to print "N cal" and "Ng protein" under
                      every saved meal. The RECIPE MODEL tab marks
                      `internal_nutrition` as NOT member-facing, the FOOD
                      STANDARD forbids surfacing calories and macros, and Lang's
                      frame shows prep time in this exact slot instead. Same
                      removal as Recipe Details, which Bryan approved on
                      2026-10-12. */}
                  {/* 🔴 Was `meal.prepTime != null`, over a value mapped with
                      `?? 0` — so a recipe with no known time printed "0 min".
                      It only surfaced once the server began nulling
                      Spoonacular's 45-minute placeholder (76% of recipes). */}
                  {formatPrepTime(meal.prepTime) ? (
                    <Text style={[styles.gridMeta, { color: metaColor }]}>
                      {formatPrepTime(meal.prepTime)}
                    </Text>
                  ) : null}
                </View>
              ))}
              {row.length === 1 ? <View style={styles.gridItem} /> : null}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Toast with Undo ───────────────────────────────────────────────
          Lang's annotations put Undo on BOTH "Meal saved" and the removal.
          With the confirm gone (M14) this toast is the only thing standing
          between a mis-tapped badge and a lost recipe, so it is not optional
          here the way it is on Recipe Details. */}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.text}
          </Text>
          {toast.undo ? (
            <Pressable
              onPress={() => void undoRemove(toast.undo!)}
              accessibilityRole="button"
              accessibilityLabel="Undo"
              hitSlop={10}
            >
              <Text style={styles.toastUndo}>Undo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {sortOpen && menuPos ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSortOpen(false)}
        >
          <Pressable
            style={styles.sortBackdrop}
            onPress={() => setSortOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close sort menu"
          >
            {/* Swallow taps on the menu itself so they do not close it. */}
            <Pressable
              style={[
                styles.sortMenu,
                menuPos,
                { backgroundColor: innerBg, borderColor: subtleText },
              ]}
              onPress={() => {}}
            >
              {SORT_ORDER.map((k, i) => {
                const active = sort === k;
                return (
                  <Pressable
                    key={k}
                    style={[
                      styles.sortMenuRow,
                      i > 0 && [styles.sortMenuRowDivided, { borderTopColor: subtleText }],
                    ]}
                    onPress={() => {
                      setSort(k);
                      setSortOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.sortMenuText,
                        active && styles.sortMenuTextActive,
                        { color: textColor },
                      ]}
                    >
                      {SORT_LABEL[k]}
                    </Text>
                    {active ? (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M20 6L9 17l-5-5"
                          stroke={K.blue}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    ) : null}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * One filter chip, with her `GLASS` effect approximated.
 *
 * 🔑 Her chip (`5044:35868`) carries a Figma **GLASS** effect —
 * `lightIntensity 0.8, lightAngle -45, refraction 0.8, depth 20` — on top of
 * the fill and the drop shadow. That is the "glossy" read: a specular
 * highlight down the TOP-LEFT edge fading out toward the bottom-right, which
 * is also why her border does not look like one flat line.
 *
 * React Native has no equivalent, so this is the same trick the Cook button
 * uses: an SVG linear gradient of white, laid over the fill and under the
 * label, running top-left → bottom-right to match her -45° light.
 *
 * 📏 KEPT DELIBERATELY FAINT (0.06). Measured down her chip's centre column,
 * her render only moves from 57 to 65 across the whole height — about 8 units
 * out of 60. A first pass at 0.18 took our top to 101 when her entire chip
 * lives in the 57-65 band, i.e. the gloss was louder than the fill it sits
 * on. Our flat 12% fill already matched her (+24 over the page against her
 * +21..+29), so this is a hint of sheen, not a highlight.
 *
 * ⚠️ Her GLASS may simply not render at full strength in a 1x PNG export, so
 * this is tuned to what the export shows. If it reads flat next to her canvas,
 * the stop opacity is the dial.
 *
 * 🔴 Each chip needs its OWN gradient id. Four chips sharing one id makes
 * react-native-svg resolve them all to the first, and only that chip gets a
 * gloss.
 * 🔴 Sized from `onLayout`, never `width="100%"` — a percentage does not fill
 * in react-native-svg, it collapses to nothing.
 */
function FilterChip({
  id,
  label,
  active,
  evening,
  onPress,
}: {
  id: string;
  label: string;
  active: boolean;
  evening: boolean;
  onPress: () => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const gradId = `chipGloss-${id}`;
  const edgeId = `chipEdge-${id}`;

  return (
    <TouchableOpacity
      onLayout={(e) =>
        setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      style={[
        styles.filterTab,
        evening ? styles.filterTabDark : styles.filterTabLight,
        active && (evening ? styles.filterTabDarkOn : styles.filterTabLightOn),
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {evening && box.w > 0 ? (
        <Svg
          width={box.w}
          height={box.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.06} />
              <Stop offset="0.7" stopColor="#ffffff" stopOpacity={0} />
            </SvgLinearGradient>
            {/* The edge shine: bright along the top and bottom runs, faint at
                the rounded ends — a VERTICAL ramp, matching her perimeter. */}
            <SvgLinearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#9b8a8b" stopOpacity={0.5} />
              <Stop offset="0.5" stopColor="#9b8a8b" stopOpacity={0.18} />
              <Stop offset="1" stopColor="#9b8a8b" stopOpacity={0.45} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={box.w}
            height={box.h}
            rx={box.h / 2}
            fill={`url(#${gradId})`}
          />
          {!active ? (
            <Rect
              x={0.25}
              y={0.25}
              width={box.w - 0.5}
              height={box.h - 0.5}
              rx={(box.h - 0.5) / 2}
              fill="none"
              stroke={`url(#${edgeId})`}
              strokeWidth={0.5}
            />
          ) : null}
        </Svg>
      ) : null}
      <Text style={[styles.filterText, { color: evening ? "#fafdfe" : K.brown }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Undo toast (Lang's `5039:39399` annotations)
  toast: {
    position: "absolute",
    left: 11,
    right: 11,
    bottom: 28,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    // 🔴 NOT K.brown. Lang draws a dark toast because her annotation sits on a
    // light canvas — but THIS screen is brown, and a brown pill on a brown
    // background is invisible. Observed on device: the text floated with no
    // surface behind it. A toast has to contrast with the screen it is on,
    // not with the swatch it was drawn against.
    backgroundColor: K.bone,
  },
  toastText: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 15,
    letterSpacing: -0.15,
    color: K.brown,
  },
  toastUndo: {
    fontFamily: fonts.catalogueMedium,
    fontSize: 15,
    color: K.brown,
    textDecorationLine: "underline",
  },
  container: {
    flex: 1,
  },
  searchRow: { paddingHorizontal: ROW_PAD_H, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 100,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  // 🔑 No explicit height: a fixed height clips descenders on Android, which is
  // the same `includeFontPadding` family of bug the onboarding work hit.
  searchInput: { flex: 1, fontFamily: fonts.catalogue, fontSize: 16, padding: 0 },
  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: ROW_PAD_H,
    paddingBottom: spacing.sm,
  },
  resultsText: { fontFamily: fonts.quadrant, fontSize: 14 },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    // Her `XSmall` is 4 (`5044:30954`), not the 8 of `radius.sm`. One
    // character, and it is the same radius every other button on this
    // design system uses.
    borderRadius: 4,
    backgroundColor: "rgba(250,253,254,0.12)",
  },
  sortText: { fontFamily: fonts.catalogueMedium, fontSize: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 20,
    color: K.brown,
  },
  headerTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: PILL_GAP,
    paddingHorizontal: ROW_PAD_H,
    paddingBottom: 20,
  },
  /**
   * Lang's `Chip`, `Selected=False / Style=OnDark / Size=Small`
   * (`5044:35868`): a FULL pill at 36 tall, 12% white fill, and a **0.5**
   * border of `rgba(155,138,139,0.5)` — we had a 24 radius, no fill, and a
   * solid 1px `#C3B9BA`, so it read as an outline box rather than a chip.
   */
  filterTab: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    /**
     * 📏 Her chip is exactly **36** tall. `minHeight` + padding landed at
     * 39–41 on the device, because the 14px line box is taller than the 16
     * her 10+10 padding implies. A fixed height with centred content hits her
     * number regardless of font metrics.
     */
    height: 36,
    paddingHorizontal: PILL_PAD_H,
    borderRadius: 100,
    /**
     * 🔴 `boxShadow`, NOT `shadow*` + `elevation`. On Android the `shadow*`
     * props are ignored outright and `elevation` draws its own hard grey
     * shadow with a different falloff — so the chip got an Android shadow
     * instead of hers, which reads as the whole edge looking wrong.
     * RN 0.83 supports `boxShadow` on both platforms, and this is her CSS
     * verbatim: `0 4px 8px 0 rgba(0,0,0,0.12)`.
     */
    boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.12)",
  },
  /**
   * 🔴 HER CHIP HAS A VARIANT PER SURFACE, and this screen's page changes with
   * the palette — brown at night, bone by day — so one set of values would be
   * right in one mode and wrong in the other. Night uses her **OnDark**,
   * day her **Ghost**.
   *
   * 🔑 OnDark's text is the one place the component default LIES: every
   * variant defaults to brown `#361416`, but the actual instances on her
   * `Meal filters` row override it to `Text Strong` `#fafdfe`. Read the
   * INSTANCE, not the component.
   */
  filterTabDark: {
    backgroundColor: "rgba(250,253,254,0.12)",
    /**
     * 🔑 0 — at night the edge is drawn as an SVG gradient STROKE in
     * `FilterChip`, because her border is not one flat line. Measured around
     * her perimeter: top **117**, bottom **112**, sides **70** against a ~56
     * interior. A React Native border is a single colour the whole way round
     * (ours measured 86 / 87 / 90 — flat), so it can never show that shine.
     */
    borderWidth: 0,
    /**
     * ⚠️ Her CSS says this at **0.5** alpha. We ship **0.25**, on purpose.
     *
     * A 0.5px border is sub-pixel: in her 1x export it can only half-cover a
     * pixel, so it renders at about half strength (measured `rgb(70,51,53)`
     * against a `57` fill — a step of 13). On a 3x phone the same 0.5dp is a
     * solid 1.5 physical pixels at full alpha, which measured
     * `rgb(107,82,84)` against a `77` fill — a step of 30, more than twice
     * hers. Halving the alpha reproduces what she actually sees.
     */
    borderColor: "transparent",
  },
  /**
   * `Selected=True / OnDark`: a 20% blue WASH with a solid 1.5 blue edge, not
   * the solid blue we shipped. The EDGE marks it, not the fill.
   *
   * ⚠️ Her component puts brown text here, which over this page composites to
   * about `rgb(72,52,55)` behind `#361416` — roughly 1.3:1, unreadable. Her
   * file carries a `GLASS` effect that React Native has no equivalent for and
   * that presumably lifts it. We keep her fill and edge and stay on white
   * text. **Flagged to Lang.**
   */
  filterTabDarkOn: {
    backgroundColor: "rgba(146,180,189,0.2)",
    borderWidth: 1.5,
    borderColor: K.blue,
  },
  /** Her `Ghost` variant — the daytime surface. No edge in her file. */
  filterTabLight: {
    backgroundColor: "rgba(54,20,22,0.12)",
    borderWidth: 0,
  },
  filterTabLightOn: {
    backgroundColor: K.blue,
    borderWidth: 0,
  },
  filterText: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: -0.14,
    textAlign: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: spacing.lg,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  gridCard: {
    alignSelf: "stretch",
    alignItems: "center",
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 40,
    borderBottomLeftRadius: 8,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridPlaceholder: {
    backgroundColor: K.bone,
    justifyContent: "center",
    alignItems: "center",
  },
  gridPlaceholderIcon: {
    fontSize: 48,
  },
  gridName: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.16,
  },
  gridMeta: {
    alignSelf: "stretch",
    marginTop: 2,
    fontFamily: fonts.catalogue,
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: -0.12,
  },
  gridBookmark: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
  },
  gridTime: {
    position: "absolute",
    left: spacing.sm,
    top: spacing.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    // Figma's light ghost surface washes out under near-white photos, so use a
    // dark translucent chip that keeps the white text legible on any image.
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  gridTimeText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
    color: "#FAFDFE",
    // Soft dark glow reinforces legibility at the chip edges.
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  /**
   * The sort dropdown. A menu anchored to its button, deliberately replacing
   * the system picker Lang annotated — see `openSortPicker`.
   *
   * 🔑 Surface is `innerBg`, not a hardcoded colour. The raised/page pair
   * CROSSES between modes on this design system (raised is LIGHTER than the
   * page at night, DARKER by day), so any fixed hex would be right in one
   * mode and wrong in the other.
   */
  sortBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sortMenu: {
    position: "absolute",
    width: MENU_W,
    paddingVertical: MENU_V_PAD,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    // Same reason as the chips: `elevation` would draw Android's own shadow.
    boxShadow: "0px 8px 16px 0px rgba(0, 0, 0, 0.25)",
  },
  sortMenuRow: {
    height: MENU_ROW_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  sortMenuRowDivided: { borderTopWidth: StyleSheet.hairlineWidth },
  sortMenuText: { fontFamily: fonts.catalogue, fontSize: 14, letterSpacing: -0.14 },
  sortMenuTextActive: { fontFamily: fonts.catalogueMedium },
});
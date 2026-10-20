import React, { useState, useEffect, useCallback } from "react";
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
  ActionSheetIOS,
  Alert,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import Svg, { Path } from "react-native-svg";
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
const COMPACT = SCREEN_WIDTH < 380;
const PILL_PAD_H = COMPACT ? 12 : spacing.md;
const PILL_GAP = COMPACT ? 8 : 12;
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
  const { evening, outerBg, textColor, subtleText } = useAppPalette();
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
  /** Lang's confirm + toast. `undo` carries the meal so it can be put back. */
  const [pendingRemove, setPendingRemove] = useState<MealFavorite | null>(null);
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
   * Unsaving, with the two things Lang's section annotates and this screen
   * had neither of.
   *
   * 🔴 It used to remove the meal on a single tap of the bookmark: no
   * confirmation, no message, no way back. Observed on device — two results
   * became one and nothing on screen acknowledged it. A member who mis-taps a
   * badge the size of a thumbnail corner loses a saved recipe and has to go
   * find it again.
   *
   * Her flow is *"Remove meal from saved?"* [Cancel] [Remove] → a toast
   * carrying **Undo**. Both are here now; the confirm is what stops the
   * accident and the Undo is what repairs it.
   */
  const handleRemove = (meal: MealFavorite) => setPendingRemove(meal);

  const confirmRemove = async () => {
    const meal = pendingRemove;
    if (!meal) return;
    setPendingRemove(null);
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));
    try {
      await removeFavorite(meal.id);
      // 📌 The toast holds the meal, not just its id — Undo has to put back
      // something this screen can render before the refetch returns.
      setToast({ text: "Meal removed from saved", undo: meal });
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

  /** Lang's frame shows a native picker; Android has no equivalent, so it
   *  falls back to the Alert the rest of this app already uses. */
  const openSortPicker = () => {
    const labels = SORT_ORDER.map((k) => SORT_LABEL[k]);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...labels, "Cancel"], cancelButtonIndex: labels.length },
        (i) => {
          if (i < labels.length) setSort(SORT_ORDER[i]);
        },
      );
      return;
    }
    Alert.alert("Sort by", undefined, [
      ...SORT_ORDER.map((k) => ({ text: SORT_LABEL[k], onPress: () => setSort(k) })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

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
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              filter === type && styles.filterTabActive,
            ]}
            onPress={() => setFilter(type)}
          >
            <Text style={[styles.filterText, { color: textColor }]}>
              {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
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
                      onPress={() => handleRemove(meal)}
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

      {/* ── Remove meal from saved? (Lang's `5039:39399` annotation) ───────
          A bookmark badge sits in the corner of a thumbnail; a mis-tap used
          to delete a saved recipe outright. */}
      <Modal
        visible={!!pendingRemove}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
      >
        <Pressable style={styles.dialogBackdrop} onPress={() => setPendingRemove(null)} />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Remove meal from saved?</Text>
            <View style={styles.dialogButtons}>
              <Pressable
                style={styles.dialogCancel}
                onPress={() => setPendingRemove(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.dialogRemove}
                onPress={confirmRemove}
                accessibilityRole="button"
                accessibilityLabel="Remove"
              >
                <Text style={styles.dialogRemoveText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Toast with Undo ───────────────────────────────────────────────
          Her annotations put Undo on BOTH "Meal saved" and "Meal removed
          from saved". Undo is the part that makes the action safe; without
          it the confirm is just friction. */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Remove-from-saved confirm + toast (Lang's `5039:39399` annotations)
  dialogBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(54,20,22,0.45)",
  },
  dialogWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  dialog: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
    backgroundColor: K.bone,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 16,
  },
  dialogTitle: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.brown,
    textAlign: "center",
  },
  dialogButtons: { flexDirection: "row", gap: 10 },
  dialogCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(54,20,22,0.25)",
    alignItems: "center",
  },
  dialogCancelText: { fontFamily: fonts.dmSansMedium, fontSize: 15, color: K.brown },
  dialogRemove: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: K.brown,
    alignItems: "center",
  },
  dialogRemoveText: { fontFamily: fonts.dmSansMedium, fontSize: 15, color: K.bone },
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
    fontFamily: fonts.dmSans,
    fontSize: 15,
    letterSpacing: -0.15,
    color: K.brown,
  },
  toastUndo: {
    fontFamily: fonts.dmSansMedium,
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
    borderRadius: radius.sm,
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
  filterTab: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: PILL_PAD_H,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "#C3B9BA",
  },
  filterTabActive: {
    backgroundColor: K.blue,
  },
  filterText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: -0.16,
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
});

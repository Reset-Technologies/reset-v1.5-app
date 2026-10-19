import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import {
  ExploreBrowseRow,
  ExploreFilters,
  ExploreResult,
  ExploreSection,
  getExploreSections,
  searchExplore,
} from "../../services/meals";
import type { MainStackParamList } from "../../navigation/MainNavigator";

/**
 * P0 #7 — Explore. Lang's frame `5039:29745`.
 *
 * ## What this screen is, and what it is not
 * RECIPE LIBRARY rule 2: *"My Plan and Explore are separate jobs… Explore never
 * replaces the plan."* Nothing here mutates a plan. Tapping a recipe opens
 * Recipe Details, which is where adding to the week already lives.
 *
 * ## 🔑 The sections are SERVER-DRIVEN, so this file names none of them
 * EXPLORE r6: *"Server-driven row definitions so merchandising can change
 * without app release."* The headings, tiles, filters, counts and photos all
 * arrive from `/explore/rows`. ▶ Searching this file for "Cuisine" or
 * "Breakfast" finds nothing on purpose — adding a row must never need a build.
 *
 * ## 🔴 Two things in her frame are deliberately NOT built
 * - **Collections** — she annotated the card herself: *"This is a placeholder -
 *   I believe Bryan should have meals/photos/copy for the collections."* When
 *   Bryan's content exists the server sends the section and this screen renders
 *   it with no change here.
 * - **The microphone in the search field** — voice search has no implementation
 *   anywhere in the app, and a mic that does nothing when tapped is worse than
 *   no mic. Omitted rather than drawn dead.
 */

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Tile sizes from her frame: 144×144 squares, 154-wide result cards. */
const TILE = 144;
const CARD = 154;

export function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const [sections, setSections] = useState<ExploreSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);

  const [query, setQuery] = useState("");
  /** The filter currently being browsed, set by tapping a tile. */
  const [activeRow, setActiveRow] = useState<ExploreBrowseRow | null>(null);

  const [results, setResults] = useState<ExploreResult[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * 🔴 Guards against an out-of-order response overwriting a newer one. Typing
   * "chicken" fires several searches; without this, a slow early response can
   * land last and show results for a query the member has moved past.
   */
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getExploreSections()
      .then((s) => {
        if (!cancelled) setSections(s);
      })
      .catch(() => {
        // An empty browse surface is still usable — search works regardless.
        if (!cancelled) setSections([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSections(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    async (filters: ExploreFilters, append: boolean) => {
      const id = ++requestId.current;
      if (append) setLoadingMore(true);
      else setSearching(true);
      setFailed(false);
      try {
        const page = await searchExplore(filters);
        if (id !== requestId.current) return; // a newer search has started
        setResults((prev) => (append ? [...prev, ...page.results] : page.results));
        setTotal(page.totalCount);
        setNextOffset(page.nextOffset);
      } catch {
        if (id !== requestId.current) return;
        setFailed(true);
        if (!append) setResults([]);
      } finally {
        if (id === requestId.current) {
          setSearching(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  /**
   * Debounced search-as-you-type.
   *
   * 📌 300ms, and the server only emits `explore_searched` for offset 0, so a
   * member typing "chicken" records a handful of searches rather than eight —
   * one per keystroke would make EVENTS r16's "Search rate" meaningless.
   */
  useEffect(() => {
    const text = query.trim();
    if (!text && !activeRow) {
      setResults([]);
      setTotal(0);
      setNextOffset(null);
      requestId.current++; // abandon any in-flight response
      return;
    }
    const handle = setTimeout(() => {
      runSearch({ ...(activeRow?.query as ExploreFilters), q: text || undefined }, false);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, activeRow, runSearch]);

  const openRow = useCallback((row: ExploreBrowseRow) => {
    Keyboard.dismiss();
    setActiveRow(row);
    setQuery("");
  }, []);

  const clearBrowse = useCallback(() => {
    setActiveRow(null);
    setQuery("");
  }, []);

  const loadMore = useCallback(() => {
    if (nextOffset === null || loadingMore || searching) return;
    runSearch(
      {
        ...(activeRow?.query as ExploreFilters),
        q: query.trim() || undefined,
        offset: nextOffset,
      },
      true,
    );
  }, [nextOffset, loadingMore, searching, activeRow, query, runSearch]);

  const openRecipe = useCallback(
    (item: ExploreResult) => {
      navigation.navigate("RecipeDetail", {
        // 🔑 The server emits `recipe_viewed` with this surface, which is how
        // EXPLORE's engagement is measurable at all (TEST CASES M32).
        sourceSurface: "explore",
        meal: {
          id: item.recipeId,
          name: item.title,
          whyLine: "",
          // Energy is internal only (Do-Not-Build). The endpoint sends no
          // macros, and these zeroes are the same placeholders Saved Meals
          // passes — Recipe Details loads the real detail itself.
          calories: 0,
          protein: 0,
          prepTime: item.readyInMinutes ?? 0,
          time:
            item.slots[0] === "breakfast"
              ? "breakfast"
              : item.slots[0] === "lunch"
                ? "lunch"
                : "dinner",
          imageUrl: item.imageAssetId ?? undefined,
          cuisineCluster: item.cuisine ?? undefined,
        },
      });
    },
    [navigation],
  );

  const browsing = activeRow !== null;
  const searchingSomething = query.trim().length > 0 || browsing;

  const headerLabel = useMemo(() => {
    if (!searchingSomething) return null;
    if (searching) return "Searching…";
    if (failed) return "Couldn't load results";
    const noun = total === 1 ? "recipe" : "recipes";
    return `${total} ${noun}`;
  }, [searchingSomething, searching, failed, total]);

  const renderResult = ({ item }: { item: ExploreResult }) => (
    <Pressable
      style={styles.resultCard}
      onPress={() => openRecipe(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.resultImageWrap}>
        {item.imageAssetId ? (
          <Image source={{ uri: item.imageAssetId }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.imageFallback]} />
        )}
        {item.saved ? (
          <View style={styles.savedPip}>
            <Svg width={12} height={12} viewBox="0 0 24 24">
              <Path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" fill={K.bone} />
            </Svg>
          </View>
        ) : null}
      </View>
      <Text style={styles.resultTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {item.readyInMinutes ? (
        <Text style={styles.resultMeta}>{item.readyInMinutes} min</Text>
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 19l-7-7 7-7"
              stroke={K.bone}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Explore Meals</Text>
      </View>

      <View style={styles.searchRow}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
          <Path
            d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
            stroke={K.textMuted}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={K.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          // Observed on device: iOS capitalised "Chicken soup". Matching is
          // case-insensitive so results were right, but a capital in the field
          // reads as the member's own typing and looks like a mistake.
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search recipes"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke={K.textMuted}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        ) : null}
      </View>

      {browsing ? (
        <View style={styles.browseBar}>
          <Text style={styles.browseLabel} numberOfLines={1}>
            {activeRow?.title}
          </Text>
          <Pressable onPress={clearBrowse} hitSlop={10} accessibilityLabel="Clear filter">
            <Text style={styles.browseClear}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {headerLabel ? <Text style={styles.resultCount}>{headerLabel}</Text> : null}

      {searchingSomething ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.recipeId}
          renderItem={renderResult}
          numColumns={2}
          columnWrapperStyle={styles.resultRow}
          contentContainerStyle={styles.resultList}
          keyboardShouldPersistTaps="handled"
          // r7: "pagination/infinite load; do not load full library
          // client-side". The server caps the page; this asks for the next one.
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={K.bone} style={styles.footerSpinner} /> : null
          }
          ListEmptyComponent={
            searching ? null : (
              <Text style={styles.empty}>
                {failed
                  ? "Something went wrong. Pull back and try again."
                  : "No recipes match that yet."}
              </Text>
            )
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.browseScroll}
          keyboardShouldPersistTaps="handled"
        >
          {loadingSections ? (
            <ActivityIndicator color={K.bone} style={styles.sectionsSpinner} />
          ) : null}
          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tileRow}
              >
                {section.rows.map((row) => (
                  <Pressable
                    key={row.key}
                    style={styles.tile}
                    onPress={() => openRow(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.title}, ${row.count} recipes`}
                  >
                    {row.imageUrl ? (
                      <Image source={{ uri: row.imageUrl }} style={styles.tileImage} />
                    ) : (
                      <View style={[styles.tileImage, styles.imageFallback]} />
                    )}
                    {/* A scrim, so a light photo cannot swallow the label. */}
                    <View style={styles.tileScrim} />
                    <Text style={styles.tileTitle} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <Text style={styles.tileCount}>{row.count} recipes</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}
          {!loadingSections && sections.length === 0 ? (
            <Text style={styles.empty}>Browse is unavailable right now. Search still works.</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Her frame's surface: the brown page colour the rest of Meals uses.
  container: { flex: 1, backgroundColor: K.brown },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 24,
    letterSpacing: -0.24,
    color: K.bone,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(243,239,227,0.12)",
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.bone,
    // Android adds its own vertical padding to TextInput; zero it so the pill
    // height matches iOS.
    paddingVertical: 0,
  },
  browseBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  browseLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.bone,
    flex: 1,
  },
  browseClear: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.textMuted,
  },
  resultCount: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.textMuted,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  browseScroll: { paddingBottom: spacing.xl, paddingTop: spacing.lg },
  sectionsSpinner: { marginTop: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.bone,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tileRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  // 144×144 with her asymmetric corner — small everywhere, large top-right.
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 4,
    borderTopRightRadius: 24,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#513436",
  },
  // 🔴 absoluteFillObject ALONE. Pairing it with width/height "100%" made the
  // photo render at a smaller size pinned top-left, leaving bare surface down
  // the right and bottom of every tile — visible on the device, invisible in
  // a typecheck. The percentages resolve against the padded content box, not
  // the tile, so they fight the inset:0 the fill already sets.
  tileImage: { ...StyleSheet.absoluteFillObject },
  tileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(54,20,22,0.45)",
  },
  /* Lang's tiles read 24px, but hers say "Breakfast" and "Lunch". A
     server-driven registry also serves "Mediterranean" and "Under 30 min",
     which clipped mid-word at that size on a 144pt tile. 17px over two lines
     holds every label the registry currently produces and still reads as the
     tile's title. */
  tileTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.17,
    color: K.bone,
  },
  tileCount: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    color: "rgba(243,239,227,0.75)",
    marginTop: 2,
  },
  resultList: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  resultRow: { gap: spacing.md, marginBottom: spacing.lg },
  resultCard: { width: CARD },
  resultImageWrap: {
    width: "100%",
    height: 121,
    borderRadius: 4,
    borderTopLeftRadius: 9,
    borderBottomRightRadius: 15,
    overflow: "hidden",
  },
  resultImage: { width: "100%", height: "100%" },
  imageFallback: { backgroundColor: "#513436" },
  savedPip: {
    position: "absolute",
    right: 8,
    bottom: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(81,52,54,0.6)",
  },
  resultTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.bone,
    marginTop: spacing.sm,
  },
  resultMeta: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    letterSpacing: -0.14,
    color: K.textMuted,
    marginTop: 2,
  },
  footerSpinner: { marginVertical: spacing.lg },
  empty: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});

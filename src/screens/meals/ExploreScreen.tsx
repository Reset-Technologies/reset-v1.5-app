import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  Modal,
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
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts, spacing } from "../../constants/typography";
import {
  ExploreBrowseRow,
  ExploreFilters,
  ExploreResult,
  ExploreSection,
  ExploreSort,
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
/**
 * Collections are LANDSCAPE on her frame — `Recipe Card Style 3` is 277×192
 * (`5039:29760`), not a square.
 *
 * 🔑 The server has been saying so all along: `explore-query.ts` tags the
 * collections row `style: 'wide'` and every other row `'square'`, and
 * `ExploreSection.style` is already on the client type. We just never read it,
 * so every row rendered as a 144 square.
 */
const WIDE_W = 277;
const WIDE_H = 192;

/**
 * Room around the card for its drop shadow to be drawn into.
 *
 * 🔴 The shadow is DRAWN, not cast. `box-shadow` renders nothing on Android
 * on this screen (proved with an opaque red shadow and a 30px blur: zero
 * pixels), and `elevation` did not bring it back either — not with a
 * background colour, not with the clip moved off the card, not with room
 * padded into the scroll container. So her
 * `0 25px 50px -12px rgba(0,0,0,0.25)` is painted as a blurred rounded rect
 * behind the card: offset 25 down, shrunk 12 a side for the negative spread,
 * `stdDeviation` 25 because an SVG blur is half the CSS blur radius.
 */

/**
 * Lang's two sort options (Slack 2026-10-24): *"Let's do alphabetical (A-2)
 * and quickest"*. "A-2" is a typo for A-Z.
 *
 * ⚠️ `quickest` is honest but thin: Spoonacular's 45-minute placeholder means
 * 407 of 522 published recipes have NO known time, and Bryan ruled those must
 * not be presented as an estimate. The server sorts them last, together, so
 * outside the time-boxed collections this orders about a fifth of a row and
 * parks the rest. Raised with Lang; her call, not a client-side fix.
 */
const SORT_LABELS: Record<ExploreSort, string> = {
  alphabetical: "A\u2013Z",
  quickest: "Quickest",
};

/**
 * 🔴 Exactly Lang's two. An earlier pass offered a third, "Recommended",
 * for the server's default order — and it was a NO-OP that shipped as a
 * visible control. Inside a collection there is no search text, so the
 * builder's `relevance` is the literal 0 for every row and the default
 * order is `0 asc, v.title asc, m.id asc` — the same ordering "A-Z"
 * produces. Two menu entries, one result, nothing happening on tap.
 *
 * There is no honest third option to offer: EXPLORE r8 permits a Type prior
 * in ranking and `explore-query.ts` deliberately does not apply one, so the
 * catalogue has no "recommended" order to sort by.
 */
const SORT_OPTIONS: Array<{ value: ExploreSort; label: string }> = [
  { value: "alphabetical", label: SORT_LABELS.alphabetical },
  { value: "quickest", label: SORT_LABELS.quickest },
];

/** A-Z is what a collection already does, so it is the honest resting state. */
const DEFAULT_SORT: ExploreSort = "alphabetical";

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
  /**
   * The view whose results are on screen, or `null` while none have landed.
   *
   * 🔴 The empty state used to be `!searching && results.length === 0`, which
   * is true for a window after every view change and NOT only when a search
   * came back empty — Cole saw "No recipes in Dinner in 20 match that yet."
   * flash on the way INTO the collection. "Nothing matched" is a claim about a
   * finished request, so it has to be keyed to one.
   */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  /**
   * Lang's Sort control (`5039:29558`), options from her Slack reply
   * 2026-10-24. `null` is the server's relevance order, which is what every
   * row did before this and stays the default.
   */
  const [sort, setSort] = useState<ExploreSort>(DEFAULT_SORT);
  const [sortOpen, setSortOpen] = useState(false);
  const lastSort = useRef<ExploreSort>(DEFAULT_SORT);
  const [failed, setFailed] = useState(false);

  /**
   * 🔴 Guards against an out-of-order response overwriting a newer one. Typing
   * "chicken" fires several searches; without this, a slow early response can
   * land last and show results for a query the member has moved past.
   */
  const requestId = useRef(0);
  const lastRowKey = useRef<string | null>(null);

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
    async (filters: ExploreFilters, append: boolean, key: string) => {
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
          // Settled either way: a failure has its own message to show.
          if (!append) setSettledKey(key);
        }
      }
    },
    [],
  );

  /** What is being asked for: the collection, if any, plus the typed text. */
  const searchKey = useMemo(
    () => `${activeRow?.key ?? ""}|${query.trim()}|${sort ?? ""}`,
    [activeRow, query, sort],
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
    const rowKey = activeRow?.key ?? null;
    const rowChanged = rowKey !== lastRowKey.current;
    lastRowKey.current = rowKey;
    // Picking a sort is one discrete tap, not typing — it must not sit out the
    // typing debounce. Same reasoning as `rowChanged`.
    const sortChanged = sort !== lastSort.current;
    lastSort.current = sort;

    if (!text && !activeRow) {
      setResults([]);
      setTotal(0);
      setNextOffset(null);
      setSettledKey(null); // these results are gone; don't let them vouch for the next view
      requestId.current++; // abandon any in-flight response
      return;
    }

    const filters = {
      ...(activeRow?.query as ExploreFilters),
      q: text || undefined,
      // Sent explicitly rather than leaning on the default being alphabetical:
      // the label claims A-Z, so the request must ask for A-Z.
      sort,
    };

    // 📌 The 300ms belongs to TYPING. Opening or leaving a collection is one
    // discrete tap, and making it wait is just 300ms of nothing happening.
    if (rowChanged || sortChanged) {
      runSearch(filters, false, searchKey);
      return;
    }

    const handle = setTimeout(() => {
      runSearch(filters, false, searchKey);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, activeRow, sort, runSearch, searchKey]);

  const openRow = useCallback((row: ExploreBrowseRow) => {
    Keyboard.dismiss();
    setActiveRow(row);
    setQuery("");
    // A sort belongs to the collection you chose it in; carrying "quickest"
    // into a row where almost nothing has a time would look broken.
    setSort(DEFAULT_SORT);
  }, []);

  /**
   * Leave the collection and go back to browsing.
   *
   * ⚠️ This was "Clear filter", a control beside the collection name. Lang's
   * `5039:29545` has no such button and no search field on a collection, so
   * both are gone and only the back arrow calls this now.
   * 📌 That also retires the trap the control existed to soften: typing while
   * a collection was active searched INSIDE it, so "Assam" in "Dinner in 20"
   * found nothing though the recipe exists. There is nothing to type into any
   * more. Kept `setQuery` untouched so a search made BEFORE opening a
   * collection is still there on the way back.
   */
  const clearBrowse = useCallback(() => {
    setActiveRow(null);
  }, []);

  /**
   * Back out of a collection before backing out of the screen.
   *
   * 🔴 Opening a collection does not PUSH anything — it sets `activeRow` on
   * this same screen — so the header arrow went straight back to My Plan and
   * skipped the browse list the member had just come from. Cole hit it on
   * the S24.
   * 📌 Android's hardware back is wired to the same thing, or the two
   * disagree: [[feedback_back_affordances]] — the hardware key hides a
   * missing control, and here it would hide a wrong one.
   */
  const goBack = useCallback(() => {
    if (activeRow) {
      clearBrowse();
      return;
    }
    navigation.goBack();
  }, [activeRow, clearBrowse, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeRow) {
        clearBrowse();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeRow, clearBrowse]);

  const loadMore = useCallback(() => {
    if (nextOffset === null || loadingMore || searching) return;
    runSearch(
      {
        ...(activeRow?.query as ExploreFilters),
        q: query.trim() || undefined,
        // 🔴 Without this, page 2 arrives in RELEVANCE order and is appended
        // under an A-Z heading — the list silently stops being sorted.
        sort,
        offset: nextOffset,
      },
      true,
      searchKey,
    );
  }, [nextOffset, loadingMore, searching, activeRow, query, sort, runSearch, searchKey]);

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
          // null, not 0 — the server already nulls the 45-min placeholder.
          prepTime: item.readyInMinutes ?? null,
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
  /** True from the moment a view is asked for until ITS results land. */
  const awaitingResults = searchingSomething && settledKey !== searchKey;

  const headerLabel = useMemo(() => {
    if (!searchingSomething) return null;
    if (awaitingResults) return "Searching…";
    if (failed) return "Couldn't load results";
    const noun = total === 1 ? "recipe" : "recipes";
    return `${total} ${noun}`;
  }, [searchingSomething, awaitingResults, failed, total]);

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
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={activeRow ? "Back to collections" : "Back"}
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
        {browsing ? null : <Text style={styles.headerTitle}>Explore Meals</Text>}
      </View>

      {browsing ? null : (
      <View style={styles.searchRow}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
          <Path
            d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
            stroke="#fafdfe"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="rgba(250,253,254,0.65)"
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
      )}

      {/* ── A collection is its own screen ────────────────────────────────
          Her `5039:29545`: breadcrumb, a 32pt title, the count, a rule, then
          the grid. No search field and no "Clear" — the back arrow is the
          only way out, which is also why it had to start working.
          🔑 Dropping the field drops the trap the "Clear" was there to soften:
          typing inside a collection searched WITHIN it, so "Assam" in
          "Dinner in 20" found nothing though the recipe exists. */}
      {browsing ? (
        <>
          <View style={styles.collectionHead}>
            <View style={styles.collectionTitleGroup}>
              <View style={styles.eyebrow}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrowText}>Collections</Text>
              </View>
              <Text style={styles.collectionTitle}>{activeRow?.title}</Text>
            </View>
            {/* 🔴 NOT WRITTEN YET. Her frame shows a sentence under every
                collection title and no collection has one: the row registry
                (`explore-query.ts`) carries key/title/query/count/image and
                nothing else. Bryan's EXPLORE tab says row definitions are
                server-driven "so merchandising can change without app
                release", so the copy belongs in that registry, and it is
                HIS to write — Figma is not canonical for copy. Rendered the
                moment a row carries one. */}
            {activeRow?.description ? (
              <Text style={styles.collectionDesc}>{activeRow.description}</Text>
            ) : null}
          </View>

          <View style={styles.countRow}>
            <Text style={styles.countText}>{headerLabel}</Text>
            <Pressable
              onPress={() => setSortOpen(true)}
              style={styles.sortButton}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${SORT_LABELS[sort]}. Change sort`}
            >
              {/* Her `swap_vert` glyph, 20pt, from `5039:29558`. */}
              <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                <Path
                  d="M7.19062 10.3573C7.07104 10.2377 7.01125 10.0892 7.01125 9.91188V4.46958L5.08021 6.40062C4.96479 6.51604 4.82319 6.57375 4.65542 6.57375C4.48778 6.57375 4.33931 6.5134 4.21 6.39271C4.08069 6.2634 4.01604 6.11486 4.01604 5.94708C4.01604 5.77944 4.08069 5.63097 4.21 5.50167L7.10104 2.61062C7.17896 2.53257 7.26118 2.47757 7.34771 2.44563C7.43424 2.41354 7.52771 2.3975 7.62812 2.3975C7.72868 2.3975 7.82354 2.41354 7.91271 2.44563C8.00188 2.47757 8.08549 2.53257 8.16354 2.61062L11.0754 5.5225C11.1993 5.64639 11.2604 5.79007 11.2587 5.95354C11.2572 6.11701 11.1918 6.2634 11.0625 6.39271C10.9332 6.5134 10.7868 6.5759 10.6233 6.58021C10.4599 6.58437 10.3135 6.52187 10.1844 6.39271L8.26125 4.46958V9.91979C8.26125 10.0972 8.20139 10.2444 8.08167 10.3615C7.96208 10.4784 7.81361 10.5369 7.63625 10.5369C7.45889 10.5369 7.31035 10.477 7.19062 10.3573ZM12.0873 17.5465C11.9981 17.5144 11.9145 17.4594 11.8365 17.3815L8.92458 14.4696C8.80069 14.3456 8.73958 14.2019 8.74125 14.0385C8.74278 13.8751 8.80819 13.7287 8.9375 13.5994C9.06681 13.4787 9.21319 13.4162 9.37667 13.4119C9.54014 13.4076 9.68646 13.4701 9.81563 13.5994L11.7387 15.5225V10.0721C11.7387 9.89472 11.7986 9.74757 11.9183 9.63063C12.0379 9.51368 12.1864 9.45521 12.3637 9.45521C12.5411 9.45521 12.6897 9.515 12.8094 9.63458C12.929 9.75431 12.9887 9.90285 12.9887 10.0802V15.5225L14.9198 13.5913C15.0352 13.476 15.1768 13.4183 15.3446 13.4183C15.5122 13.4183 15.6607 13.4787 15.79 13.5994C15.9193 13.7287 15.984 13.8772 15.984 14.0448C15.984 14.2126 15.9193 14.3611 15.79 14.4904L12.899 17.3815C12.821 17.4594 12.7388 17.5144 12.6523 17.5465C12.5658 17.5785 12.4723 17.5946 12.3719 17.5946C12.2713 17.5946 12.1765 17.5785 12.0873 17.5465Z"
                  fill="#fafdfe"
                />
              </Svg>
              {/* ⚠️ Her label is always "Sort by". The button shows the
                  ACTIVE order instead — a deliberate deviation, flagged to
                  her. With only two options one is ALWAYS applied, so a
                  resting "Sort by" would never be true, and the button is
                  the only place the applied order is visible. */}
              <Text style={styles.sortButtonText}>{SORT_LABELS[sort]}</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
        </>
      ) : headerLabel ? (
        <Text style={styles.resultCount}>{headerLabel}</Text>
      ) : null}

      {searchingSomething ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.recipeId}
          renderItem={renderResult}
          numColumns={2}
          columnWrapperStyle={styles.resultRow}
          contentContainerStyle={[styles.resultList, browsing ? styles.resultListBrowse : null]}
          keyboardShouldPersistTaps="handled"
          // r7: "pagination/infinite load; do not load full library
          // client-side". The server caps the page; this asks for the next one.
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={K.bone} style={styles.footerSpinner} /> : null
          }
          ListEmptyComponent={
            awaitingResults ? null : (
              <Text style={styles.empty}>
                {failed
                  ? "Something went wrong. Pull back and try again."
                  : activeRow
                    ? /* 🔴 Name the filter. A bare "no recipes match" is a lie by
                         omission when a collection is narrowing the search: the
                         recipe often DOES exist, one tap away. ⚠️ Wording is a
                         mechanical extension of Bryan's own string, flagged to
                         him rather than invented in a new voice. */
                      `No recipes in ${activeRow.title} match that yet.`
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
                {section.rows.map((row) => {
                  const tw = section.style === "wide" ? WIDE_W : TILE;
                  const th = section.style === "wide" ? WIDE_H : TILE;
                  return (
                  <Pressable
                    key={row.key}
                    style={[styles.tile, { width: tw, height: th }]}
                    onPress={() => openRow(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.title}, ${row.count} recipes`}
                  >
                    {/*
                      🔴 A plain View with a native gradient, NOT an <Svg>.
                      Two SVG surfaces per tile across five rows put this
                      screen at 100% janky frames, 250ms at the 50th
                      percentile, with `Number Slow bitmap uploads` equal to
                      the frame count — SVG rasterises to a texture and every
                      one was being re-uploaded. `experimental_backgroundImage`
                      is drawn natively and costs nothing like that.
                    */}
                    <View
                      pointerEvents="none"
                      style={[styles.tileShadow, { top: th - 6 }]}
                    />
                    <View style={[styles.tileClip, { width: tw, height: th }]}>
                    {row.imageUrl ? (
                      <Image source={{ uri: row.imageUrl }} style={styles.tileImage} />
                    ) : (
                      <View style={[styles.tileImage, styles.imageFallback]} />
                    )}
                    {/*
                      Her treatment (`5039:29760`), which is NOT a flat scrim:
                      a wash coming UP from the bottom that reaches SOLID
                      brown by 92%, and a blue accent entering the swept
                      corner.

                      🔴 There is a THIRD gradient in her file —
                      `linear-gradient(180deg, rgba(54,20,22,0.48) 0%,
                      transparent 66.87%)` — and it must NOT be drawn here. It
                      is part of the card's `background` shorthand, where the
                      image is listed FIRST and therefore paints ON TOP of it:
                      behind an opaque cover photo it is invisible. I rendered
                      it as an overlay and darkened the top of every image,
                      which is what Cole kept seeing as "different".
                    */}
                    <View pointerEvents="none" style={styles.tileWashBase} />
                    <View pointerEvents="none" style={styles.tileWashAccent} />
                    </View>
                    <Text style={styles.tileTitle} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <Text style={styles.tileCount}>{row.count} recipes</Text>
                  </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ))}
          {!loadingSections && sections.length === 0 ? (
            <Text style={styles.empty}>Browse is unavailable right now. Search still works.</Text>
          ) : null}
        </ScrollView>
      )}

      {/* No frame exists for this menu — Lang gave the OPTIONS in Slack, not a
          design. Built from the app's existing sheet pattern (see
          `resetWindow/WindowTimeSheet`) so it is at least consistent. */}
      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable style={styles.sortBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={styles.sortSheet} onPress={() => {}}>
            <Text style={styles.sortSheetTitle}>Sort by</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={styles.sortOption}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSort(opt.value);
                    setSortOpen(false);
                  }}
                >
                  <Text
                    style={[styles.sortOptionText, active && styles.sortOptionTextActive]}
                  >
                    {opt.label}
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
  /**
   * Her `Sidebar Search Field` (`5039:29750`). Cole: *"the search bar looks
   * a little different."*
   *
   * 🔴 The fill was `rgba(243,239,227,0.12)` — bone at 12%, which reads flat
   * and dark. Measured off her render it is the near-white ghost at **24%**,
   * the same token as the Cook Mode toast's Done button. The generated code
   * offers `rgba(54,20,22,0.12)` as the `--ghost-surface` fallback, which is
   * the brown one and wrong here for the usual reason: a `var()` fallback is
   * not the value.
   * 📌 She also gives it a hairline and a soft drop shadow; without them the
   * pill has no edge against the page.
   */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(250,253,254,0.24)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#7e6869",
    boxShadow: "0px 4px 8px 0px rgba(0,0,0,0.12)",
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontFamily: fonts.dmSans,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#fafdfe",
    // Android adds its own vertical padding to TextInput; zero it so the pill
    // height matches iOS.
    paddingVertical: 0,
  },
  /**
   * Her collection header, `5039:29549` — 24 below the back row, 16 between
   * the title group and the description, 4 inside the group.
   *
   * 📌 Typefaces are hers and resolve through `get_variable_defs`, not through
   * the `var()` fallbacks: Style/Sans serif = Catalogue, Style/Serif =
   * Quadrant, Title 1 = 32, Caption = 12, Body 2 = 14. Both faces are already
   * loaded and are what `MyPlanScreen` and `SavedMealsScreen` use — the rest
   * of THIS screen is still DM Sans, which is the open sweep.
   */
  collectionHead: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  collectionTitleGroup: { gap: spacing.xs },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  // Her `Dot` is a 6.781 circle filled Blue Surface — the same #92B4BD as
  // `K.blue`, so it is drawn rather than carried as an asset.
  eyebrowDot: {
    width: 6.78,
    height: 6.78,
    borderRadius: 3.39,
    backgroundColor: K.blue,
  },
  eyebrowText: {
    fontFamily: fonts.quadrant,
    fontSize: 12,
    letterSpacing: -0.12,
    color: "#fafdfe",
  },
  collectionTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    letterSpacing: -0.32,
    color: "#fafdfe",
  },
  collectionDesc: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: "#b0a3a4",
  },
  /**
   * 🔴 Her row also holds a **Sort by** button (`5039:29558`) and it is NOT
   * here. The search is ordered by relevance with a fixed tiebreak
   * (`explore-query.ts`) and takes no sort parameter, pagination is
   * server-side so a page cannot honestly be re-sorted on the client, and
   * neither her frames here nor Bryan's EXPLORE tab say what the options are.
   * A button that does nothing is worse than its absence. Needs both.
   */
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  countText: {
    fontFamily: fonts.quadrant,
    fontSize: 14,
    letterSpacing: -0.14,
    color: "#fafdfe",
  },
  // Her `Button` (`5039:29558`), 88x32. 🔴 The var() fallbacks in the Figma
  // payload were WRONG on both colours — `get_variable_defs` gives
  // ghost-surface #fafdfe3d and on-ghost-strong #fafdfe, where the fallbacks
  // claimed rgba(54,20,22,0.12) and #361416.
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#fafdfe3d",
  },
  sortButtonText: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    color: "#fafdfe",
  },
  sortBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sortSheet: {
    // The screen's own surface; the 50% backdrop behind is what separates it.
    backgroundColor: K.brown,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  sortSheetTitle: {
    fontFamily: fonts.catalogue,
    fontSize: 18,
    color: "#fafdfe",
    marginBottom: spacing.xs,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  sortOptionText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: "#fafdfe",
  },
  sortOptionTextActive: {
    color: K.blue,
  },
  // `Divider Line` #7e6869, and it runs the full 402 — edge to edge, outside
  // the page's own 24 of padding.
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#7e6869",
    marginTop: spacing.lg,
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
  section: { marginBottom: 0 },
  sectionTitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    letterSpacing: -0.2,
    color: K.bone,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  /**
   * 🔴 The bottom padding is what lets the card's shadow EXIST. A horizontal
   * `ScrollView` clips to its content box on Android, and her shadow sits 25
   * below the card with a 50 blur — entirely outside a content box that is
   * exactly one tile tall, so it was being clipped away to nothing. The
   * section's own bottom margin is reduced by the same amount so the rhythm
   * between sections does not change.
   */
  tileRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingTop: 4,
    paddingBottom: 44,
  },
  // 144×144 with her asymmetric corner — small everywhere, large top-right.
  /**
   * Her `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)`.
   *
   * ⚠️ CORRECTED 2026-10-23. I had written here that `boxShadow` renders
   * NOTHING on Android and had marked it proved. It was not: re-running the
   * same opaque-red detector (30px blur) on this very style lit up 246k
   * pixels. The first test screenshotted before Fast Refresh had applied, so
   * I measured the OLD bundle and read the absence as a platform limit.
   * 🔑 An unchanged screenshot is a claim about the bundle on the device.
   *
   * What is true is quieter: her value is pure black at 25%, and over
   * `#361416` it measures ~3.7/255 at its strongest row — real, and very
   * nearly invisible. That, not a broken prop, is why the falloff below is
   * painted: the painted gradient AMPLIFIES her value rather than
   * reproducing it. It reads stronger in Figma because the canvas behind her
   * card is lighter.
   * 📌 `backgroundColor` is still required for the `elevation` shadow, which
   * has nothing else to cast from here — the view is otherwise just an image.
   */
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 4,
    borderTopRightRadius: 24,
    justifyContent: "flex-end",
    padding: 12,
    backgroundColor: "#361416",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 14,
  },
  /**
   * Her `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)`, painted — and
   * deliberately stronger than she specified. See the note on `tile`: the
   * faithful value does render on Android, it is simply almost invisible
   * over this page's maroon. `<FeGaussianBlur>` is still out (it type-checks
   * then silently drops the element).
   *
   * ▶ So this is a JUDGEMENT, not a workaround, and it is the version Cole
   * signed off on. Swapping it for her literal value would flatten the cards.
   * Inset 12 a side for her negative spread, fading out over the distance her
   * 25 offset and 50 blur covered.
   */
  tileShadow: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 46,
    borderRadius: 4,
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 100%)",
  },
  /**
   * The wash under her label. Stops measured off her exported card rather
   * than read off the CSS angle — see the note where they were derived. It
   * must NOT reach full opacity or the photo stops coming through.
   */
  tileWashBase: {
    ...StyleSheet.absoluteFillObject,
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(54,20,22,0) 9.1%, rgba(54,20,22,0.7) 93%, rgba(54,20,22,0.85) 100%)",
  },
  /** Her blue accent entering the swept corner. */
  tileWashAccent: {
    ...StyleSheet.absoluteFillObject,
    experimental_backgroundImage:
      "linear-gradient(43.75deg, rgba(146,180,189,0) 76%, rgba(146,180,189,0.53) 100%)",
  },
  /** The photo + washes, clipped to her 4 / 24 / 4 / 4 corners. */
  tileClip: {
    ...StyleSheet.absoluteFillObject,
    width: TILE,
    height: TILE,
    borderRadius: 4,
    borderTopRightRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    // `0.5px solid var(--page-surface-alt, #513436)` — her own CSS confirms
    // the token; an earlier export offered `#f3efe3`, which measuring her
    // render had already contradicted.
    borderColor: "#513436",
  },
  // 🔴 absoluteFillObject ALONE. Pairing it with width/height "100%" made the
  // photo render at a smaller size pinned top-left, leaving bare surface down
  // the right and bottom of every tile — visible on the device, invisible in
  // a typecheck. The percentages resolve against the padded content box, not
  // the tile, so they fight the inset:0 the fill already sets.
  tileImage: { ...StyleSheet.absoluteFillObject },
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
    color: "#fafdfe",
  },
  tileCount: {
    fontFamily: fonts.dmSans,
    fontSize: 12,
    letterSpacing: -0.12,
    /**
     * 🔑 Opaque. At 0.75 the glyphs blend toward the photo behind them, which
     * costs about 1.2:1 of contrast and was the larger half of the failure —
     * fixing only the scrim would have needed 0.75 opacity on it to
     * compensate, and that buries the photograph.
     */
    color: "#fafdfe",
    // Her card puts `gap-[8px]` between the title and the count.
    marginTop: 8,
  },
  resultList: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  resultListBrowse: { paddingTop: spacing.lg },
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

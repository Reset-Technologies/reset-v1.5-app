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
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
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
const SHADOW_PAD = 60;
const SHADOW_DY = 25;
const SHADOW_SPREAD = 12;

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

  /**
   * Drop the browse filter and KEEP what the member typed.
   *
   * 🔴 Found on a device pass, 2026-10-19. This also did `setQuery("")`, so
   * the control labelled "Clear filter" silently threw away the search as well.
   * The trap it created: typing a query while a collection is active searches
   * INSIDE that collection, so "Assam" inside "Dinner in 20" returns nothing —
   * and the only affordance offered then destroyed the query too, leaving the
   * member to retype it to discover the recipe does exist.
   *
   * 📌 The query has its own ✕ inside the field. Two controls, two jobs.
   */
  const clearBrowse = useCallback(() => {
    setActiveRow(null);
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
                    <Svg
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: -SHADOW_PAD,
                        top: -SHADOW_PAD,
                      }}
                      width={tw + SHADOW_PAD * 2}
                      height={th + SHADOW_PAD * 2}
                    >
                      <Defs>
                        <LinearGradient id="cardShadow" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#000000" stopOpacity={0.25} />
                          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
                        </LinearGradient>
                      </Defs>
                      {/*
                        🔴 A GRADIENT, not a blur. `<Filter><FeGaussianBlur>`
                        type-checks and silently drops the element on Android
                        here — the same rect rendered as a sharp red block
                        with the filter removed, and nothing at all with it.
                        So the falloff is painted instead: her shadow's
                        visible part is the band under the card, and a
                        vertical fade is a faithful stand-in for a 50px blur
                        offset 25 down.
                      */}
                      <Rect
                        x={SHADOW_PAD + SHADOW_SPREAD}
                        y={SHADOW_PAD + th - 6}
                        width={tw - SHADOW_SPREAD * 2}
                        height={SHADOW_DY + 21}
                        rx={4}
                        fill="url(#cardShadow)"
                      />
                    </Svg>
                    {/*
                      🔴 The photo and its washes are clipped by THIS view, not
                      by the Pressable. A shadow and `overflow: "hidden"` on the
                      same view cancel out on Android — the clip takes the
                      shadow with it. Shadow on the outside, clipping on the
                      inside.
                    */}
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
                    <Svg
                      style={StyleSheet.absoluteFill}
                      width={tw}
                      height={th}
                      viewBox={`0 0 ${tw} ${th}`}
                    >
                      <Defs>
                        <LinearGradient id="tileBase" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0.091" stopColor="#361416" stopOpacity={0} />
                          <Stop offset="0.921" stopColor="#361416" stopOpacity={1} />
                        </LinearGradient>
                        <LinearGradient id="tileAccent" x1="0" y1="1" x2="1" y2="0">
                          <Stop offset="0.76" stopColor="#92B4BD" stopOpacity={0} />
                          <Stop offset="1" stopColor="#92B4BD" stopOpacity={0.53} />
                        </LinearGradient>
                      </Defs>
                      {/* 🔴 Numeric, not "100%": inside a nested <Svg> the
                          percentage did not resolve against the tile and the
                          washes drew as a hard-edged block over part of the
                          photo. */}
                      <Rect
                        x={0}
                        y={0}
                        width={tw}
                        height={th}
                        fill="url(#tileBase)"
                      />
                      <Rect
                        x={0}
                        y={0}
                        width={tw}
                        height={th}
                        fill="url(#tileAccent)"
                      />
                    </Svg>
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
   * 🔴 NOT `boxShadow`. It renders nothing on this screen on Android —
   * proved by forcing an opaque RED shadow with a 30px blur and finding zero
   * pixels, with `overflow` removed and an opaque background both ruled out
   * separately. `elevation` + the iOS shadow props do render.
   * 📌 `backgroundColor` is required: Android casts an elevation shadow from
   * the view's background, and this one is otherwise just an image.
   * ⚖️ It is subtle on this page, and that is honest — her value is pure
   * black at 25%, which over `#361416` cannot be anything else. It reads
   * stronger in Figma because the canvas behind her card is lighter.
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

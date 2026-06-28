import React, { useState, useEffect, useCallback } from "react";
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
import { getFavorites, removeFavorite } from "../../services/meals";
import type { MealFavorite } from "../../services/meals";

type MealTypeFilter = "all" | "breakfast" | "lunch" | "dinner";

// The four filter labels are a fixed-width cost that can't shrink, so on
// narrow screens (e.g. Galaxy S24 ~360dp) the pill row overflows. Tighten the
// pill padding / gap / row inset only on small screens; larger screens
// (iPhone 16 Pro ~393pt and up) keep the original spacing untouched.
const SCREEN_WIDTH = Dimensions.get("window").width;
const COMPACT = SCREEN_WIDTH < 380;
const PILL_PAD_H = COMPACT ? 12 : spacing.md;
const PILL_GAP = COMPACT ? 8 : 12;
const ROW_PAD_H = COMPACT ? spacing.md : spacing.lg;

export function SavedMealsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { evening, outerBg, textColor, subtleText } = useAppPalette();
  // Meal-name color is themed via textColor (#361416 day / bone night). The
  // cal/protein meta is a muted secondary: #7E6869 in light, a dimmed bone at
  // night so it reads as secondary against the bone name on the maroon bg.
  const metaColor = evening ? "rgba(243, 239, 227, 0.6)" : "#7E6869";
  const [meals, setMeals] = useState<MealFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<MealTypeFilter>("all");

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

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleRemove = async (mealId: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
    try {
      await removeFavorite(mealId);
    } catch {
      // Reload to restore if API fails
      loadFavorites();
    }
  };

  const handleMealPress = (meal: MealFavorite) => {
    navigation.navigate("RecipeDetail", {
      meal: {
        id: meal.id,
        name: meal.name,
        whyLine: "",
        calories: meal.calories ?? 0,
        protein: meal.protein ?? 0,
        prepTime: meal.prepTime ?? 0,
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
  const visibleMeals = meals.filter((m) => {
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

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={K.ochre} />
        </View>
      ) : visibleMeals.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: textColor }]}>No saved meals yet</Text>
          <Text style={[styles.emptyText, { color: subtleText }]}>
            Tap the bookmark on any meal card to save it here.
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
                    {meal.prepTime != null ? (
                      <View style={styles.gridTime}>
                        <Text style={styles.gridTimeText}>{meal.prepTime} min</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={styles.gridBookmark}
                      onPress={() => handleRemove(meal.id)}
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
                  {meal.calories != null ? (
                    <Text style={[styles.gridMeta, { color: metaColor }]}>
                      {Math.round(meal.calories)} cal
                    </Text>
                  ) : null}
                  {meal.protein != null ? (
                    <Text style={[styles.gridMeta, { color: metaColor }]}>
                      {Math.round(meal.protein)}g protein
                    </Text>
                  ) : null}
                </View>
              ))}
              {row.length === 1 ? <View style={styles.gridItem} /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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

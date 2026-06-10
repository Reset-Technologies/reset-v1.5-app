import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/MainNavigator";
import Svg, { Path } from "react-native-svg";
import { K } from "../../constants/colors";
import { typography, spacing, radius } from "../../constants/typography";
import { getFavorites, removeFavorite } from "../../services/meals";
import type { MealFavorite } from "../../services/meals";

type MealTypeFilter = "all" | "breakfast" | "lunch" | "dinner";

export function SavedMealsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [meals, setMeals] = useState<MealFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<MealTypeFilter>("all");

  const loadFavorites = useCallback(async () => {
    try {
      const mealType = filter === "all" ? undefined : filter;
      const favs = await getFavorites(mealType);
      setMeals(favs);
    } catch {
      // Keep current list on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

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

  // Group meals by cuisineCluster for category view
  const groupedMeals = meals.reduce<Record<string, MealFavorite[]>>((acc, meal) => {
    const category = meal.cuisineCluster || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(meal);
    return acc;
  }, {});

  const categories = Object.keys(groupedMeals).sort();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M11 19l-7-7 7-7"
              stroke={K.brown}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Meals</Text>
        <View style={styles.backButton} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "breakfast", "lunch", "dinner"] as MealTypeFilter[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterTab, filter === type && styles.filterTabActive]}
            onPress={() => setFilter(type)}
          >
            <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
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
      ) : meals.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No saved meals yet</Text>
          <Text style={styles.emptyText}>
            Tap the heart on any meal card to save it here.
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
          {categories.map((category) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
              {groupedMeals[category].map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  style={styles.mealRow}
                  onPress={() => handleMealPress(meal)}
                  activeOpacity={0.7}
                >
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <View style={styles.mealMeta}>
                      {meal.calories != null && (
                        <Text style={styles.mealMetaText}>{Math.round(meal.calories)} cal</Text>
                      )}
                      {meal.protein != null && (
                        <>
                          <Text style={styles.metaDot}>&middot;</Text>
                          <Text style={styles.mealMetaText}>{Math.round(meal.protein)}g protein</Text>
                        </>
                      )}
                      {meal.prepTime != null && (
                        <>
                          <Text style={styles.metaDot}>&middot;</Text>
                          <Text style={styles.mealMetaText}>{meal.prepTime} min</Text>
                        </>
                      )}
                    </View>
                    {meal.primaryProtein && (
                      <Text style={styles.mealTag}>{meal.primaryProtein}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(meal.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.removeIcon}>♥</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
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
    backgroundColor: K.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: K.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: K.bone,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 20,
    color: K.brown,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: K.brown,
    fontWeight: "600",
    fontSize: 17,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: K.bone,
  },
  filterTabActive: {
    backgroundColor: K.ochre,
  },
  filterText: {
    ...typography.caption,
    color: K.textMuted,
    fontWeight: "500",
  },
  filterTextActive: {
    color: K.white,
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: K.brown,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: K.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  categorySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: K.textMuted,
    fontWeight: "600",
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: K.bone,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    ...typography.bodyMedium,
    color: K.brown,
    fontWeight: "600",
    marginBottom: 4,
  },
  mealMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mealMetaText: {
    ...typography.caption,
    color: K.textMuted,
  },
  metaDot: {
    color: K.textMuted,
    fontSize: 10,
  },
  mealTag: {
    ...typography.caption,
    color: K.ochre,
    fontWeight: "500",
    marginTop: 4,
    textTransform: "capitalize",
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  removeIcon: {
    fontSize: 20,
    color: K.ochre,
  },
});

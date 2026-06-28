import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { spacing, radius, typography } from "../../constants/typography";
import { useAppPalette } from "../../hooks/useAppPalette";
import { BookmarkIcon } from "../BookmarkIcon";
import type { Meal } from "../MealCard";

interface RecipeCarouselCardProps {
  meal: Meal;
  slotLabel: string;
  isFavorited: boolean;
  onPress: () => void;
  onFavoriteToggle: () => void;
  onDeepRead?: () => void;
}

function RecipeCarouselCard({
  meal,
  slotLabel,
  isFavorited,
  onPress,
  onFavoriteToggle,
  onDeepRead,
}: RecipeCarouselCardProps) {
  const { nestedBg, textColor, subtleText, borderColor } = useAppPalette();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: nestedBg }]}
      activeOpacity={0.92}
      onPress={onPress}
    >
      <Text style={[styles.slotLabel, { color: subtleText }]}>{slotLabel}</Text>

      <View style={[styles.imageWrap, { backgroundColor: borderColor }]}>
        {meal.imageUrl ? (
          <Image source={{ uri: meal.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderIcon}>🍽️</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.favorite}
          hitSlop={8}
          onPress={onFavoriteToggle}
        >
          <BookmarkIcon filled={isFavorited} halo />
        </TouchableOpacity>
      </View>

      <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
        {meal.name}
      </Text>
      <Text style={[styles.meta, { color: subtleText }]}>{meal.prepTime} mins</Text>

      {meal.whyLine ? (
        <View style={[styles.whyWrap, { borderTopColor: borderColor }]}>
          <Text style={[styles.whyLabel, { color: subtleText }]}>Why this meal</Text>
          <Text style={[styles.whyText, { color: textColor }]} numberOfLines={3}>
            {meal.whyLine}
          </Text>
          {onDeepRead ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onDeepRead();
              }}
              activeOpacity={0.7}
              hitSlop={6}
            >
              <Text style={[styles.deepReadLink, { color: textColor }]}>Deep read →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

interface RecipesCarouselProps {
  slotLabel: string;
  meals: Meal[];
  favoritedMealIds: Set<string>;
  onMealPress: (meal: Meal) => void;
  onFavoriteToggle: (mealId: string) => void;
  onDeepRead?: (meal: Meal) => void;
}

export function RecipesCarousel({
  slotLabel,
  meals,
  favoritedMealIds,
  onMealPress,
  onFavoriteToggle,
  onDeepRead,
}: RecipesCarouselProps) {
  if (meals.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.row}
    >
      {meals.map((meal, index) => (
        <RecipeCarouselCard
          key={`${meal.id}-${index}`}
          meal={meal}
          slotLabel={slotLabel}
          isFavorited={favoritedMealIds.has(meal.id)}
          onPress={() => onMealPress(meal)}
          onFavoriteToggle={() => onFavoriteToggle(meal.id)}
          onDeepRead={onDeepRead ? () => onDeepRead(meal) : undefined}
        />
      ))}
    </ScrollView>
  );
}

const CARD_WIDTH = 207;

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.sm,
    padding: 12,
    gap: spacing.sm,
  },
  slotLabel: {
    ...typography.caption,
    fontSize: 12,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderIcon: {
    fontSize: 40,
  },
  favorite: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: "700",
    fontSize: 16,
  },
  meta: {
    ...typography.bodySmall,
    fontSize: 14,
  },
  whyWrap: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    gap: 4,
  },
  whyLabel: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  whyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deepReadLink: {
    fontSize: 13,
    marginTop: 2,
    textDecorationLine: "underline",
  },
});

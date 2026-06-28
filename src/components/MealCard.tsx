import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { K, MetabolicType } from "../constants/colors";
import { useToast } from "../context/ToastContext";
import { typography, spacing, radius } from "../constants/typography";
import { BookmarkIcon } from "./BookmarkIcon";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48; // Account for padding
const CARD_GAP = 12;

export interface Meal {
  id: string;
  name: string;
  whyLine: string; // Max 15 words
  calories: number;
  protein: number;
  prepTime: number; // in minutes
  time: "breakfast" | "lunch" | "dinner" | "snack";
  imageUrl?: string;
  // Meal engine fields
  iliScore?: number;
  inflammatoryIndex?: "pro" | "neutral" | "anti";
  foodQuality?: "whole" | "minimally_processed" | "ultra_processed";
  primaryProtein?: string;
  cuisineCluster?: string;
}

// Feedback tags for the bottom sheet
const FEEDBACK_TAGS = [
  { id: "complex", label: "Too complex" },
  { id: "taste", label: "Didn't like taste" },
  { id: "long", label: "Too long" },
  { id: "not_full", label: "Didn't keep me full" },
  { id: "ingredients", label: "Don't like ingredients" },
  { id: "repetitive", label: "Had this recently" },
];

interface MealCardProps {
  meal: Meal;
  metabolicType?: MetabolicType;
  isFavorited?: boolean;
  isEaten?: boolean;
  initialFeedback?: "up" | "down" | null;
  initialTags?: string[];
  onPress?: () => void;
  onFeedback?: (feedback: "up" | "down", tags?: string[], freeText?: string) => void;
  onUndoFeedback?: () => void;
  onChatPress?: () => void;
  onRecipePress?: () => void;
  onFavoriteToggle?: (isFavorited: boolean) => void;
  onReplace?: () => void;
  onToggleEaten?: () => void;
}

export function MealCard({ meal, metabolicType, isFavorited = false, isEaten = false, initialFeedback = null, initialTags = [], onPress, onFeedback, onUndoFeedback, onChatPress, onRecipePress, onFavoriteToggle, onReplace, onToggleEaten }: MealCardProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(initialFeedback);
  const [showSheet, setShowSheet] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [favorited, setFavorited] = useState(isFavorited);
  const toast = useToast();

  useEffect(() => {
    setFeedback(initialFeedback);
  }, [initialFeedback]);

  useEffect(() => {
    setFavorited(isFavorited);
  }, [isFavorited]);

  const handleThumbsUp = () => {
    if (feedback === "up") {
      setFeedback(null);
      onUndoFeedback?.();
      return;
    }
    setFeedback("up");
    onFeedback?.("up");
    toast.show({ message: "Thanks for your feedback", icon: "✓" });
  };

  const handleThumbsDown = () => {
    if (feedback === "down") {
      setFeedback(null);
      onUndoFeedback?.();
      return;
    }
    setFeedback("down");
    setSelectedTags([]);
    setFreeText("");
    setShowSheet(true);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((t) => t !== tagId)
        : [...prev, tagId]
    );
  };

  const submitFeedback = () => {
    onFeedback?.("down", selectedTags, freeText.trim() || undefined);
    setShowSheet(false);
    toast.show({ message: "Thanks for your feedback", icon: "✓" });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {meal.imageUrl ? (
          <Image source={{ uri: meal.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>🍽️</Text>
          </View>
        )}
        {/* Prep time badge */}
        <View style={styles.prepBadge}>
          <Text style={styles.prepText}>{meal.prepTime} min</Text>
        </View>
        {/* Favorite button */}
        {onFavoriteToggle && (
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => {
              const next = !favorited;
              setFavorited(next);
              onFavoriteToggle(next);
            }}
          >
            <BookmarkIcon filled={favorited} halo />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name}>{meal.name}</Text>

        {/* Nutrition badge */}
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionBadge}>
            <Text style={styles.nutritionText}>{Math.ceil(meal.calories)} cal</Text>
          </View>
          <View style={styles.nutritionBadge}>
            <Text style={styles.nutritionText}>{Math.ceil(meal.protein)}g protein</Text>
          </View>
        </View>

        {/* Personalized Why Section */}
        {metabolicType && meal.whyLine ? (
          <View style={styles.whySection}>
            <Text style={styles.whyHeader}>For {metabolicType}s:</Text>
            <Text style={styles.whyExplanation} numberOfLines={2}>
              {meal.whyLine}
            </Text>
            {meal.whyLine.length > 80 && onRecipePress && (
              <TouchableOpacity onPress={onRecipePress}>
                <Text style={styles.moreLink}>more</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Eaten toggle */}
        {onToggleEaten && (
          <TouchableOpacity
            style={[styles.eatenButton, isEaten && styles.eatenButtonActive]}
            onPress={onToggleEaten}
            activeOpacity={0.7}
          >
            <Text style={[styles.eatenText, isEaten && styles.eatenTextActive]}>
              {isEaten ? "✓ Eaten" : "I ate this"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Feedback row */}
        <View style={styles.feedbackRow}>
          <TouchableOpacity
            style={[
              styles.thumbButton,
              feedback === "up" && styles.thumbButtonActive,
            ]}
            onPress={handleThumbsUp}
          >
            <Text style={styles.thumbIcon}>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.thumbButton,
              feedback === "down" && styles.thumbButtonActive,
            ]}
            onPress={handleThumbsDown}
          >
            <Text style={styles.thumbIcon}>👎</Text>
          </TouchableOpacity>
          {onRecipePress && (
            <TouchableOpacity
              style={styles.recipeButton}
              onPress={onRecipePress}
            >
              <Text style={styles.recipeButtonText}>Recipe</Text>
            </TouchableOpacity>
          )}
          {onChatPress && (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={onChatPress}
            >
              <Text style={styles.chatButtonText}>Ask Ester</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>

      {/* Feedback bottom sheet */}
      <Modal visible={showSheet} transparent animationType="slide" onRequestClose={() => setShowSheet(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowSheet(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.sheetContainer}>
                <View style={styles.sheetHeader}>
                  <TouchableOpacity onPress={() => setShowSheet(false)}>
                    <Text style={styles.sheetClose}>×</Text>
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>Provide feedback</Text>
                  <View style={{ width: 24 }} />
                </View>
                <View style={styles.tagsRow}>
                  {FEEDBACK_TAGS.map((tag) => (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.tagPill, selectedTags.includes(tag.id) && styles.tagPillSelected]}
                      onPress={() => toggleTag(tag.id)}
                    >
                      <Text style={[styles.tagText, selectedTags.includes(tag.id) && styles.tagTextSelected]}>
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.freeTextInput}
                  placeholder="Write any feedback"
                  placeholderTextColor={K.faded}
                  value={freeText}
                  onChangeText={setFreeText}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[styles.submitButton, !selectedTags.length && !freeText.trim() && styles.submitButtonDisabled]}
                  onPress={submitFeedback}
                  disabled={!selectedTags.length && !freeText.trim()}
                >
                  <Text style={styles.submitText}>Submit</Text>
                </TouchableOpacity>
                {onReplace && (
                  <TouchableOpacity style={styles.replaceButton} onPress={() => {
                    onFeedback?.("down", selectedTags, freeText.trim() || undefined);
                    setShowSheet(false);
                    toast.show({ message: "Thanks for your feedback", icon: "✓" });
                    onReplace();
                  }}>
                    <Text style={styles.replaceText}>Get different option</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

// MealCardSlot - Horizontal swipeable container for 3 meal cards
interface MealCardSlotProps {
  meals: Meal[];
  label: string;
  metabolicType?: MetabolicType;
  favoritedMealIds?: Set<string>;
  eatenMealIds?: Set<string>;
  mealFeedback?: Record<string, { feedback: "up" | "down"; tags: string[] }>;
  onMealPress?: (meal: Meal) => void;
  onFeedback?: (mealId: string, feedback: "up" | "down", tags?: string[], freeText?: string) => void;
  onUndoFeedback?: (mealId: string) => void;
  onChatPress?: (meal: Meal) => void;
  onRecipePress?: (meal: Meal) => void;
  onFavoriteToggle?: (mealId: string, isFavorited: boolean) => void;
  onReplace?: (mealId: string, slot: string) => void;
  onToggleEaten?: (mealId: string, slot: string) => void;
}

export function MealCardSlot({ meals, label, metabolicType, favoritedMealIds, eatenMealIds, mealFeedback, onMealPress, onFeedback, onUndoFeedback, onChatPress, onRecipePress, onFavoriteToggle, onReplace, onToggleEaten }: MealCardSlotProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(index);
  };

  return (
    <View style={slotStyles.container}>
      <View style={slotStyles.header}>
        <Text style={slotStyles.label}>{label}</Text>
        <View style={slotStyles.dots}>
          {meals.map((_, i) => (
            <View
              key={i}
              style={[slotStyles.dot, i === activeIndex && slotStyles.dotActive]}
            />
          ))}
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        contentContainerStyle={slotStyles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {meals.map((meal) => (
          <View key={meal.id} style={slotStyles.cardWrapper}>
            <MealCard
              meal={meal}
              metabolicType={metabolicType}
              isFavorited={favoritedMealIds?.has(meal.id)}
              isEaten={eatenMealIds?.has(meal.id)}
              initialFeedback={mealFeedback?.[meal.id]?.feedback ?? null}
              initialTags={mealFeedback?.[meal.id]?.tags ?? []}
              onPress={() => onMealPress?.(meal)}
              onFeedback={(fb, tags, ft) => onFeedback?.(meal.id, fb, tags, ft)}
              onUndoFeedback={onUndoFeedback ? () => onUndoFeedback(meal.id) : undefined}
              onChatPress={onChatPress ? () => onChatPress(meal) : undefined}
              onRecipePress={onRecipePress ? () => onRecipePress(meal) : undefined}
              onFavoriteToggle={onFavoriteToggle ? (fav) => onFavoriteToggle(meal.id, fav) : undefined}
              onReplace={onReplace ? () => onReplace(meal.id, label.toLowerCase()) : undefined}
              onToggleEaten={onToggleEaten ? () => onToggleEaten(meal.id, label.toLowerCase()) : undefined}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: K.white,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.border,
    width: CARD_WIDTH,
  },
  imageContainer: {
    height: 160,
    backgroundColor: K.bone,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 48,
  },
  prepBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: K.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  prepText: {
    ...typography.caption,
    color: K.brown,
    fontWeight: "600",
  },
  favoriteButton: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  whySection: {
    backgroundColor: K.bone,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  whyHeader: {
    ...typography.caption,
    color: K.ochre,
    fontWeight: "700",
    marginBottom: 2,
  },
  whyExplanation: {
    ...typography.bodySmall,
    color: K.brown,
    fontStyle: "italic",
    lineHeight: 18,
  },
  moreLink: {
    ...typography.caption,
    color: K.ochre,
    fontWeight: "600",
    marginTop: 2,
  },
  content: {
    padding: spacing.md,
  },
  name: {
    ...typography.h3,
    fontSize: 18,
    color: K.brown,
    marginBottom: 4,
  },
  nutritionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nutritionBadge: {
    backgroundColor: K.bone,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  nutritionText: {
    ...typography.caption,
    color: K.brown,
    fontWeight: "500",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  eatenButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: K.brown,
    backgroundColor: K.white,
    marginBottom: spacing.sm,
  },
  eatenButtonActive: {
    backgroundColor: K.ochre,
    borderColor: K.ochre,
  },
  eatenText: {
    ...typography.caption,
    color: K.brown,
    fontWeight: "600",
  },
  eatenTextActive: {
    color: K.brown,
  },
  thumbButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: K.bone,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbButtonActive: {
    backgroundColor: K.ochre,
  },
  thumbIcon: {
    fontSize: 20,
  },
  recipeButton: {
    marginLeft: "auto",
    backgroundColor: K.bone,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: K.brown,
  },
  recipeButtonText: {
    ...typography.caption,
    color: K.brown,
    fontWeight: "600",
  },
  chatButton: {
    backgroundColor: K.blue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  chatButtonText: {
    ...typography.caption,
    color: K.brown,
    fontWeight: "600",
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: K.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  sheetClose: {
    fontSize: 24,
    color: K.brown,
    fontWeight: "300",
  },
  sheetTitle: {
    ...typography.bodyMedium,
    color: K.brown,
    fontWeight: "600",
  },
  freeTextInput: {
    backgroundColor: K.bone,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    color: K.brown,
    minHeight: 80,
    textAlignVertical: "top",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tagPill: {
    backgroundColor: K.bone,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: K.border,
  },
  tagPillSelected: {
    backgroundColor: K.ochre,
    borderColor: K.ochre,
  },
  tagText: {
    ...typography.caption,
    color: K.brown,
  },
  tagTextSelected: {
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: K.brown,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    ...typography.caption,
    color: K.bone,
    fontWeight: "600",
  },
  replaceButton: {
    marginTop: spacing.sm,
    backgroundColor: K.blue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  replaceText: {
    ...typography.caption,
    color: K.brown,
    fontWeight: "600",
  },
});

const slotStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: K.brown,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.border,
  },
  dotActive: {
    backgroundColor: K.ochre,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: CARD_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
});

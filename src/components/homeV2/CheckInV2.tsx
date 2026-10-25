import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { fonts, spacing } from "../../constants/typography";
import { K } from "../../constants/colors";
import { useAppPalette } from "../../hooks/useAppPalette";

const ENERGY_OPTIONS = [
  { id: "low", label: "Low", emoji: "😴" },
  { id: "okay", label: "Okay", emoji: "😐" },
  { id: "steady", label: "Steady", emoji: "🙂" },
  { id: "high", label: "High", emoji: "⚡" },
];

const STRESS_OPTIONS = [
  { id: "work", label: "Work", emoji: "💼" },
  { id: "sleep", label: "Sleep", emoji: "😴" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "health", label: "Health", emoji: "🏥" },
  { id: "none", label: "None", emoji: "✨" },
];

const SLEEP_QUALITY = [
  { id: "poor", label: "Poor" },
  { id: "okay", label: "Okay" },
  { id: "good", label: "Good" },
  { id: "great", label: "Great" },
];

interface CheckInData {
  energy: string | null;
  stress: string | null;
  sleepHours: number | null;
  sleepQuality: string | null;
}

interface CheckInV2Props {
  onComplete: (data: CheckInData) => Promise<string | undefined>;
  onDismiss?: () => void;
}

function TypingDots({ color }: { color: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 3), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color },
            tick === i && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

export function CheckInV2({ onComplete, onDismiss }: CheckInV2Props) {
  const { nestedBg, innerBg, textColor, subtleText } = useAppPalette();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CheckInData>({
    energy: null,
    stress: null,
    sleepHours: null,
    sleepQuality: null,
  });
  const [esterResponse, setEsterResponse] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEnergySelect = (id: string) => {
    setData((prev) => ({ ...prev, energy: id }));
    setStep(2);
  };

  const handleStressSelect = (id: string) => {
    setData((prev) => ({ ...prev, stress: id }));
    setStep(3);
  };

  const completeCheckIn = async (finalData: CheckInData) => {
    setIsSubmitting(true);
    const response = await onComplete(finalData);
    setEsterResponse(response || "Got it. I'll use this to tune your meals.");
    setIsSubmitting(false);
  };

  const handleSleepSelect = (hours: number, quality: string) => {
    const finalData = { ...data, sleepHours: hours, sleepQuality: quality };
    setData(finalData);
    completeCheckIn(finalData);
  };

  const handleSkipSleep = () => {
    completeCheckIn(data);
  };

  if (esterResponse || isSubmitting) {
    return (
      <View style={[styles.container, { backgroundColor: nestedBg }]}>
        <View style={styles.esterRow}>
          <View style={styles.esterAvatar}>
            <Text style={styles.esterAvatarLabel}>E</Text>
          </View>
          {isSubmitting ? (
            <TypingDots color={subtleText} />
          ) : (
            <Text style={[styles.esterMessage, { color: textColor }]}>
              {esterResponse}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: nestedBg }]}>
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              { backgroundColor: innerBg },
              s === step && [styles.stepDotActive, { backgroundColor: textColor }],
              s < step && { backgroundColor: textColor },
            ]}
          />
        ))}
        {onDismiss && (
          <TouchableOpacity
            style={[styles.dismissButton, { backgroundColor: innerBg }]}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={[styles.dismissText, { color: textColor }]}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={[styles.question, { color: textColor }]}>
            How's your energy today?
          </Text>
          <View style={styles.options}>
            {ENERGY_OPTIONS.map((option) => {
              const selected = data.energy === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.pill,
                    { borderColor: textColor },
                    selected && { backgroundColor: textColor },
                  ]}
                  onPress={() => handleEnergySelect(option.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pillEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.pillLabel,
                      { color: selected ? nestedBg : textColor },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContent}>
          <Text style={[styles.question, { color: textColor }]}>
            Any stress sources today?
          </Text>
          <View style={styles.options}>
            {STRESS_OPTIONS.map((option) => {
              const selected = data.stress === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.pill,
                    { borderColor: textColor },
                    selected && { backgroundColor: textColor },
                  ]}
                  onPress={() => handleStressSelect(option.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pillEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.pillLabel,
                      { color: selected ? nestedBg : textColor },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={[styles.question, { color: textColor }]}>
            How'd you sleep?
          </Text>
          <View style={styles.sleepRow}>
            <Text style={[styles.sleepLabel, { color: subtleText }]}>Hours</Text>
            <View style={styles.hoursOptions}>
              {[5, 6, 7, 8, 9].map((h) => {
                const selected = data.sleepHours === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.hourPill,
                      { borderColor: textColor },
                      selected && { backgroundColor: textColor },
                    ]}
                    onPress={() =>
                      setData((prev) => ({ ...prev, sleepHours: h }))
                    }
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.hourText,
                        { color: selected ? nestedBg : textColor },
                      ]}
                    >
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {data.sleepHours && (
            <View style={styles.sleepRow}>
              <Text style={[styles.sleepLabel, { color: subtleText }]}>Quality</Text>
              <View style={styles.qualityOptions}>
                {SLEEP_QUALITY.map((q) => {
                  const selected = data.sleepQuality === q.id;
                  return (
                    <TouchableOpacity
                      key={q.id}
                      style={[
                        styles.qualityPill,
                        { borderColor: textColor },
                        selected && { backgroundColor: textColor },
                      ]}
                      onPress={() => handleSleepSelect(data.sleepHours!, q.id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.pillLabel,
                          { color: selected ? nestedBg : textColor },
                        ]}
                      >
                        {q.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipSleep}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: subtleText }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: 4,
    padding: spacing.md,
    gap: spacing.md,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 20,
  },
  stepContent: {
    alignItems: "center",
    gap: spacing.md,
  },
  question: {
    fontFamily: fonts.catalogue,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    gap: 6,
    minHeight: 32,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillLabel: {
    fontFamily: fonts.catalogueBold,
    fontSize: 14,
  },
  sleepRow: {
    width: "100%",
    gap: spacing.sm,
  },
  sleepLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 12,
    letterSpacing: -0.12,
  },
  hoursOptions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  hourPill: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hourText: {
    fontFamily: fonts.catalogueBold,
    fontSize: 14,
  },
  esterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  esterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: K.ochre,
    justifyContent: "center",
    alignItems: "center",
  },
  esterAvatarLabel: {
    fontFamily: fonts.catalogueBold,
    fontSize: 13,
    color: K.brown,
  },
  esterMessage: {
    flex: 1,
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    height: 28,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.4,
  },
  dotActive: {
    opacity: 1,
  },
  qualityOptions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  qualityPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
  },
  dismissButton: {
    position: "absolute",
    right: 0,
    top: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dismissText: {
    fontSize: 18,
    fontWeight: "400",
  },
});

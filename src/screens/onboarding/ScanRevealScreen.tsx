import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { K, TC } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { EsterBubble, Button, Avatar } from "../../components";
import { useApp } from "../../context/AppContext";
import { determineType, getTypeRevealText } from "../../constants/types";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "ScanReveal">;

interface BiometricRowProps {
  icon: string;
  label: string;
  value: string | number;
  note?: string;
  delay: number;
}

function BiometricRow({ icon, label, value, note, delay }: BiometricRowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowValueRow}>
          <Text style={styles.rowValue}>{value}</Text>
          {note && <Text style={styles.rowNote}>{note}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

export function ScanRevealScreen({ navigation }: Props) {
  const { state, setMetabolicType } = useApp();
  const biometrics = state.biometrics;

  useEffect(() => {
    logEvent("onboarding_scan_reveal");
  }, []);

  // Get quiz answers for type determination
  const q1 = (state.user.quizAnswers.q1 as "afternoon_evening" | "random") || "afternoon_evening";
  const q2 = (state.user.quizAnswers.q2 as "crash" | "drift") || "crash";

  // Get path-specific reveal message
  const revealText = getTypeRevealText(q1, q2, true);

  const handleContinue = () => {
    logEvent("onboarding_scan_reveal_seeMyTypeCTA");
    // Determine and set type based on quiz answers
    const type = determineType(q1, q2);
    setMetabolicType(type);
    navigation.navigate("TypeReveal");
  };

  if (!biometrics) {
    // Fallback if no biometrics (shouldn't happen but safety)
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <EsterBubble message="Let me analyze your quiz responses to determine your metabolic type." />
        </View>
        <View style={styles.bottom}>
          <Button title="See My Type" onPress={handleContinue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        {/* Ester reveal message */}
        <View style={styles.esterSection}>
          <Avatar size={40} />
          <View style={styles.esterBubble}>
            <Text style={styles.esterText}>{revealText}</Text>
          </View>
        </View>

        {/* Biometric results */}
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>YOUR SCAN RESULTS</Text>

          <BiometricRow
            icon="🧘"
            label="Stress Index"
            value={biometrics.stressIndex}
            note="elevated"
            delay={0}
          />
          <BiometricRow
            icon="💓"
            label="Heart Rate"
            value={`${biometrics.heartRate} BPM`}
            note="slightly elevated"
            delay={150}
          />
          {biometrics.hrvSdnn != null && (
            <BiometricRow
              icon="💗"
              label="Heart Rate Variability"
              value={`${Math.round(biometrics.hrvSdnn)} ms`}
              delay={300}
            />
          )}
          {biometrics.breathingRate != null && (
            <BiometricRow
              icon="🌬️"
              label="Breathing Rate"
              value={`${Math.round(biometrics.breathingRate)} /min`}
              delay={450}
            />
          )}
          <BiometricRow
            icon="✨"
            label="Wellness"
            value={`${biometrics.wellness}/100`}
            delay={600}
          />
        </View>
      </View>

      <View style={styles.bottom}>
        <Button title="See My Type" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.cream,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  esterSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 28,
  },
  esterBubble: {
    flex: 1,
    backgroundColor: K.warmGray,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
  },
  esterText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: K.text,
  },
  results: {
    backgroundColor: K.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: K.border,
  },
  sectionTitle: {
    fontSize: 10,
    color: K.faded,
    letterSpacing: 1.5,
    fontWeight: "600",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: K.border,
  },
  rowIcon: {
    fontSize: 26,
    marginRight: 16,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    color: K.sub,
    marginBottom: 2,
  },
  rowValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  rowValue: {
    ...typography.h3,
    fontSize: 22,
  },
  rowNote: {
    fontSize: 12,
    color: K.mustard,
    fontStyle: "italic",
  },
  bottom: {
    padding: 24,
    paddingBottom: 40,
  },
});

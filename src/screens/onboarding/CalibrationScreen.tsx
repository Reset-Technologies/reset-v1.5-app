import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K, toMetabolicType } from "../../constants/colors";
import { TYPE_MASCOT } from "../../constants/mascots";
import { fonts, radius } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "Calibration">;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const WHITE = "#FAFDFE";
const MUTED = "#7E6869";
// Inset card fill — a touch lighter than the maroon screen, matching the
// Quick Scan screen's outer/inner treatment (the palette's evening innerBg).
const CARD_FILL = "#513436";

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.453592;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function CalibrationScreen({ navigation, route }: Props) {
  const { state, setCalibration } = useApp();
  const insets = useSafeAreaInsets();
  // "rescan" is entered before every re-scan to capture a fresh weight; height +
  // age are stable, so we hide them and reuse the stored calibration. Falls back
  // to the full form if there's no stored calibration to borrow from.
  const isRescan = route.params?.mode === "rescan";
  const stored = state.user.calibration;
  const hasStoredBody = !!(
    stored?.heightCm &&
    stored?.age &&
    stored?.biologicalSex
  );
  const weightOnly = isRescan && hasStoredBody; // hide Height + Age + Gender

  // Weight-only re-scan opens on a decision screen ("is your weight the same?")
  // rather than a forced input — tapping "update my weight" reveals the field.
  const [editingWeight, setEditingWeight] = useState(false);
  const metabolicType = toMetabolicType(state.user.metabolicType) ?? "Explorer";
  const mascotSource = TYPE_MASCOT[metabolicType];

  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"female" | "male" | null>(null);

  // Auto-advance focus (RES-136): the number-pad keyboard has no "next" key,
  // so we jump to the next field as soon as a fixed-width one fills up.
  const inchesRef = useRef<TextInput>(null);
  const weightRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  useEffect(() => {
    logEvent(isRescan ? "rescan_weight" : "onboarding_calibration");
  }, [isRescan]);

  const ft = parseInt(feet, 10);
  const inch = parseInt(inches, 10);
  const lb = parseInt(weightLb, 10);
  const yrs = parseInt(age, 10);

  const heightValid = ft >= 3 && ft <= 8 && inch >= 0 && inch <= 11;
  const weightValid = lb >= 50 && lb <= 600;
  const ageValid = yrs >= 13 && yrs <= 100;
  const isValid = weightOnly
    ? weightValid
    : heightValid && weightValid && ageValid && sex !== null;

  const handleContinue = () => {
    if (!isValid) return;
    logEvent(
      isRescan ? "rescan_weight_continueCTA" : "onboarding_calibration_continueCTA",
    );
    if (weightOnly && stored) {
      // Weight-only re-scan: only weight is fresh; reuse the stable stored
      // height, age, and gender.
      setCalibration({
        heightCm: stored.heightCm,
        weightKg: Math.round(lb * KG_PER_LB),
        age: stored.age,
        biologicalSex: stored.biologicalSex,
      });
    } else {
      if (!sex) return;
      setCalibration({
        heightCm: Math.round((ft * 12 + inch) * CM_PER_INCH),
        weightKg: Math.round(lb * KG_PER_LB),
        age: yrs,
        biologicalSex: sex,
      });
    }
    if (isRescan) {
      // The Scan screen pushed us on top of itself; pop back to it and it
      // proceeds with the fresh calibration. (No Home flash — Scan is already
      // presented underneath, so nothing dismisses to reveal Home.)
      navigation.goBack();
    } else {
      navigation.navigate("Scan");
    }
  };

  // "My weight is the same": nothing to update — the stored calibration already
  // holds the last weight, so drop straight back to the Scan beneath us.
  const handleSkipWeight = () => {
    logEvent("rescan_weight_skip");
    navigation.goBack();
  };

  // Rescan-only header actions. Back-arrow returns to wherever the scan was
  // launched from (dismissing this sheet AND the Scan screen beneath it); the X
  // goes straight home. Onboarding gets neither (it's a required linear step).
  const handleBack = () => {
    navigation.pop(2);
  };
  const handleClose = () => {
    // Dismiss the whole scan stack (weight sheet + Scan) back to the root tabs,
    // same slide-down as the back arrow — navigate("Tabs") re-presents as a
    // card, which reads as a half-height sheet pulling up.
    navigation.popToTop();
  };

  // Re-scan weight decision screen: default to "my weight is the same" (skip),
  // with an option to reveal the weight input. The BMI explanation is the main
  // copy below the metabolic-type mascot.
  if (weightOnly && !editingWeight) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.decisionSafe,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.decisionCard}>
            <View style={styles.mascotWrap} pointerEvents="none">
              <Image
                source={mascotSource}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.decisionHeader} pointerEvents="box-none">
              <TouchableOpacity
                onPress={handleBack}
                style={styles.headerBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Back"
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M19 12H5M11 19l-7-7 7-7"
                    stroke={BONE}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close"
              >
                <Text style={styles.headerCloseGlyph}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.decisionContent}>
              <Text style={styles.decisionText}>
                Before your scan, let's make sure your{" "}
                <Text style={styles.decisionTextStrong}>weight</Text> is up to
                date — I use it to calculate your{" "}
                <Text style={styles.decisionTextStrong}>BMI</Text>.
              </Text>
              <View style={styles.decisionCtas}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSkipWeight}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    My weight is the same — take me to the scan
                  </Text>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 12h14M13 5l7 7-7 7"
                      stroke={MAROON}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingWeight(true)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Text style={styles.updateLink}>
                    I want to update my weight
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="calBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.44" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.82" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#calBg)" />
        </Svg>
      </View>

      {weightOnly && (
        <View
          style={[styles.rescanHeader, { top: insets.top + 6 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() => setEditingWeight(false)}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back"
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M11 19l-7-7 7-7"
                stroke={BONE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close"
          >
            <Text style={styles.headerCloseGlyph}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.headline}>
                {weightOnly ? "Update your weight" : "A few quick details"}
              </Text>
              <Text style={styles.subhead}>
                {weightOnly
                  ? "So today's scan reflects your current weight."
                  : "This calibrates your scan so the reading is accurate to your body."}
              </Text>
            </View>

            <View style={styles.fields}>
              {!weightOnly && (
                <Field label="Height">
                  <View style={styles.heightRow}>
                    <View style={styles.unitInput}>
                      <TextInput
                        style={styles.input}
                        value={feet}
                        onChangeText={(t) => {
                          setFeet(t);
                          if (t.length === 1) inchesRef.current?.focus();
                        }}
                        placeholder="5"
                        placeholderTextColor={MUTED}
                        keyboardType="number-pad"
                        maxLength={1}
                      />
                      <Text style={styles.unitLabel}>ft</Text>
                    </View>
                    <View style={styles.unitInput}>
                      <TextInput
                        ref={inchesRef}
                        style={styles.input}
                        value={inches}
                        onChangeText={(t) => {
                          setInches(t);
                          if (t.length === 2) weightRef.current?.focus();
                        }}
                        placeholder="9"
                        placeholderTextColor={MUTED}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <Text style={styles.unitLabel}>in</Text>
                    </View>
                  </View>
                </Field>
              )}

              <Field label="Weight">
                <View style={styles.unitInput}>
                  <TextInput
                    ref={weightRef}
                    style={styles.input}
                    value={weightLb}
                    onChangeText={(t) => {
                      setWeightLb(t);
                      if (t.length === 3) ageRef.current?.focus();
                    }}
                    placeholder="150"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unitLabel}>lbs</Text>
                </View>
              </Field>

              {!weightOnly && (
                <Field label="Age">
                  <View style={styles.unitInput}>
                    <TextInput
                      ref={ageRef}
                      style={styles.input}
                      value={age}
                      onChangeText={setAge}
                      placeholder="32"
                      placeholderTextColor={MUTED}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.unitLabel}>years</Text>
                  </View>
                </Field>
              )}

              {!weightOnly && (
                <Field label="Gender">
                  <View style={styles.sexRow}>
                    {(["female", "male"] as const).map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.sexOption,
                          sex === option && styles.sexOptionActive,
                        ]}
                        onPress={() => setSex(option)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            styles.sexOptionText,
                            sex === option && styles.sexOptionTextActive,
                          ]}
                        >
                          {option === "female" ? "Female" : "Male"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
              )}
            </View>

            <TouchableOpacity
              style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
              onPress={handleContinue}
              disabled={!isValid}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },

  // ── Re-scan weight decision screen ──
  decisionSafe: { flex: 1 },
  decisionCard: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: CARD_FILL,
  },
  decisionHeader: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  mascotWrap: {
    position: "absolute",
    top: -90,
    left: -105,
    width: 426,
    height: 426,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotImage: { width: "100%", height: "100%" },
  decisionContent: {
    flex: 1,
    paddingTop: 340,
    paddingBottom: 40,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    gap: 32,
  },
  decisionText: {
    // Matches the Quick Scan (DataGate) `body` style.
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 28,
    color: BONE,
    letterSpacing: -0.2,
  },
  decisionTextStrong: {
    // Matches the Quick Scan (DataGate) `bodyStrong` emphasis.
    fontFamily: fonts.dmSansBold,
  },
  decisionCtas: { gap: 16 },
  primaryBtn: {
    backgroundColor: BONE,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  primaryBtnText: {
    flex: 1,
    // Matches the Quick Scan (DataGate) `bannerLabel` button style.
    fontFamily: fonts.catalogue,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
  updateLink: {
    fontFamily: fonts.dmSans,
    fontSize: 15,
    lineHeight: 20,
    color: BONE,
    textDecorationLine: "underline",
    textAlign: "center",
    alignSelf: "center",
    letterSpacing: -0.15,
    paddingVertical: 4,
  },
  rescanHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCloseGlyph: {
    fontFamily: fonts.dmSans,
    fontSize: 22,
    lineHeight: 24,
    color: BONE,
  },
  keyboardView: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "center",
    gap: 32,
  },

  header: { gap: 8 },
  headline: {
    fontFamily: fonts.dmSans,
    fontSize: 36,
    lineHeight: 40,
    color: BONE,
    letterSpacing: -0.4,
  },
  subhead: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    lineHeight: 22,
    color: BONE,
    letterSpacing: -0.16,
  },

  fields: { gap: 20 },
  field: { gap: 8 },
  fieldLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.16,
  },

  heightRow: { flexDirection: "row", gap: 12 },
  unitInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: BONE,
    borderBottomRightRadius: 20,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: fonts.dmSans,
    fontSize: 18,
    color: BONE,
    letterSpacing: -0.18,
  },
  unitLabel: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: MUTED,
    letterSpacing: -0.14,
  },

  sexRow: { flexDirection: "row", gap: 12 },
  sexOption: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BONE,
    borderBottomRightRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sexOptionActive: {
    backgroundColor: WHITE,
    borderColor: WHITE,
  },
  sexOptionText: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.16,
  },
  sexOptionTextActive: { color: MAROON },

  continueBtn: {
    backgroundColor: WHITE,
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
});

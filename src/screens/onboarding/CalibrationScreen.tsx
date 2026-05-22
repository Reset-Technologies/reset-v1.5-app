import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "Calibration">;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const WHITE = "#FAFDFE";
const MUTED = "#7E6869";

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

export function CalibrationScreen({ navigation }: Props) {
  const { setCalibration } = useApp();
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"female" | "male" | null>(null);

  useEffect(() => {
    logEvent("onboarding_calibration");
  }, []);

  const ft = parseInt(feet, 10);
  const inch = parseInt(inches, 10);
  const lb = parseInt(weightLb, 10);
  const yrs = parseInt(age, 10);

  const heightValid = ft >= 3 && ft <= 8 && inch >= 0 && inch <= 11;
  const weightValid = lb >= 50 && lb <= 600;
  const ageValid = yrs >= 13 && yrs <= 100;
  const isValid = heightValid && weightValid && ageValid && sex !== null;

  const handleContinue = () => {
    if (!isValid || !sex) return;
    logEvent("onboarding_calibration_continueCTA");
    setCalibration({
      heightCm: Math.round((ft * 12 + inch) * CM_PER_INCH),
      weightKg: Math.round(lb * KG_PER_LB),
      age: yrs,
      biologicalSex: sex,
    });
    navigation.navigate("Scan");
  };

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
              <Text style={styles.headline}>A few quick details</Text>
              <Text style={styles.subhead}>
                This calibrates your scan so the reading is accurate to your
                body.
              </Text>
            </View>

            <View style={styles.fields}>
              <Field label="Height">
                <View style={styles.heightRow}>
                  <View style={styles.unitInput}>
                    <TextInput
                      style={styles.input}
                      value={feet}
                      onChangeText={setFeet}
                      placeholder="5"
                      placeholderTextColor={MUTED}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                    <Text style={styles.unitLabel}>ft</Text>
                  </View>
                  <View style={styles.unitInput}>
                    <TextInput
                      style={styles.input}
                      value={inches}
                      onChangeText={setInches}
                      placeholder="9"
                      placeholderTextColor={MUTED}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.unitLabel}>in</Text>
                  </View>
                </View>
              </Field>

              <Field label="Weight">
                <View style={styles.unitInput}>
                  <TextInput
                    style={styles.input}
                    value={weightLb}
                    onChangeText={setWeightLb}
                    placeholder="150"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.unitLabel}>lbs</Text>
                </View>
              </Field>

              <Field label="Age">
                <View style={styles.unitInput}>
                  <TextInput
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

              <Field label="Biological sex">
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

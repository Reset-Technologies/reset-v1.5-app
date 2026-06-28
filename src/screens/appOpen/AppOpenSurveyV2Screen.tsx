import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { submitCheckIn } from "../../services/checkIn";
import { refreshDailyPlan, cacheDailyPlan } from "../../services/meals";
import { getProfile } from "../../services/profile";
import { useApp } from "../../context/AppContext";
import { SurveyHeader } from "../../components/survey/SurveyHeader";
import { ContinueButton } from "../../components/survey/ContinueButton";
import { FeelingSlider } from "../../components/survey/FeelingSlider";
import {
  MultipleChoiceList,
  MultipleChoiceOption,
} from "../../components/survey/MultipleChoiceList";
import { NumberStepper } from "../../components/survey/NumberStepper";
import type { AppOpenStackParamList } from "../../navigation/AppOpenNavigator";
import { logEvent, setCustomAttribute } from "../../services/braze";

const STRESS_OPTIONS: MultipleChoiceOption[] = [
  { id: "work", label: "Work" },
  { id: "sleep", label: "Sleep" },
  { id: "family", label: "Family" },
  { id: "health", label: "Health" },
  { id: "none", label: "None" },
];

const SLEEP_QUALITY_OPTIONS: MultipleChoiceOption[] = [
  { id: "poor", label: "Poor" },
  { id: "okay", label: "Okay" },
  { id: "good", label: "Good" },
  { id: "great", label: "Great" },
];

function sliderToEnergy(
  value: number,
): "low" | "off" | "steady" | "good" | "high" {
  if (value < 20) return "low";
  if (value < 40) return "off";
  if (value < 60) return "steady";
  if (value < 80) return "good";
  return "high";
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function AppOpenSurveyV2Screen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppOpenStackParamList>>();
  const insets = useSafeAreaInsets();
  const { state } = useApp();

  const [step, setStep] = useState(1);
  const [feeling, setFeeling] = useState(50);
  const [stress, setStress] = useState<string | null>(null);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logEvent("home_checkin");
  }, []);

  const exitToHome = () => {
    logEvent("home_checkin_skipCTA", { step });
    const parent = navigation.getParent();
    parent?.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Tabs" }] }),
    );
  };

  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((s) => s - 1);
  };

  const handleContinue = async () => {
    if (step === 1) {
      const energy = sliderToEnergy(feeling);
      logEvent("home_checkin_energySelectCTA", { energy });
      logEvent(`home_checkin_energy_${energy}`);
      setStep((s) => s + 1);
      return;
    }
    if (step === 2) {
      logEvent("home_checkin_stressSelectCTA", { stress: stress ?? "none" });
      if (stress) logEvent(`home_checkin_stress_${stress}`);
      setStep((s) => s + 1);
      return;
    }
    if (step === 3) {
      setStep((s) => s + 1);
      return;
    }

    if (sleepQuality) {
      logEvent("home_checkin_sleepSelectCTA", { quality: sleepQuality });
      logEvent(`home_checkin_sleep_quality_${sleepQuality}`);
    }

    setSubmitting(true);
    try {
      const stressTags = stress && stress !== "none" ? [stress] : [];
      await submitCheckIn({
        energy: sliderToEnergy(feeling),
        stressTags,
        sleepHours,
        sleepQuality: sleepQuality ?? undefined,
      });
      // Survey is fresh signal — rotate today's recipes so the user sees a
      // change when they land back on Home (RES-112). Fire-and-forget; we
      // don't want to block navigation on a meal-engine call.
      refreshDailyPlan()
        .then((plan) => cacheDailyPlan(plan))
        .catch(() => {});
    } catch {
      // Non-blocking: proceed to next screen regardless so the flow completes.
    } finally {
      setSubmitting(false);

      // Skip the "complete a face scan" nudge if the user already has a scan
      // today. In-session scans are reflected in state.biometrics; persisted
      // ones land on profile.layer3.latestScan.scannedAt. We check the
      // in-session value first since it's free, and only call getProfile if
      // we need to.
      let scannedToday = !!state.biometrics;
      if (!scannedToday) {
        try {
          const profile = await getProfile();
          scannedToday = isToday(profile?.layer3?.latestScan?.scannedAt);
        } catch {
          scannedToday = false;
        }
      }

      navigation.replace(scannedToday ? "ScoreReveal" : "EncourageScan");
    }
  };

  const canContinue = (() => {
    if (step === 1) return true;
    if (step === 2) return stress !== null;
    if (step === 3) return sleepHours >= 1 && sleepHours <= 14;
    if (step === 4) return sleepQuality !== null;
    return false;
  })();

  const title = (() => {
    if (step === 1) return "Tell me, how are you feeling today, overall?";
    if (step === 2) return "Any stress sources today?";
    if (step === 3) return "How many hours of sleep did you get last night?";
    return "How was the quality of your sleep?";
  })();

  const renderBody = () => {
    if (step === 1) return <FeelingSlider value={feeling} onChange={setFeeling} />;
    if (step === 2)
      return (
        <MultipleChoiceList
          options={STRESS_OPTIONS}
          selectedId={stress}
          onSelect={setStress}
        />
      );
    if (step === 3)
      return (
        <NumberStepper
          value={sleepHours}
          min={1}
          max={14}
          unitLabel="hours"
          onChange={setSleepHours}
        />
      );
    return (
      <MultipleChoiceList
        options={SLEEP_QUALITY_OPTIONS}
        selectedId={sleepQuality}
        onSelect={setSleepQuality}
      />
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" translucent />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurveyHeader
          step={step}
          totalSteps={4}
          title={title}
          canGoBack={step > 1}
          onBack={handleBack}
          onClose={exitToHome}
        />

        <View style={styles.body}>{renderBody()}</View>
      </ScrollView>

      <View style={[styles.footer, { bottom: insets.bottom + 16 }]}>
        <ContinueButton
          onPress={handleContinue}
          disabled={!canContinue || submitting}
          label={submitting ? "Saving…" : "Continue"}
        />
        {submitting ? (
          <ActivityIndicator
            size="small"
            color={K.brown}
            style={styles.savingSpinner}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: K.bone,
  },
  content: {
    paddingBottom: 120,
    gap: 30,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 24,
    paddingHorizontal: 34,
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    alignItems: "stretch",
  },
  savingSpinner: {
    marginTop: 8,
  },
});

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  EducationCarouselScreen,
  PreScanScreen,
  NoScanEmptyStateScreen,
  CalibrationScreen,
  ScanScreen,
  OnboardingSurveyScreen,
  TypeRevealScreen,
  ShareScreen,
  AccountScreen,
  AccountGateScreen,
  CreateAccountScreen,
  PaywallScreen,
} from "../screens/onboarding";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { K } from "../constants/colors";
import { useApp } from "../context/AppContext";

// New onboarding sequence (RES-119): education → pre-scan → scan →
// chat-style survey questions → account → type reveal → share.
//
// CameraPerm / Goal / Quiz / Taste / Restrict / ScanReveal still exist as
// screen files but are no longer in the active flow — the scan screen handles
// its own camera permission, and the question content has been folded into the
// config-driven OnboardingSurveyScreen.
export type OnboardingStackParamList = {
  Education: undefined;
  PreScan: undefined;
  NoScanEmptyState: undefined;
  Login: undefined;
  Calibration: undefined;
  Scan: undefined;
  Survey: { step?: number } | undefined;
  AccountGate: undefined;
  CreateAccount: undefined;
  TypeReveal: undefined;
  Paywall: undefined;
  Share: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// RES-123: screens the focus listener auto-caches as the resume point.
// Education is the "from zero" start (not cached); Scan is transient;
// CreateAccount is a form (AccountGate sits right before it).
const AUTO_CACHED_STEPS: (keyof OnboardingStackParamList)[] = [
  "PreScan",
  "NoScanEmptyState",
  "Calibration",
  "AccountGate",
  "TypeReveal",
  "Paywall",
  "Share",
];

// All valid resume targets. Survey is cached by OnboardingSurveyScreen
// itself (with a step index) once the scan is done, so reaching the
// survey means the scan + earlier answers are already persisted.
const RESUMABLE_ROUTES: (keyof OnboardingStackParamList)[] = [
  ...AUTO_CACHED_STEPS,
  "Survey",
];

function resumeRoute(
  cached: string | undefined,
): keyof OnboardingStackParamList {
  return cached && (RESUMABLE_ROUTES as string[]).includes(cached)
    ? (cached as keyof OnboardingStackParamList)
    : "Education";
}

export function OnboardingNavigator() {
  const { state, setOnboardingStep } = useApp();
  // initialRouteName / initialParams are read once on mount — by then
  // AppContext has rehydrated from storage, so the cached step is available.
  const initialRoute = resumeRoute(state.user.onboardingStep);
  const resumeSurveyStep = state.user.onboardingSurveyStep ?? 0;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenListeners={({ route }) => ({
        focus: () => {
          // Cache the furthest resumable checkpoint the user reaches.
          if ((AUTO_CACHED_STEPS as string[]).includes(route.name)) {
            setOnboardingStep(route.name);
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: K.cream },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="Education"
        component={EducationCarouselScreen}
        options={{ contentStyle: { backgroundColor: K.brown } }}
      />
      <Stack.Screen
        name="PreScan"
        component={PreScanScreen}
        options={{
          contentStyle: { backgroundColor: K.brown },
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: "none",
        }}
      />
      <Stack.Screen
        name="NoScanEmptyState"
        component={NoScanEmptyStateScreen}
        options={{
          contentStyle: { backgroundColor: K.white },
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ contentStyle: { backgroundColor: K.brown } }}
      />
      <Stack.Screen
        name="Calibration"
        component={CalibrationScreen}
        options={{ contentStyle: { backgroundColor: K.brown } }}
      />
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          animation: "fade",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Survey"
        component={OnboardingSurveyScreen}
        // RES-123: only takes effect when Survey is the resumed initial
        // route — every in-flow navigation to Survey passes an explicit
        // step param, which overrides this default.
        initialParams={{ step: resumeSurveyStep }}
        options={{
          contentStyle: { backgroundColor: K.brown },
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="AccountGate"
        component={AccountGateScreen}
        options={{
          contentStyle: { backgroundColor: K.brown },
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountScreen}
        options={{
          contentStyle: { backgroundColor: K.brown },
        }}
      />
      <Stack.Screen
        name="TypeReveal"
        component={TypeRevealScreen}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          contentStyle: { backgroundColor: K.brown },
          animation: "fade",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="Share" component={ShareScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
    </Stack.Navigator>
  );
}

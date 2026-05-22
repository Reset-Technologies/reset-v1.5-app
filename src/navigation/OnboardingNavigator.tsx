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

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Education"
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

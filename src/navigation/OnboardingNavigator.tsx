import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  OpeningScreen,
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
  AiConsentScreen,
  TypeReadyScreen,
  PaywallScreen,
  WelcomeBackScreen,
} from "../screens/onboarding";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { LinkAccountScreen } from "../screens/auth/LinkAccountScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ForgotPasswordCodeScreen } from "../screens/auth/ForgotPasswordCodeScreen";
import { ForgotPasswordResetScreen } from "../screens/auth/ForgotPasswordResetScreen";
import { K } from "../constants/colors";

// New onboarding sequence (RES-119): education → pre-scan → scan →
// chat-style survey questions → account → type reveal → share.
//
// CameraPerm / Goal / Quiz / Taste / Restrict / ScanReveal still exist as
// screen files but are no longer in the active flow — the scan screen handles
// its own camera permission, and the question content has been folded into the
// config-driven OnboardingSurveyScreen.
export type OnboardingStackParamList = {
  Opening: undefined;
  PreScan: undefined;
  NoScanEmptyState: undefined;
  Login: undefined;
  /** RES-207 — reached only from a successful legacy login. */
  WelcomeBack: undefined;
  ForgotPassword: undefined;
  ForgotPasswordCode: { email: string };
  ForgotPasswordReset: { email: string; resetToken: string };
  Calibration: undefined;
  Scan: undefined;
  Survey: { step?: number } | undefined;
  AccountGate: undefined;
  CreateAccount: undefined;
  /** Connect a second sign-in method to an account the member already owns. */
  LinkAccount: {
    email: string;
    authProvider: string[];
    hasPassword: boolean;
    provider: "apple" | "google";
    idToken: string;
    continueTo?: string;
  };
  AiConsent: undefined;
  /** "Your Type is ready." — Type hidden; the paywall comes next. */
  TypeReady: undefined;
  TypeReveal: undefined;
  Paywall: undefined;
  Share: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Opening"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: K.cream },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="Opening"
        component={OpeningScreen}
        options={{ contentStyle: { backgroundColor: K.brown } }}
      />
      <Stack.Screen
        name="PreScan"
        component={PreScanScreen}
        options={{
          contentStyle: { backgroundColor: K.brown },
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          // Was "none" because the carousel's fifth page rendered a PreScanView
          // "peek" and did the transition itself. Opening is a plain screen, so
          // PreScan takes the stack's normal push animation again.
          animation: "slide_from_right",
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
      {/* RES-207 — only a returning BetterWell member reaches this, straight
          from a successful legacy login. gestureEnabled:false so a back-swipe
          can't drop them onto the login screen they just cleared. */}
      <Stack.Screen
        name="WelcomeBack"
        component={WelcomeBackScreen}
        options={{
          contentStyle: { backgroundColor: K.cream },
          animation: "fade",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ contentStyle: { backgroundColor: K.brown } }}
      />
      <Stack.Screen
        name="ForgotPasswordCode"
        component={ForgotPasswordCodeScreen}
        options={{ contentStyle: { backgroundColor: K.brown } }}
      />
      <Stack.Screen
        name="ForgotPasswordReset"
        component={ForgotPasswordResetScreen}
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
          // 🔑 "none" ON PURPOSE — the crossfade is done IN THE SCREEN with
          // `Animated` (see `screenOpacity` in OnboardingSurveyScreen), not by
          // the native stack.
          //
          // 🔴 Why: `animation: "fade"` does not animate on Android in
          // react-native-screens 4.24.0. Measured at 30fps on an S24, content
          // leaving the screen:
          //     fade              16% -> 0%  in ONE 33ms frame
          //     fade_from_bottom  same, a cut
          //     slide_from_right  ramps over ~165ms
          // On iOS the native fade was correct — but a JS fade is the only way
          // to get the SAME motion on both, and this screen pushes a route per
          // question, so the cut repeated eight times and read as flashing.
          //
          // ⚠️ It was never a regression: the identical cut was measured on
          // e8daa35, before any of the V1 onboarding work, on the same device.
          // It only became visible once the flow was walked end to end on
          // Android rather than on the simulator.
          animation: "none",
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
        name="LinkAccount"
        component={LinkAccountScreen}
        options={{
          contentStyle: { backgroundColor: K.brown },
        }}
      />
      <Stack.Screen
        name="AiConsent"
        component={AiConsentScreen}
        options={{
          contentStyle: { backgroundColor: K.cream },
          animation: "fade",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="TypeReady"
        component={TypeReadyScreen}
        options={{ animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen
        name="TypeReveal"
        component={TypeRevealScreen}
        options={{
          animation: "fade",
          // The card stack uses its own left-swipe PanResponder to advance.
          // Leave the native back gesture on and a right-swipe pops TypeReveal,
          // revealing the (now stale) AccountGate sign-up screen underneath.
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
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

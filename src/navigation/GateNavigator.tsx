import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TypeRevealScreen, PaywallScreen } from "../screens/onboarding";
import { K } from "../constants/colors";

// Subscription gate for free users who have finished onboarding. RootNavigator
// renders this instead of MainNavigator whenever subscriptionTier !== "pro", so
// non-subscribers cannot reach the app. It re-runs the onboarding value teaser
// (the metabolic-type / score / deep-read reveal card stack) and ends on the
// Paywall, which here acts as a hard wall (no skip). Subscribing flips the tier
// to "pro", which re-renders RootNavigator straight into Main.
//
// Both screens are reused as-is from the onboarding flow: TypeRevealScreen reads
// its data from AppContext state (synced from getProfile on every launch) and
// already calls navigation.replace("Paywall") at the end of the stack, and
// PaywallScreen detects gate mode from state.user.hasCompletedOnboarding.
export type GateStackParamList = {
  TypeReveal: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<GateStackParamList>();

export function GateNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="TypeReveal"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <Stack.Screen
        name="TypeReveal"
        component={TypeRevealScreen}
        options={{ animation: "fade", fullScreenGestureEnabled: false }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ contentStyle: { backgroundColor: K.brown }, animation: "fade" }}
      />
    </Stack.Navigator>
  );
}

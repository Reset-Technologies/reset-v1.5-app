import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TypeReadyScreen, PaywallScreen } from "../screens/onboarding";
import { K } from "../constants/colors";

// Subscription gate for free users who have finished onboarding. RootNavigator
// renders this instead of MainNavigator whenever subscriptionTier !== "pro", so
// non-subscribers cannot reach the app.
//
// Returning unpaid members resume at Type ready with the Type still hidden,
// then the Paywall — Flow row 13 and the States tab, "no rescan, no repeat
// questions, no new Type". It no longer re-runs the reveal card stack, because
// the reveal is now what the paywall sells rather than something already given
// away (Bryan, 2026-09-29).
//
// After purchasing, a gate member gets the REVEAL ONLY and then Home (Bryan,
// 2026-09-29: "#2"). They have been through onboarding once, so replaying the
// Deep Read and meal cards would read as sitting through it again immediately
// after paying.
// 🔑 That reveal cannot render from this navigator: purchasing flips the tier
// to "pro", which re-renders RootNavigator out of Gate and into Main before it
// could mount. PaywallScreen deep-navigates to Main > TypeReveal
// { revealOnly: true } instead.
//
// PaywallScreen detects gate mode from state.user.hasCompletedOnboarding.
export type GateStackParamList = {
  TypeReady: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<GateStackParamList>();

export function GateNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="TypeReady"
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <Stack.Screen
        name="TypeReady"
        component={TypeReadyScreen}
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

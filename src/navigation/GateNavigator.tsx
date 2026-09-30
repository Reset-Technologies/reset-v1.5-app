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
// 🔴 OPEN: what a gate member sees AFTER purchasing. Subscribing flips the tier
// to "pro", which re-renders RootNavigator straight into Main — so today they
// would pay to see their Type and land on Home without ever seeing it. The
// Sheet says they should get the reveal ("no second gate"). Awaiting Bryan's
// call on how much of the tail they repeat; tracked in the handoff notes.
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

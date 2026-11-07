import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppOpenGreetingScreen } from "../screens/appOpen/AppOpenGreetingScreen";
import { DataGateScreen } from "../screens/appOpen/DataGateScreen";
import { NextMealScreen } from "../screens/appOpen/NextMealScreen";
import { AppOpenSurveyScreen } from "../screens/appOpen/AppOpenSurveyScreen";
import { AppOpenSurveyV2Screen } from "../screens/appOpen/AppOpenSurveyV2Screen";
import { EncourageScanScreen } from "../screens/appOpen/EncourageScanScreen";
import { ScoreRevealScreen } from "../screens/appOpen/ScoreRevealScreen";
import { logEvent } from "../services/braze";

export type AppOpenStackParamList = {
  Greeting: undefined;
  DataGate: { debugForceShow?: boolean } | undefined;
  Survey: undefined;
  SurveyV2: undefined;
  EncourageScan: undefined;
  ScoreReveal: undefined;
  NextMeal: { fromOnboarding?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<AppOpenStackParamList>();

export function AppOpenNavigator() {
  /**
   * The app-open flow appeared. Fires once per ENTRY into the flow.
   *
   * 🔑 Deliberately NOT guarded at module level, unlike `onboarding_started`
   * in OnboardingNavigator. There the navigator remounts within a single
   * launch for the same member (quit at the paywall, reopen inside
   * onboarding), so a module-level boolean keeps the totals readable. Here
   * every mount is a genuinely DISTINCT occurrence: `shouldShowAppOpenFlow` is
   * keyed per user per CALENDAR DAY, and RootNavigator re-checks it on every
   * AppState -> active, so a member who backgrounds overnight and comes back
   * gets a second, legitimate flow inside the same app launch. A
   * once-per-launch guard would silently swallow it.
   *
   * 🔴 This names the POSITION ("the flow opened"), not the Greeting screen,
   * so reordering this stack cannot move it. Same reasoning as 3.7.8's
   * onboarding anchor, which broke precisely because it had been named after a
   * screen that later got promoted to first.
   */
  React.useEffect(() => {
    logEvent("app_open_flow_started");
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Stack.Screen name="Greeting" component={AppOpenGreetingScreen} />
      <Stack.Screen name="DataGate" component={DataGateScreen} />
      <Stack.Screen name="Survey" component={AppOpenSurveyScreen} />
      <Stack.Screen name="SurveyV2" component={AppOpenSurveyV2Screen} />
      <Stack.Screen name="EncourageScan" component={EncourageScanScreen} />
      <Stack.Screen name="ScoreReveal" component={ScoreRevealScreen} />
      <Stack.Screen name="NextMeal" component={NextMealScreen} />
    </Stack.Navigator>
  );
}

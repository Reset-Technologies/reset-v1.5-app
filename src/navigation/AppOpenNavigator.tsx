import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppOpenGreetingScreen } from "../screens/appOpen/AppOpenGreetingScreen";
import { DataGateScreen } from "../screens/appOpen/DataGateScreen";
import { NextMealScreen } from "../screens/appOpen/NextMealScreen";
import { AppOpenSurveyScreen } from "../screens/appOpen/AppOpenSurveyScreen";
import { AppOpenSurveyV2Screen } from "../screens/appOpen/AppOpenSurveyV2Screen";
import { EncourageScanScreen } from "../screens/appOpen/EncourageScanScreen";
import { ScoreRevealScreen } from "../screens/appOpen/ScoreRevealScreen";

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

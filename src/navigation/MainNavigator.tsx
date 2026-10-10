import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen, HomeScreenV2 } from "../screens/home";
import { useApp } from "../context/AppContext";
import { AppOpenNavigator } from "./AppOpenNavigator";
import { ProfileScreen } from "../screens/profile";
import { EsterChatScreen } from "../screens/chat";
import { RecipeDetailScreen } from "../screens/recipe";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { ScanScreen } from "../screens/onboarding/ScanScreen";
import { CalibrationScreen } from "../screens/onboarding/CalibrationScreen";
import { TypeRevealScreen } from "../screens/onboarding/TypeRevealScreen";
// Preview-only. WelcomeBack's real home is OnboardingNavigator, which isn't
// mounted once someone is in the app — so Settings ▸ EXPERIMENTAL has no way to
// reach it. Registering it here as well gives that row a destination. Nothing
// else navigates to this route, and the row that does is gated behind
// shouldShowExperiments(), so the shipping build can't reach it.
import { WelcomeBackScreen } from "../screens/onboarding";
// Preview-only, same arrangement as WelcomeBack above. The weekly plan surface
// (`/api/meals/my-plan`) ships dark: the legacy `daily-plan` screens stay the
// live experience until a cutover is agreed, and Lang's design puts My Plan in
// a four-tab bar this app does not have. Reachable ONLY from
// Settings ▸ EXPERIMENTAL, which is gated by shouldShowExperiments().
import { MyPlanScreen } from "../screens/meals/MyPlanScreen";
import { ScanResultsScreen } from "../screens/scan/ScanResultsScreen";
import { ScanInsightsScreen } from "../screens/scan/ScanInsightsScreen";
import { ScanHistoryScreen } from "../screens/scan/ScanHistoryScreen";
import { SavedMealsScreen } from "../screens/favorites/SavedMealsScreen";
import { WeeklyReviewScreen } from "../screens/review/WeeklyReviewScreen";
import { WindowProgressScreen } from "../screens/window/WindowProgressScreen";
import { TabBar } from "../components";
import type { Meal } from "../components";

// Tab navigator param list
export type MainTabParamList = {
  Home: undefined;
  Profile: undefined;
};

// Stack navigator param list (wraps tabs + modals)
export type MainStackParamList = {
  Tabs: undefined;
  AppOpenFlow: undefined;
  // Preview-only route for Settings ▸ EXPERIMENTAL; see the import comment.
  WelcomeBackPreview: undefined;
  EsterChat: {
    context?: "general" | "meal" | "score";
    meal?: Meal;
    // RES-145: opens the chat with a context-specific Ester greeting about a
    // profile metric (e.g. the user's strength/weakness/goal/signal).
    topic?: {
      kind:
        | "stress"
        | "energy"
        | "recovery"
        | "confidence"
        | "strength"
        | "weakness"
        | "goal";
      label?: string | null;
    };
  };
  RecipeDetail: {
    meal: Meal;
    siblings?: Meal[];
  };
  SavedMeals: undefined;
  /** 🔴 Preview-only — see the import comment. Not reachable in a store build. */
  MyPlan: undefined;
  WeeklyReview: undefined;
  WindowProgress: undefined;
  Settings: undefined;
  // Weight-entry step shown before every re-scan (weight-only; reuses stored
  // height/age). Forwards its params on to Scan.
  Calibration:
    | { mode?: "rescan"; returnTo?: "ScanResults" | "ScoreReveal" }
    | undefined;
  /**
   * Reveal-only, for a member who just purchased from the subscription gate.
   * Their tier flips to "pro" on purchase, which re-renders RootNavigator into
   * Main — so the reveal they paid for has to live here, not in GateNavigator,
   * which is already unmounting by then.
   */
  TypeReveal: { revealOnly?: boolean } | undefined;
  Scan: {
    mode: "rescan";
    returnTo?: "ScanResults" | "ScoreReveal";
    // Which control started the scan — carried onto every scan event so
    // re-scans are attributable to an entry point. Kept in sync with ScanEntry
    // in screens/onboarding/ScanScreen.tsx (minus "onboarding", which never
    // routes through this stack).
    entry?:
      | "home"
      | "profile"
      | "weekly_review"
      | "scan_insights"
      | "score_reveal"
      | "app_open_encourage"
      | "app_open_data_gate";
  };
  ScanResults: undefined;
  ScanInsights: { fromAppOpen?: boolean } | undefined;
  ScanHistory: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function HomeRoute() {
  const { state } = useApp();
  return state.settings.homeV2Enabled ? <HomeScreenV2 /> : <HomeScreen />;
}

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: "transparent" }} />
        ),
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeRoute}
        options={{
          tabBarLabel: "Home",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="AppOpenFlow"
        component={AppOpenNavigator}
        options={{
          presentation: "fullScreenModal",
          animation: "fade",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="EsterChat"
        component={EsterChatScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="SavedMeals"
        component={SavedMealsScreen}
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="MyPlan"
        component={MyPlanScreen}
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="WeeklyReview"
        component={WeeklyReviewScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="WindowProgress"
        component={WindowProgressScreen}
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="TypeReveal"
        component={TypeRevealScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "fade",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Calibration"
        component={CalibrationScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          gestureEnabled: false,
        }}
      />
      {/* Preview only — see the import comment. gestureEnabled stays ON here
          (unlike the real onboarding mount) so it can be swiped away; its
          Continue button leads into Calibration, which is registered above. */}
      <Stack.Screen
        name="WelcomeBackPreview"
        // Cast because the screen types its props against its real route name
        // ("WelcomeBack") and this preview mount uses a different one. Casting
        // here keeps the change contained to the preview — the screen itself is
        // untouched, so what renders is exactly what onboarding renders.
        component={WelcomeBackScreen as React.ComponentType<any>}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="ScanResults"
        component={ScanResultsScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="ScanInsights"
        component={ScanInsightsScreen}
      />
      <Stack.Screen name="ScanHistory" component={ScanHistoryScreen} />
    </Stack.Navigator>
  );
}

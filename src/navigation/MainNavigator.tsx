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
import { GroceryListScreen } from "../screens/meals/GroceryListScreen";
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
    /**
     * Plan context, present ONLY when the recipe was opened from My Plan.
     *
     * 🔑 Servings belongs to a PLANNED MEAL, not to a recipe. Opening the same
     * recipe from Home, Saved Meals or Ester chat has nothing to save a
     * serving size to, so the control stays display-only there. This is the
     * difference, carried explicitly rather than guessed at.
     */
    plannedMeal?: {
      /** `planned_meal.id` — the row whose servings change. */
      id: string;
      /** Required by the endpoint; the server proves ownership through it. */
      mealPlanId: string;
      /** The multiplier already saved, so the control opens where it left off. */
      servings: number;
    };
  };
  SavedMeals: undefined;
  /** 🔴 Preview-only — see the import comment. Not reachable in a store build. */
  MyPlan: undefined;
  GroceryList: undefined;
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
      {/* 🔴 NOT a modal. Lang's Recipe Details frame (Figma 5046:43237) draws
          the status bar at inset top 0 and runs the hero image full-bleed from
          the very top, with a BACK ARROW in the header — a pushed screen, not a
          sheet. As `presentation: "modal"` it rendered as an iOS card and left
          the screen underneath peeking out above it. */}
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{
          animation: "slide_from_right",
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
        name="GroceryList"
        component={GroceryListScreen}
      />
      {/* In Lang's frame (Figma 5039:29721) My Plan is the **Meals tab** — the
          bottom tab bar is visible with "Meals" selected — so it carries no
          presentation of its own. It is a plain push until that tab exists. */}
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
      {/* 🔴🔴 NOT a modal, and this is NOT only about Settings' own looks.
          On iOS a screen pushed AFTER a modal stays inside that modal's card,
          so every screen reachable from here inherited the inset and left the
          page underneath peeking out above it — Settings -> My Plan ->
          Grocery List / Recipe Details, all of them. Fixing the screens one at
          a time was whack-a-mole; the presentation here is the cause. */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          animation: "slide_from_right",
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

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
// My Plan is the MEALS TAB. Bryan, 2026-10-15, asked where a member is meant to
// enter Meals (his handoff says "member enters Meals" and never says from
// where): "Let's add Meals to the current tab bar now. The full nav is still
// unsettled, especially Ester's role. No reason to hold Meals for that ... we
// can move to the new nav once Progress, Account, and the Ester decision are
// ready." So Meals joins Home and Profile here rather than waiting on Lang's
// four-tab bar, and the Settings ▸ EXPERIMENTAL preview row is gone with it.
// 🔑 Main is mounted only for `subscriptionTier === "pro"` (RootNavigator), so
// the tab is paid-only without a gate of its own — MY PLAN r4, "Paid member
// enters Meals".
import { MyPlanScreen } from "../screens/meals/MyPlanScreen";
import { ExploreScreen } from "../screens/meals/ExploreScreen";
import { GroceryListScreen } from "../screens/meals/GroceryListScreen";
import { ScanResultsScreen } from "../screens/scan/ScanResultsScreen";
import { ScanInsightsScreen } from "../screens/scan/ScanInsightsScreen";
import { ScanHistoryScreen } from "../screens/scan/ScanHistoryScreen";
import { SavedMealsScreen } from "../screens/favorites/SavedMealsScreen";
import { WeeklyReviewScreen } from "../screens/review/WeeklyReviewScreen";
import { WindowProgressScreen } from "../screens/window/WindowProgressScreen";
import { TabBar } from "../components";
import type { Meal } from "../components";
import type { RecipeViewSurface } from "../services/meals";

// Tab navigator param list
export type MainTabParamList = {
  Home: undefined;
  /** My Plan — the weekly plan surface is this tab's root. */
  Meals: undefined;
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
    /**
     * Which surface opened this screen, for `recipe_viewed`'s `source_surface`
     * (EVENTS r15).
     *
     * 🔑 Only the navigator knows this — the server sees one `GET /meals/:id`
     * and cannot tell Home from Saved Meals. Optional so a missed call site
     * degrades to a view with an unknown surface rather than no view at all.
     */
    sourceSurface?: RecipeViewSurface;
  };
  Explore: undefined;
  SavedMeals: undefined;
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
      {/* Lang's frame (Figma 5039:29721) draws My Plan with the tab bar visible
          and "Meals" selected — this is that tab, in the bar we actually ship.
          Grocery List and Recipe Details are pushed onto the stack ABOVE the
          tabs from here, so the bar hides while they are open. */}
      <Tab.Screen
        name="Meals"
        component={MyPlanScreen}
        options={{
          tabBarLabel: "Meals",
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
        name="Explore"
        component={ExploreScreen}
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
      {/* 🔴🔴 `fullScreenModal`, NEVER plain `modal`. Settings slides up, which
          is what it has always done and what Cole asked for back — but on iOS a
          screen pushed AFTER a `modal` stays inside that modal's CARD, so every
          screen reachable from here inherited the inset and left the page
          underneath peeking out above it. Fixing those screens one at a time
          was whack-a-mole; the presentation here was the cause.
          `fullScreenModal` keeps the upward slide and covers the whole screen,
          so nothing pushed above it is inset. */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: "fullScreenModal",
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

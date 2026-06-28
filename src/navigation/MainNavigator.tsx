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
import { YapCallScreen } from "../screens/yap/YapCallScreen";
import { ScanScreen } from "../screens/onboarding/ScanScreen";
import { ScanResultsScreen } from "../screens/scan/ScanResultsScreen";
import { ScanInsightsScreen } from "../screens/scan/ScanInsightsScreen";
import { ScanHistoryScreen } from "../screens/scan/ScanHistoryScreen";
import { SavedMealsScreen } from "../screens/favorites/SavedMealsScreen";
import { WeeklyReviewScreen } from "../screens/review/WeeklyReviewScreen";
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
  WeeklyReview: undefined;
  Settings: undefined;
  YapCall: {
    yapSessionId: string;
  };
  Scan: {
    mode: "rescan";
    returnTo?: "ScanResults" | "ScoreReveal";
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
        name="WeeklyReview"
        component={WeeklyReviewScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
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
        name="YapCall"
        component={YapCallScreen}
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

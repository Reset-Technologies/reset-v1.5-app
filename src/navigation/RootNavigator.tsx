import React, { useEffect } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { AppState, AppStateStatus } from "react-native";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { MainNavigator } from "./MainNavigator";
import { GateNavigator } from "./GateNavigator";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { useApp } from "../context/AppContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { K } from "../constants/colors";
import {
  shouldShowAppOpenFlow,
  markAppOpenFlowShown,
} from "../utils/appOpenFlowGate";
import { rootNavigationRef } from "./rootNavigationRef";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Gate: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "resetapp://"],
  config: {
    screens: {
      Main: {
        screens: {
          Tabs: {
            screens: {
              Home: "home",
            },
          },
          WeeklyReview: "weekly-review",
        },
      },
    },
  },
};

const DEEP_LINK_ROUTES: Record<string, string> = {
  "weekly-review": "WeeklyReview",
};

export function RootNavigator() {
  const { state } = useApp();
  // Shared module-level ref so the Paywall (and other screens that may be
  // about to unmount during a root-stack switch) can deep-navigate after
  // the new stack mounts.
  const navigationRef = rootNavigationRef;

  const appOpenFlowEnabled = state.settings.appOpenFlowEnabled;
  const userId = state.auth.authUser?.id;
  // Pro gates the whole app: free users get GateNavigator instead of Main.
  const isPro = state.user.subscriptionTier === "pro";
  // Only pro users reach Main, so only they should trigger the daily app-open
  // flow (which navigates into the Main stack).
  const authReady =
    state.auth.isAuthenticated &&
    state.user.hasCompletedOnboarding &&
    !!userId &&
    isPro;

  // Listen for deep links while app is already open (e.g. push tap while foregrounded)
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const path = url.replace(/^resetapp:\/\//, "").replace(/^.*:\/\//, "");
      const route = DEEP_LINK_ROUTES[path];
      if (route && navigationRef.current) {
        (navigationRef.current as any).navigate(route);
      }
    });
    return () => sub.remove();
  }, []);

  // App-open flow trigger: first time today the app becomes active
  useEffect(() => {
    if (!appOpenFlowEnabled || !authReady || !userId) return;

    const maybeShowFlow = async () => {
      const shouldShow = await shouldShowAppOpenFlow(userId);
      if (!shouldShow || !navigationRef.current) return;
      await markAppOpenFlowShown(userId);
      (navigationRef.current as any).navigate("Main", {
        screen: "AppOpenFlow",
      });
    };

    maybeShowFlow();

    const sub = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => {
        if (status === "active") maybeShowFlow();
      },
    );
    return () => sub.remove();
  }, [appOpenFlowEnabled, authReady, userId]);

  // Show loading screen while checking auth state
  if (state.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={K.maroon} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={{
        ...DefaultTheme,
        colors: { ...DefaultTheme.colors, background: "transparent" },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!state.user.hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : !state.auth.isAuthenticated ? (
          <Stack.Screen name="Auth" component={LoginScreen} />
        ) : !isPro ? (
          // Subscription gate: free users can't reach Main. Subscribing flips
          // the tier to "pro" and this re-renders straight into Main.
          <Stack.Screen name="Gate" component={GateNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: K.cream,
  },
});

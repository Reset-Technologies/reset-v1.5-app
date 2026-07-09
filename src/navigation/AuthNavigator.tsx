import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ForgotPasswordCodeScreen } from "../screens/auth/ForgotPasswordCodeScreen";
import { ForgotPasswordResetScreen } from "../screens/auth/ForgotPasswordResetScreen";

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ForgotPasswordCode: { email: string };
  ForgotPasswordReset: { email: string; resetToken: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// The signed-out stack: the login screen plus the password-reset flow. Used
// as the root "Auth" route (session-expired / logged-out entry). The same
// reset screens are also registered in OnboardingNavigator, where the login
// screen is reachable via "I already have an account".
export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#361416" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen
        name="ForgotPasswordCode"
        component={ForgotPasswordCodeScreen}
      />
      <Stack.Screen
        name="ForgotPasswordReset"
        component={ForgotPasswordResetScreen}
      />
    </Stack.Navigator>
  );
}

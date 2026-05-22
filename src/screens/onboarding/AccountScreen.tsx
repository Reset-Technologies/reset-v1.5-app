import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import { K } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { EsterBubble, Button } from "../../components";
import { useApp } from "../../context/AppContext";
import { registerWithEmail, loginWithApple, loginWithGoogle } from "../../services/auth";
import { syncOnboardingToBackend } from "../../services/onboarding";
import { submitScanResults } from "../../services/profile";
import { logEvent } from "../../services/braze";

import Constants from "expo-constants";

// Google Sign-In is Android-only; importing on iOS crashes in Expo Go
const GoogleSignin =
  Platform.OS === "android"
    ? require("@react-native-google-signin/google-signin").GoogleSignin
    : null;

if (GoogleSignin) {
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
  });
}

type Props = NativeStackScreenProps<any, "Account">;

export function AccountScreen({ navigation }: Props) {
  const { state, setUserAccount, setAuth, completeOnboarding } = useApp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");

  React.useEffect(() => {
    logEvent("onboarding_account");
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const isValid = email.includes("@") && password.length >= 8;

  // After the account is created: scanned users get the type reveal (the
  // payoff is gated behind making an account, per RES-119); declined-scan
  // users skip it ("skip scan = skip the entire type reveal") and go
  // straight to the app.
  const finishAccount = () => {
    if (state.biometrics) {
      navigation.navigate("TypeReveal");
    } else {
      completeOnboarding();
    }
  };

  const handleCreateAccount = async () => {
    logEvent("onboarding_account_saveProfileCTA");
    setError(null);
    setIsLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const user = await registerWithEmail(
        email,
        password,
        timezone,
        firstName.trim() || undefined,
        lastName.trim() || undefined,
      );
      setUserAccount(user.email ?? email, user.firstName ?? (firstName.trim() || undefined));
      setAuth(user);

      // Push onboarding data to backend profile
      try {
        await syncOnboardingToBackend({
          goal: state.user.goal,
          behaviorAnswers: {
            q1: state.user.quizAnswers.q1,
            q2: state.user.quizAnswers.q2,
            q3: state.user.quizAnswers.q3,
          },
          tastePreferences: state.user.tastePreferences,
          dietaryRestrictions: state.user.dietaryRestrictions,
        });
      } catch {
        // Non-blocking: onboarding completes even if sync fails
      }

      // Submit queued scan data if user completed a scan during onboarding
      if (state.biometrics?.raw) {
        try {
          await submitScanResults(state.biometrics.raw);
        } catch {
          // Non-blocking: scan upload can be retried later
        }
      }

      finishAccount();
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    logEvent("onboarding_account_appleSignInCTA");
    setError(null);
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("No identity token from Apple");
      }

      const user = await loginWithApple(credential.identityToken);
      setUserAccount(
        user.email ?? "apple-user",
        user.firstName ?? credential.fullName?.givenName ?? undefined,
      );
      setAuth(user);

      // Push onboarding data to backend profile
      try {
        await syncOnboardingToBackend({
          goal: state.user.goal,
          behaviorAnswers: {
            q1: state.user.quizAnswers.q1,
            q2: state.user.quizAnswers.q2,
            q3: state.user.quizAnswers.q3,
          },
          tastePreferences: state.user.tastePreferences,
          dietaryRestrictions: state.user.dietaryRestrictions,
        });
      } catch {
        // Non-blocking: onboarding completes even if sync fails
      }

      // Submit queued scan data if user completed a scan during onboarding
      if (state.biometrics?.raw) {
        try {
          await submitScanResults(state.biometrics.raw);
        } catch {
          // Non-blocking: scan upload can be retried later
        }
      }

      finishAccount();
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") return;
      setError(err.message || "Apple sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        throw new Error("No ID token from Google");
      }

      const user = await loginWithGoogle(idToken);
      setUserAccount(
        user.email ?? "google-user",
        user.firstName ?? undefined,
      );
      setAuth(user);

      // Push onboarding data to backend profile
      try {
        await syncOnboardingToBackend({
          goal: state.user.goal,
          behaviorAnswers: {
            q1: state.user.quizAnswers.q1,
            q2: state.user.quizAnswers.q2,
            q3: state.user.quizAnswers.q3,
          },
          tastePreferences: state.user.tastePreferences,
          dietaryRestrictions: state.user.dietaryRestrictions,
        });
      } catch {
        // Non-blocking
      }

      // Submit queued scan data
      if (state.biometrics?.raw) {
        try {
          await submitScanResults(state.biometrics.raw);
        } catch {
          // Non-blocking
        }
      }

      finishAccount();
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED") return;
      setError(err.message || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    logEvent("onboarding_account_skipCTA");
    completeOnboarding();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <EsterBubble message="Save your profile so I don't lose what I just learned." />

          <View style={styles.form}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.nameRow}>
              <View style={[styles.inputGroup, styles.nameField]}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First"
                  placeholderTextColor={K.faded}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              <View style={[styles.inputGroup, styles.nameField]}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last"
                  placeholderTextColor={K.faded}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={K.faded}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 8 chars, uppercase, number, symbol"
                placeholderTextColor={K.faded}
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <Button
              title={isLoading ? "Creating account..." : "Save profile"}
              onPress={handleCreateAccount}
              disabled={!isValid || isLoading}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {appleAvailable && (
              <TouchableOpacity
                style={[styles.appleButton, isLoading && styles.appleButtonDisabled]}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={K.white} />
                ) : (
                  <>
                    <Text style={styles.appleIcon}></Text>
                    <Text style={styles.appleText}>Sign in with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {Platform.OS === "android" && (
              <TouchableOpacity
                style={[styles.googleButton, isLoading && styles.googleButtonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={K.text} />
                ) : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleText}>Sign in with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isLoading}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.cream,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 80,
  },
  form: {
    marginTop: 28,
    gap: 16,
  },
  errorContainer: {
    backgroundColor: "#FDF2F2",
    borderWidth: 1,
    borderColor: K.err,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    ...typography.bodySmall,
    color: K.err,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    ...typography.label,
    color: K.sub,
  },
  input: {
    backgroundColor: K.white,
    borderWidth: 1,
    borderColor: K.border,
    borderRadius: 12,
    padding: 16,
    ...typography.body,
    color: K.text,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: K.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: K.faded,
    marginHorizontal: 16,
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.warmBlack,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  appleButtonDisabled: {
    opacity: 0.6,
  },
  appleIcon: {
    color: K.white,
    fontSize: 20,
  },
  appleText: {
    ...typography.button,
    color: K.white,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: K.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: K.border,
    gap: 8,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4285F4",
  },
  googleText: {
    ...typography.button,
    color: K.text,
  },
  bottom: {
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: K.faded,
  },
});

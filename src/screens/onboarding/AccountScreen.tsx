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
  Animated,
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

/**
 * Password rules, stated once and checked live.
 *
 * 🔴 These used to live ONLY in the field's placeholder, which disappears on
 * the first keystroke — so by the time a password could be wrong, the rules
 * were gone. Worse, the gate was `password.length >= 8` while the placeholder
 * promised uppercase/number/symbol, so the button could sit disabled with the
 * requirements invisible and nothing explaining why. That is the whole of the
 * "hard to tell why it failed" report.
 *
 * Matches the strength the backend enforces on the password RESET flow
 * (`IsStrongPassword`, min 8 + lower + upper + number + symbol). Registration
 * itself enforces nothing server-side, so this is currently the ONLY gate —
 * see the note in handleCreateAccount.
 */
const PASSWORD_RULES: { key: string; label: string; test: (v: string) => boolean }[] = [
  { key: "length", label: "At least 8 characters", test: (v) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { key: "number", label: "One number", test: (v) => /[0-9]/.test(v) },
  { key: "symbol", label: "One symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

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

  const failedRules = PASSWORD_RULES.filter((r) => !r.test(password));
  const passwordOk = failedRules.length === 0;
  const emailOk = email.includes("@");

  // Whether to render the rules in the error colour. Only after a failed
  // attempt — reddening rules a user has not had a chance to satisfy yet reads
  // as being told off for typing.
  const [showPasswordError, setShowPasswordError] = useState(false);
  const shake = React.useRef(new Animated.Value(0)).current;

  const flagPassword = () => {
    setShowPasswordError(true);
    shake.setValue(0);
    Animated.sequence(
      [1, -1, 1, 0].map((toValue) =>
        Animated.timing(shake, {
          toValue,
          duration: 60,
          useNativeDriver: true,
        }),
      ),
    ).start();
  };

  // Clear the red as soon as the password becomes valid, so the correction is
  // acknowledged the moment it lands rather than on the next submit.
  React.useEffect(() => {
    if (passwordOk) setShowPasswordError(false);
  }, [passwordOk]);

  // 🔑 The button stays pressable while the password is invalid. A disabled
  // button is exactly what made this undiagnosable — it gives no reason. Press
  // now runs the check and shows one.
  const canSubmit = emailOk && password.length > 0;

  // After the account is created: scanned users get the type reveal (the
  // payoff is gated behind making an account, per RES-119); declined-scan
  // users skip it ("skip scan = skip the entire type reveal") and go
  // straight to the app.
  const finishAccount = () => {
    if (state.biometrics) {
      // reset (not navigate) so the now-stale account screens leave the stack —
      // a signed-up user must never be able to land back on a sign-up screen.
      // RES-188: third-party-AI consent sits between account creation and reveal.
      navigation.reset({ index: 0, routes: [{ name: "AiConsent" }] });
    } else {
      completeOnboarding();
    }
  };

  const handleCreateAccount = async () => {
    logEvent("onboarding_account_saveProfileCTA");
    setError(null);

    // ⚠️ Client-side only. The register endpoint's DTO carries just @IsString()
    // and there is no global ValidationPipe (RES-213), so the server accepts
    // whatever it is sent — this check is the only thing standing between a
    // weak password and a real account. Worth closing server-side.
    if (!passwordOk) {
      flagPassword();
      // Which rules people actually trip, so the copy can be fixed rather than
      // guessed at. Rule keys only — never the password itself.
      logEvent("onboarding_account_passwordRejected", {
        failed: failedRules.map((r) => r.key).join(","),
      });
      return;
    }

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
    if (isLoading) return;
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
                style={[
                  styles.input,
                  showPasswordError && styles.inputError,
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor={K.faded}
                secureTextEntry
                editable={!isLoading}
              />

              {/* The rules live here, not in the placeholder, so they survive
                  the first keystroke and are readable while the password is
                  being fixed. */}
              <Animated.View
                style={{
                  transform: [
                    {
                      translateX: shake.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-6, 6],
                      }),
                    },
                  ],
                }}
                accessibilityLiveRegion={
                  showPasswordError ? "assertive" : "none"
                }
              >
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <View key={rule.key} style={styles.ruleRow}>
                      <Text
                        style={[
                          styles.ruleMark,
                          met && styles.ruleMarkMet,
                          !met && showPasswordError && styles.ruleTextFailed,
                        ]}
                      >
                        {met ? "✓" : "•"}
                      </Text>
                      <Text
                        style={[
                          styles.ruleText,
                          met && styles.ruleTextMet,
                          !met && showPasswordError && styles.ruleTextFailed,
                        ]}
                      >
                        {rule.label}
                      </Text>
                    </View>
                  );
                })}
              </Animated.View>
            </View>

            <Button
              title={isLoading ? "Creating account..." : "Save profile"}
              onPress={handleCreateAccount}
              disabled={!canSubmit || isLoading}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={styles.appleNativeBtn}
                onPress={handleAppleSignIn}
              />
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

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={K.white} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.cream,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
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
  inputError: {
    borderColor: K.err,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  ruleMark: {
    ...typography.bodySmall,
    color: K.faded,
    width: 12,
    textAlign: "center",
  },
  ruleMarkMet: {
    color: K.text,
  },
  ruleText: {
    ...typography.bodySmall,
    color: K.sub,
  },
  ruleTextMet: {
    color: K.text,
  },
  ruleTextFailed: {
    color: K.err,
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
  appleNativeBtn: {
    width: "100%",
    height: 54,
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

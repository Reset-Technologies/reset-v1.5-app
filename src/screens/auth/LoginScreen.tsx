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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as AppleAuthentication from "expo-apple-authentication";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { loginWithEmail, loginWithApple, loginWithGoogle } from "../../services/auth";
import { logEvent } from "../../services/braze";
import {
  BackArrow,
  ResetWordmark,
  EyeIcon,
  BG_LOGO,
  MAROON,
  BONE,
  WHITE,
  TEXT_ALT,
  GHOST,
} from "./authUi";

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

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setAuth, resetState, completeOnboarding } = useApp();

  // Signing into an existing account means the user has onboarded before —
  // mark onboarding complete so the root navigator can route to Main even
  // when this screen is reached mid-onboarding ("I already have an
  // account"). Harmless in the session-expired entry point (already done).
  const finishLogin = (user: Parameters<typeof setAuth>[0]) => {
    completeOnboarding();
    setAuth(user);
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios");

  React.useEffect(() => {
    logEvent("auth_login");
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const isValid = email.includes("@") && password.length >= 1;

  const handleLogin = async () => {
    logEvent("auth_login_signInCTA");
    setError(null);
    setIsLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      finishLogin(user);
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (isLoading) return;
    logEvent("auth_login_appleSignInCTA");
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
      finishLogin(user);
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
      finishLogin(user);
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED") return;
      setError(err.message || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      // Onboarding entry point ("I already have an account" on PreScan) —
      // return the user to the PreScan screen.
      navigation.navigate("PreScan");
    } else {
      // No history (session-expired entry point, where PreScan doesn't
      // exist) — fall back to a clean reset so the user isn't stranded.
      resetState();
    }
  };

  const handleForgotPassword = () => {
    logEvent("auth_login_forgotPasswordCTA");
    navigation.navigate("ForgotPassword");
  };

  return (
    <View style={styles.root}>
      {/* Faded brand logo — bottom-left, rotated, behind everything. */}
      <Image source={BG_LOGO} style={styles.bgLogo} resizeMode="contain" />
      {/* Bottom darken gradient. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="loginBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.44" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.82" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#loginBg)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleBack} hitSlop={10} style={styles.iconBtn}>
              <BackArrow />
            </TouchableOpacity>
            <ResetWordmark />
            <View style={styles.iconBtn} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.heading}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign back into your account</Text>
            </View>

            <View style={styles.form}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.fields}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={TEXT_ALT}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  editable={!isLoading}
                />

                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={TEXT_ALT}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                  >
                    <EyeIcon off={!showPassword} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.loginGroup}>
                <TouchableOpacity
                  style={[styles.loginBtn, (!isValid || isLoading) && styles.loginBtnDisabled]}
                  onPress={handleLogin}
                  disabled={!isValid || isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={MAROON} />
                  ) : (
                    <Text style={styles.loginBtnText}>Log in</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} hitSlop={8}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.altSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                  }
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={4}
                  style={styles.appleNativeBtn}
                  onPress={handleAppleSignIn}
                />
              )}

              {Platform.OS === "android" && (
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ghostBtnText}>Continue with Google</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={WHITE} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },
  keyboardView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },

  // Faded background logo
  bgLogo: {
    position: "absolute",
    width: 460,
    height: 580,
    left: -120,
    bottom: -120,
    opacity: 0.12,
    transform: [{ rotate: "-17deg" }],
    pointerEvents: "none",
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  // Content
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 60,
  },
  heading: { gap: 8 },
  title: {
    fontFamily: fonts.dmSans,
    fontSize: 40,
    lineHeight: 44,
    color: BONE,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    lineHeight: 26,
    color: TEXT_ALT,
    letterSpacing: -0.2,
  },

  // Form
  form: { gap: 30 },
  errorText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: "#FF8A8A",
  },
  fields: { gap: 16 },
  input: {
    borderWidth: 0.5,
    borderColor: BONE,
    borderBottomRightRadius: 21,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.16,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: BONE,
    borderBottomRightRadius: 21,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.16,
  },

  // Log in
  loginGroup: { gap: 8, alignItems: "center" },
  loginBtn: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
  forgotText: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: WHITE,
  },

  // Alt sign-in
  altSection: { gap: 16, alignItems: "center" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: GHOST },
  dividerText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: WHITE,
    letterSpacing: -0.14,
  },
  appleNativeBtn: {
    width: "100%",
    height: 56,
  },
  ghostBtn: {
    width: "100%",
    backgroundColor: GHOST,
    borderRadius: 4,
    minHeight: 56,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: WHITE,
    letterSpacing: -0.2,
  },
});

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { useApp } from "../../context/AppContext";
import { registerWithEmail } from "../../services/auth";
import { syncOnboardingToBackend } from "../../services/onboarding";
import { submitScanResults } from "../../services/profile";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "CreateAccount">;

const MAROON = "#361416";
const BONE = "#F3EFE3";
const WHITE = "#FAFDFE";
const TEXT_ALT = "#B0A3A4";

const ESTER_AVATAR = require("../../../assets/images/ester-avatar-silver.png");

function VisibilityIcon({ off, size = 24 }: { off: boolean; size?: number }) {
  if (off) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2 4l20 20M9.88 9.88a3 3 0 0 0 4.24 4.24M10.73 5.08A10.4 10.4 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 0 1-2.41 3.7M6.61 6.61C4.27 7.94 2.57 9.96 2 12.5 3.73 16.89 8 20 12 20a10.4 10.4 0 0 0 4-.79"
          stroke={TEXT_ALT}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12.5C3.73 8.11 8 5 12 5s8.27 3.11 10 7.5C20.27 16.89 16 20 12 20S3.73 16.89 2 12.5z"
        stroke={TEXT_ALT}
        strokeWidth="1.6"
      />
      <Path
        d="M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        stroke={TEXT_ALT}
        strokeWidth="1.6"
      />
    </Svg>
  );
}

export function CreateAccountScreen({ navigation }: Props) {
  const { state, setUserAccount, setAuth, setTypingResult, completeOnboarding } = useApp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-advance focus (RES-136): "next" on the keyboard tabs to the
  // following field; the last field submits.
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Password rules: min 8, uppercase, number, symbol
  const passwordOk =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes("@") &&
    passwordOk;

  const finishAccount = () => {
    // RES-119: the 3-card reveal flow is now part of every onboarding, not
    // gated on a real scan — TypeRevealScreen falls back to a placeholder
    // score when biometrics are missing.
    //
    // reset (not navigate) so the now-stale account screens leave the stack —
    // a signed-up user must never be able to land back on a sign-up screen.
    // RES-188: the third-party-AI consent screen sits between account creation
    // and the type reveal (the first call that would hit OpenAI).
    navigation.reset({ index: 0, routes: [{ name: "AiConsent" }] });
  };

  const handleSubmit = async () => {
    if (!isValid || isLoading) return;
    logEvent("onboarding_create_account_submitCTA");
    setError(null);
    setIsLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const user = await registerWithEmail(
        email,
        password,
        timezone,
        firstName.trim() || undefined,
        lastName.trim() || undefined
      );
      setUserAccount(
        user.email ?? email,
        user.firstName ?? (firstName.trim() || undefined)
      );
      setAuth(user);

      // RES-121: submit scan results FIRST so the backend has biomarkers
      // when the typing function runs on the behaviorAnswers below.
      if (state.biometrics?.raw) {
        try {
          await submitScanResults(state.biometrics.raw);
        } catch {}
      }

      try {
        const { primaryBucket, startingRead, glp1Flag } =
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
        if (primaryBucket) {
          setTypingResult({
            metabolicType: primaryBucket,
            startingRead,
            glp1Flag,
          });
        }
      } catch {}

      finishAccount();
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="createBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#createBg)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.kbView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Top bar (spacers keep the logo centered). */}
          <View style={styles.topBar}>
            <View style={{ width: 28 }} />
            <Image source={ESTER_AVATAR} style={styles.avatar} resizeMode="contain" />
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Create account</Text>

            <View style={styles.row}>
              <View style={[styles.field, styles.rowField]}>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={TEXT_ALT}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={[styles.field, styles.rowField]}>
                <TextInput
                  ref={lastNameRef}
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={TEXT_ALT}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.field}>
              <TextInput
                ref={emailRef}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={TEXT_ALT}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!isLoading}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View>
              <View style={[styles.field, styles.passwordField]}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={TEXT_ALT}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  onPress={() => setPasswordVisible((v) => !v)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  <VisibilityIcon off={!passwordVisible} />
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                Min 8 chars, uppercase, number, symbol
              </Text>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          {/* Bottom-right arrow button */}
          <View style={styles.bottomRow}>
            <TouchableOpacity
              style={[
                styles.arrowBtn,
                !isValid && styles.arrowBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isValid || isLoading}
              activeOpacity={0.85}
              accessibilityLabel="Create account"
            >
              {isLoading ? (
                <ActivityIndicator color={MAROON} />
              ) : (
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 12h14M13 5l7 7-7 7"
                    stroke={MAROON}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAROON },
  safe: { flex: 1 },
  kbView: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  avatar: { width: 40, height: 40 },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  title: {
    fontFamily: fonts.dmSans,
    color: WHITE,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
  },

  row: { flexDirection: "row", gap: 24 },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: TEXT_ALT,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 24,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  rowField: { flex: 1 },
  passwordField: { flexDirection: "row", alignItems: "center", paddingRight: 8 },
  input: {
    fontFamily: fonts.dmSans,
    color: WHITE,
    fontSize: 16,
    letterSpacing: -0.16,
    paddingVertical: 12,
  },
  eyeBtn: { padding: 4 },
  helperText: {
    fontFamily: fonts.dmSans,
    color: TEXT_ALT,
    fontSize: 12,
    letterSpacing: -0.12,
    textAlign: "center",
    marginTop: 6,
  },
  errorText: {
    fontFamily: fonts.dmSans,
    color: "#FF6B6B",
    fontSize: 14,
    textAlign: "center",
  },

  bottomRow: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "flex-end",
  },
  arrowBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnDisabled: { opacity: 0.5 },
});

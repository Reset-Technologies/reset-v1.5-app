import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { fonts } from "../../constants/typography";
import { resetPassword } from "../../services/auth";
import { logEvent } from "../../services/braze";
import { PasswordRules, usePasswordRules } from "../../components";
import {
  AuthScaffold,
  EyeIcon,
  MAROON,
  BONE,
  WHITE,
  TEXT_ALT,
  ERROR_RED,
} from "./authUi";

// The rule + its explanation now live in components/PasswordRules, shared with
// sign-up. This screen previously carried its own copy, which is how the two
// drifted apart: reset demanded the full strength while sign-up asked for eight
// characters of anything.

function CheckCircle() {
  return (
    <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke={WHITE}
        strokeWidth={1.5}
      />
      <Path
        d="M8 12.5l2.5 2.5L16 9"
        stroke={WHITE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Step 3: set the new password using the short-lived reset token from step 2.
export function ForgotPasswordResetScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const resetToken: string = route.params?.resetToken ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    isValid: strong,
    showError: showPasswordError,
    shake,
    flag: flagPassword,
    failedKeys,
  } = usePasswordRules(password);
  const matches = password.length > 0 && password === confirm;

  // 🔑 Pressable while invalid, on purpose. This screen is the migration's
  // critical path — a locked-out legacy member resets their password to get in
  // — and a disabled button with no stated reason is exactly where that person
  // gives up.
  const canSubmit = password.length > 0 && confirm.length > 0;

  const handleReset = async () => {
    if (isLoading) return;
    logEvent("auth_forgotPassword_resetCTA");
    setError(null);

    if (!strong) {
      flagPassword();
      // Rule keys only — never the password.
      logEvent("auth_forgotPassword_passwordRejected", {
        failed: failedKeys(),
      });
      return;
    }
    if (!matches) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(resetToken, password, confirm);
      logEvent("auth_forgotPassword_success");
      setDone(true);
    } catch (err: any) {
      const msg = err?.message ?? "";
      // An expired/invalid reset token means the short window elapsed — send
      // the user back to the start rather than looping on this screen.
      if (/expired|invalid reset token/i.test(msg)) {
        setError(
          "This reset session expired. Please go back and request a new code.",
        );
      } else {
        setError(msg || "Couldn't update your password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <AuthScaffold onBack={() => navigation.navigate("Login")}>
        <View style={styles.successWrap}>
          <CheckCircle />
          <View style={styles.heading}>
            <Text style={[styles.title, styles.centered]}>
              Password updated
            </Text>
            <Text style={[styles.subtitle, styles.centered]}>
              Your password has been changed. You can now log in with your new
              password.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Back to log in</Text>
          </TouchableOpacity>
        </View>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold onBack={() => navigation.goBack()} loading={isLoading}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.title}>New password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your account.
          </Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.fields}>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="New password"
                placeholderTextColor={TEXT_ALT}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <EyeIcon off={!showPassword} />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm password"
                placeholderTextColor={TEXT_ALT}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                onSubmitEditing={handleReset}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={8}
              >
                <EyeIcon off={!showConfirm} />
              </TouchableOpacity>
            </View>

            {/* Was one run-on sentence that reddened as a whole, so a user
                could see that something was wrong but not which part. */}
            <PasswordRules
              password={password}
              showError={showPasswordError}
              shake={shake}
              metColor={BONE}
              unmetColor={TEXT_ALT}
              errorColor={ERROR_RED}
            />
            {confirm.length > 0 && !matches ? (
              <Text style={styles.errorText}>Passwords don't match.</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.btn, (!canSubmit || isLoading) && styles.btnDisabled]}
            onPress={handleReset}
            disabled={!canSubmit || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={MAROON} />
            ) : (
              <Text style={styles.btnText}>Update password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
    gap: 48,
  },
  successWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 100,
    alignItems: "center",
    gap: 28,
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
  centered: { textAlign: "center" },
  form: { gap: 30 },
  fields: { gap: 16 },
  errorText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: ERROR_RED,
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
  hint: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_ALT,
  },
  hintUnmet: {
    color: ERROR_RED,
  },
  btn: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 4,
    minHeight: 44,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: fonts.dmSans,
    fontSize: 20,
    color: MAROON,
    letterSpacing: -0.2,
  },
});

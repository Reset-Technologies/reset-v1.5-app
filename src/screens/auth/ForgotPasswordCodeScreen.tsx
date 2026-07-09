import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { fonts } from "../../constants/typography";
import {
  verifyPasswordResetCode,
  sendPasswordResetCode,
} from "../../services/auth";
import { logEvent } from "../../services/braze";
import {
  AuthScaffold,
  MAROON,
  BONE,
  WHITE,
  TEXT_ALT,
  ERROR_RED,
} from "./authUi";

const CODE_LENGTH = 4;

// Step 2: enter the 4-digit code emailed to the account. A single hidden
// TextInput drives four display cells (the common OTP pattern) so the native
// keyboard/paste behaviour stays simple and correct.
export function ForgotPasswordCodeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email: string = route.params?.email ?? "";

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);

  const isValid = code.length === CODE_LENGTH;

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
  };

  const handleVerify = async (value: string) => {
    if (value.length !== CODE_LENGTH || isLoading) return;
    logEvent("auth_forgotPassword_verifyCTA");
    setError(null);
    setIsLoading(true);
    try {
      const resetToken = await verifyPasswordResetCode(email, value);
      navigation.navigate("ForgotPasswordReset", { email, resetToken });
    } catch (err: any) {
      setError(err?.message || "Invalid or expired code");
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendNote(null);
    try {
      await sendPasswordResetCode(email);
      setResendNote("A new code is on its way.");
    } catch (err: any) {
      // 429 cooldown comes back with a "wait N seconds" message — surface it
      // as-is so the user knows to wait.
      setResendNote(err?.message || "Please wait before requesting another code.");
    }
  };

  const cells = Array.from({ length: CODE_LENGTH });

  return (
    <AuthScaffold onBack={() => navigation.goBack()} loading={isLoading}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.title}>Enter code</Text>
          <Text style={styles.subtitle}>
            If an account exists for{" "}
            <Text style={styles.email}>{email}</Text>,{"\n"}we've sent a 4-digit
            code there. Enter it below.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Error + bubbles grouped so the error sits just above the bubbles
              (fixed-height slot keeps it from shifting the layout). */}
          <View style={styles.codeGroup}>
            <View style={styles.errorSlot}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {/* Hidden input captures the digits; the cells below are display. */}
            <Pressable onPress={() => inputRef.current?.focus()}>
              <View style={styles.cellsRow}>
                {cells.map((_, i) => {
                  const char = code[i] ?? "";
                  const active = i === code.length;
                  return (
                    <View
                      key={i}
                      style={[styles.cell, active && styles.cellActive]}
                    >
                      <Text style={styles.cellText}>{char}</Text>
                    </View>
                  );
                })}
              </View>
              <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                value={code}
                onChangeText={handleChange}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                autoFocus
                editable={!isLoading}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={[styles.btn, (!isValid || isLoading) && styles.btnDisabled]}
            onPress={() => handleVerify(code)}
            disabled={!isValid || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={MAROON} />
            ) : (
              <Text style={styles.btnText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendPrompt}>Didn't get a code? </Text>
            <TouchableOpacity onPress={handleResend} hitSlop={8}>
              <Text style={styles.resendLink}>Resend</Text>
            </TouchableOpacity>
          </View>
          {resendNote ? (
            <Text style={styles.resendNote}>{resendNote}</Text>
          ) : null}
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
    fontSize: 17,
    lineHeight: 23,
    color: TEXT_ALT,
    letterSpacing: -0.2,
  },
  email: { color: BONE },
  form: { gap: 16 },
  codeGroup: { gap: 6, marginTop: 24 },
  errorSlot: {
    minHeight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: ERROR_RED,
    textAlign: "center",
  },
  cellsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  cell: {
    width: 64,
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: BONE,
    borderBottomRightRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  cellActive: {
    borderColor: WHITE,
    borderWidth: 1.5,
  },
  cellText: {
    fontFamily: fonts.dmSans,
    fontSize: 32,
    color: BONE,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
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
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  resendPrompt: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: TEXT_ALT,
  },
  resendLink: {
    fontFamily: fonts.dmSansMedium,
    fontSize: 14,
    color: WHITE,
  },
  resendNote: {
    fontFamily: fonts.dmSans,
    fontSize: 13,
    color: TEXT_ALT,
    textAlign: "center",
  },
});

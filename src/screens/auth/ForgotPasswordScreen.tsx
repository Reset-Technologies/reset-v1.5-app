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
import { useNavigation } from "@react-navigation/native";
import { fonts } from "../../constants/typography";
import { sendPasswordResetCode } from "../../services/auth";
import { logEvent } from "../../services/braze";
import {
  AuthScaffold,
  MAROON,
  BONE,
  WHITE,
  TEXT_ALT,
  ERROR_RED,
} from "./authUi";

// Step 1 of the password-reset flow: collect the account email and request a
// verification code. The backend responds success even for unknown accounts,
// so we advance to the code screen whenever the request completes.
export function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    logEvent("auth_forgotPassword_start");
  }, []);

  const isValid = email.includes("@") && email.trim().length >= 3;

  const handleSendCode = async () => {
    logEvent("auth_forgotPassword_sendCodeCTA");
    setError(null);
    setIsLoading(true);
    const trimmed = email.trim();
    try {
      await sendPasswordResetCode(trimmed);
      navigation.navigate("ForgotPasswordCode", { email: trimmed });
    } catch (err: any) {
      // A cooldown (429) means a code was already sent recently — send the
      // user forward to enter it rather than stranding them here.
      if (/wait|seconds/i.test(err?.message ?? "")) {
        navigation.navigate("ForgotPasswordCode", { email: trimmed });
      } else {
        setError(err?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold onBack={() => navigation.goBack()} loading={isLoading}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter the email for your account and we'll send you a verification
            code.
          </Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={TEXT_ALT}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            autoFocus
            editable={!isLoading}
            onSubmitEditing={() => isValid && !isLoading && handleSendCode()}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[styles.btn, (!isValid || isLoading) && styles.btnDisabled]}
            onPress={handleSendCode}
            disabled={!isValid || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={MAROON} />
            ) : (
              <Text style={styles.btnText}>Send code</Text>
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
  form: { gap: 16 },
  errorText: {
    fontFamily: fonts.dmSans,
    fontSize: 14,
    color: ERROR_RED,
  },
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

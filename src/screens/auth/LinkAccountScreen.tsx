import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useNavigation, useRoute } from "@react-navigation/native";
import { fonts } from "../../constants/typography";
import {
  linkAppleToAccount,
  linkGoogleToAccount,
  loginWithApple,
  loginWithEmail,
  loginWithGoogle,
} from "../../services/auth";
import {
  GoogleSignin,
  isGoogleSignInAvailable,
} from "../../services/googleSignin";
import { logEvent } from "../../services/braze";
import {
  AuthScaffold,
  BONE,
  ERROR_RED,
  GHOST,
  MAROON,
  TEXT_ALT,
  WHITE,
} from "./authUi";

/**
 * "I already have a Reset account" — the screen that connects a second sign-in
 * method to an account the member already owns.
 *
 * ## Why this exists
 * One person should have one Reset account, reachable by Apple, Google or
 * email. The server links automatically when it safely can, but two cases it
 * cannot resolve on its own land here:
 *
 *  - **Hide My Email.** Apple hands us a relay alias, so the address matches no
 *    existing account and the server has nothing to link on. Two thirds of our
 *    Apple accounts are in this state.
 *  - **The account holds a password.** Matching on email alone would be the
 *    RES-210 takeover shape: v3 never verifies email at signup, so an address
 *    on an existing row is not proof of who owns it. A tap-confirm does not fix
 *    that — only signing in does.
 *
 * Both are solved the same way: prove control of the existing account by
 * signing into it, then attach the new method. That is why this screen asks for
 * a credential rather than a confirmation.
 *
 * The pending provider token is carried in from the gate so the member does not
 * have to repeat the Apple/Google prompt after signing in.
 */
type LinkAccountParams = {
  /** The address the existing account uses — display only, never editable. */
  email: string;
  /** Sign-in methods that account already has, from the server. */
  authProvider: string[];
  hasPassword: boolean;
  /** The method being connected, and the token proving the member holds it. */
  provider: "apple" | "google";
  idToken: string;
  /**
   * Where to continue once linked. The onboarding gate passes "AiConsent" to
   * resume the flow; the signed-out login passes nothing, because that stack
   * has no such route — RootNavigator moves the user on by itself once a
   * session exists. Resetting to a route the current navigator does not own
   * would crash, so this is explicit rather than assumed.
   */
  continueTo?: string;
};

const PROVIDER_LABEL: Record<LinkAccountParams["provider"], string> = {
  apple: "Apple",
  google: "Google",
};

export function LinkAccountScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, authProvider, hasPassword, provider, idToken, continueTo } =
    (route.params ?? {}) as LinkAccountParams;

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = PROVIDER_LABEL[provider] ?? "this method";

  // Offer the OTHER methods this account actually has — the point of this
  // screen is the ways in that already work. Anything not on the account, or
  // unusable on this device, must not be offered.
  const canUseApple =
    Platform.OS === "ios" &&
    provider !== "apple" &&
    Boolean(authProvider?.includes("apple"));
  const canUseGoogle =
    isGoogleSignInAvailable &&
    provider !== "google" &&
    Boolean(authProvider?.includes("google"));

  /**
   * The copy has to name what the member can actually do here.
   *
   * "Sign in the way you normally do" is only true if their way is on this
   * screen — and it is not always password. An account reached through Apple
   * or Google has no password at all, so a generic instruction would leave
   * them looking for a field that isn't there.
   */
  const methods: string[] = [];
  if (hasPassword) methods.push("your password");
  if (canUseApple) methods.push("Apple");
  if (canUseGoogle) methods.push("Google");
  const methodList =
    methods.length === 0
      ? null
      : methods.length === 1
        ? methods[0]
        : `${methods.slice(0, -1).join(", ")} or ${methods[methods.length - 1]}`;

  React.useEffect(() => {
    logEvent("auth_linkAccount_start");
  }, []);

  /** Attach the pending provider once a session exists. */
  const connectPending = async () => {
    if (provider === "google") await linkGoogleToAccount(idToken);
    else await linkAppleToAccount(idToken);
    logEvent("auth_linkAccount_linked");
    // Match the account gate: a completed sign-in continues the flow rather
    // than returning to a stale sign-up screen. Without a target we simply stop
    // — the session now exists, and RootNavigator routes on that.
    if (continueTo) {
      navigation.reset({ index: 0, routes: [{ name: continueTo }] });
    }
  };

  const handlePasswordSignIn = async () => {
    logEvent("auth_linkAccount_passwordCTA");
    setError(null);
    setIsLoading(true);
    try {
      await loginWithEmail(email, password);
      await connectPending();
    } catch (err: any) {
      setError(err?.message || "Could not sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    logEvent("auth_linkAccount_appleCTA");
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No Apple identity token");
      setIsLoading(true);
      await loginWithApple(credential.identityToken);
      await connectPending();
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") return;
      setError(err?.message || "Apple sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    logEvent("auth_linkAccount_googleCTA");
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");
      setIsLoading(true);
      await loginWithGoogle(idToken);
      await connectPending();
    } catch (err: any) {
      if (err.code === "SIGN_IN_CANCELLED") return;
      setError(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = password.trim().length > 0 && !isLoading;

  return (
    <AuthScaffold onBack={() => navigation.goBack()} loading={isLoading}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.title}>You already have a Reset account</Text>
          <Text style={styles.subtitle}>
            {methodList
              ? `${email} is already registered. Sign in with ${methodList} and we'll connect ${label} to that account.`
              : `${email} is already registered, but we can't connect ${label} to it automatically. Email hello@reset.com and we'll sort it out.`}
          </Text>
        </View>

        <View style={styles.form}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          {hasPassword && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={TEXT_ALT}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={[styles.btn, !canSubmit && styles.btnDisabled]}
                onPress={handlePasswordSignIn}
                disabled={!canSubmit}
              >
                {isLoading ? (
                  <ActivityIndicator color={MAROON} />
                ) : (
                  <Text style={styles.btnText}>Sign in and connect</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("ForgotPassword")}
                hitSlop={8}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </TouchableOpacity>
            </>
          )}

          {canUseApple && (
            <TouchableOpacity style={styles.ghostBtn} onPress={handleAppleSignIn}>
              <Text style={styles.ghostBtnText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          {canUseGoogle && (
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleGoogleSignIn}
            >
              <Text style={styles.ghostBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          )}
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
  ghostBtn: {
    width: "100%",
    backgroundColor: GHOST,
    borderRadius: 4,
    minHeight: 44,
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
  link: {
    fontFamily: fonts.dmSans,
    fontSize: 16,
    color: TEXT_ALT,
    letterSpacing: -0.16,
  },
});

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { K } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { Button } from "../../components";
import { useApp } from "../../context/AppContext";
import { setAiConsent as persistAiConsent } from "../../services/aiConsent";
import { AI_DISCLOSURE_URL, PRIVACY_POLICY_URL } from "../../constants/legal";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "AiConsent">;

// RES-188 — third-party-AI data-sharing consent (Apple 5.1.1(i)/5.1.2(i)).
// Shown once after account creation, before the type reveal (the first call
// that would send data to OpenAI). "Create my type" grants; "Not now" declines
// and continues into the non-AI experience. The backend enforces the decision
// on every AI endpoint regardless.
export function AiConsentScreen({ navigation }: Props) {
  const { state, setAiConsent } = useApp();

  // 🔴 Open Check #4 of the V1 onboarding handoff. The locked consent body
  // tells everyone that Reset shares "the wellness signals from your scan" and
  // that "your face video never leaves your device" — both false for someone
  // who skipped the scan, and until 2026-09-29 unreachable, because skippers
  // looped back at NoScanEmptyState and never got here. The skip fix opens that
  // path, so this screen now has to tell them the truth.
  //
  // 🔴 ENGINEERING DOES NOT WRITE THIS COPY. The Sheet is explicit: "Cole builds
  // the state; compliance supplies the final string." So the no-scan variant
  // OMITS the two claims that do not apply rather than inventing replacements —
  // removing a false claim is not authoring legal copy, but writing a new one
  // would be. When compliance delivers the approved wording, it goes in the two
  // marked places below and nothing else changes.
  //
  // `startingRead` is set by CreateAccountScreen from the typing response
  // immediately before it routes here, and is true exactly when the backend
  // typed the member with no scan.
  const scanned = state.user.startingRead !== true;
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    logEvent("onboarding_ai_consent");
  }, []);

  // Persist the decision, mirror it into app state, then continue to the type
  // reveal. We proceed even if the network write fails so onboarding is never
  // blocked — the backend defaults to "not granted" and the app re-syncs on
  // next load, so a failed grant simply re-prompts later (fail-safe).
  const decide = async (status: "granted" | "declined") => {
    if (busy) return;
    setBusy(true);
    logEvent(
      status === "granted"
        ? "onboarding_ai_consent_grantCTA"
        : "onboarding_ai_consent_declineCTA",
    );
    try {
      const next = await persistAiConsent(status);
      setAiConsent(next.consent?.status === "granted", next.needsPrompt);
    } catch {
      setAiConsent(status === "granted", status !== "granted");
    } finally {
      navigation.reset({ index: 0, routes: [{ name: "TypeReveal" }] });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Before we build your type</Text>

        {/* 🔴 PENDING COMPLIANCE (Open Check #4): no approved no-scan lead
            exists. Omitted rather than reworded — there is no face video to
            make a promise about. Replace with the approved string when it
            lands; do not write one here. */}
        {scanned ? (
          <Text style={styles.lead}>
            Your face video never leaves your device — the scan is processed
            right on your phone.
          </Text>
        ) : null}

        <Text style={styles.body}>
          To create your type and personalize your meals, Reset shares a few
          things with our AI partners — <Text style={styles.strong}>OpenAI</Text>
          , and <Text style={styles.strong}>ElevenLabs</Text> when you use voice:
        </Text>

        <View style={styles.list}>
          <Bullet text="Your first name" />
          <Bullet text="The things you tell Ester" />
          <Bullet text="Your check-in answers" />
          {/* 🔴 PENDING COMPLIANCE (Open Check #4): a member who skipped the
              scan has no wellness signals to share, so the row is omitted for
              them. Awaiting the approved no-scan wording. */}
          {scanned ? (
            <Bullet text="The wellness signals from your scan" />
          ) : null}
        </View>

        <View style={styles.links}>
          <LinkText label="Privacy Policy" url={PRIVACY_POLICY_URL} />
          <Text style={styles.linkDot}>·</Text>
          <LinkText label="AI Disclosure" url={AI_DISCLOSURE_URL} />
        </View>

        <Pressable
          style={styles.checkRow}
          onPress={() => setAgreed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          hitSlop={8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>
            I agree to Reset sharing this information with these providers to
            personalize my experience.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bottom}>
        <Button
          title="Create my type"
          onPress={() => decide("granted")}
          disabled={!agreed || busy}
          loading={busy && agreed}
        />
        <Button
          title="Not now"
          variant="ghost"
          onPress={() => decide("declined")}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function LinkText({ label, url }: { label: string; url: string }) {
  return (
    <Text
      style={styles.link}
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 12,
  },
  title: {
    ...typography.h2,
    color: K.text,
    marginBottom: 16,
  },
  lead: {
    ...typography.body,
    color: K.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  body: {
    ...typography.body,
    color: K.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  strong: {
    ...typography.bodyMedium,
    color: K.text,
  },
  list: {
    gap: 10,
    marginBottom: 20,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.brown,
  },
  bulletText: {
    ...typography.body,
    color: K.text,
    flex: 1,
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  link: {
    ...typography.bodyMedium,
    color: K.brown,
    textDecorationLine: "underline",
  },
  linkDot: {
    ...typography.body,
    color: K.sub,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    backgroundColor: K.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: K.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: K.brown,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: K.brown,
  },
  checkMark: {
    color: K.bone,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  checkLabel: {
    ...typography.body,
    color: K.text,
    flex: 1,
    lineHeight: 22,
  },
  bottom: {
    padding: 24,
    paddingTop: 12,
    gap: 12,
  },
});

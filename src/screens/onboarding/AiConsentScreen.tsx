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
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../../navigation/OnboardingNavigator";
import { K } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { OnboardingCta, ConsentCheckbox } from "../../components";
import { useApp } from "../../context/AppContext";
import { setAiConsent as persistAiConsent } from "../../services/aiConsent";
import { AI_DISCLOSURE_URL, PRIVACY_POLICY_URL } from "../../constants/legal";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<OnboardingStackParamList, "AiConsent">;

/**
 * Lang's frame values, and the floors they may be squeezed to when the screen
 * genuinely does not fit. See the reclaim block inside the component.
 */
const TOP_BAND = 102;
const MIN_TOP_BAND = 24;
const BLOCK_GAP = 40;
const MIN_BLOCK_GAP = 20;


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
  // ✅ RESOLVED — Bryan, 2026-10-01, and the answer is exactly what was already
  // built: "keep the approved screen exactly the same except remove the two
  // scan-specific references: the face-video sentence and the 'wellness signals
  // from your scan' bullet." No replacement wording is coming; omission IS the
  // approved treatment. This was the last item blocking the release.
  //
  // 🔴 ENGINEERING STILL DOES NOT WRITE THIS COPY. Nothing new goes in the two
  // branches below — the scanned text is the approved string and the skip path
  // is that string minus the two claims. Anyone tempted to "fill in" the gap
  // for skippers is authoring legal copy.
  //
  // 🔴 Keyed on BIOMETRICS FIRST, and `startingRead` only as a backstop. The
  // same mistake OnboardingSurveyScreen already fixed: `startingRead` comes
  // back from the typing round trip that CreateAccountScreen fires in a
  // `catch {}`, so ANY failure of that call leaves it undefined — and an
  // undefined `startingRead` made this screen fall back to the SCANNED copy,
  // i.e. it failed open into the two claims a skipper must not be shown.
  // Observed for real on the 2026-10-02 device walk, where a profile-insert
  // race 500'd the sync and a skipper was told their face video stayed on
  // their device. `biometrics` is local, is populated only by an actual scan,
  // and cannot be lost to a network failure — so it decides.
  const scanned =
    state.biometrics !== null && state.user.startingRead !== true;
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * 🔴 THE CONSENT GATE WAS BELOW THE FOLD. Measured on Cole’s S24,
   * 2026-10-14: content 751pt in a 581pt viewport, so the last 170pt — the
   * Privacy Policy / AI Disclosure links AND the whole "I agree" checkbox —
   * were clipped, with `showsVerticalScrollIndicator={false}` and the page's
   * bottom-darken gradient both saying "this is the end".
   *
   * 🔴 That is not cosmetic. "Create my Type" is disabled until the box is
   * ticked, and the box is the clipped thing — so a member saw a complete
   * looking screen, a dead primary button, and exactly one live control:
   * "Not now", which DECLINES. The layout was pushing people into declining.
   *
   * 🔑 Same root cause as three defects in the 2026-10-02 audit: Lang's frames
   * are 874pt and an S24 is 780pt. And the same fix as PreScanScreen, which
   * hit this first — MEASURE the real viewport, reclaim only the OVERFLOW, and
   * take it from whatever costs the design least. `shrink` only ever grows, so
   * it converges in a frame or two and can never oscillate.
   *
   * ⇒ Where the frame's values already fit, `shrink` stays 0 and every value
   * below is Lang's, unchanged.
   */
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [shrink, setShrink] = useState(0);

  // The skip path drops the lead sentence, so it has one block — and one
  // gap — fewer to give back. Counted, not assumed.
  const gaps = scanned ? 5 : 4;
  const maxReclaim =
    TOP_BAND - MIN_TOP_BAND + gaps * (BLOCK_GAP - MIN_BLOCK_GAP);

  useEffect(() => {
    if (viewportH > 0 && contentH > viewportH) {
      setShrink((v) =>
        Math.min(maxReclaim, v + Math.ceil(contentH - viewportH)),
      );
    }
  }, [viewportH, contentH, maxReclaim]);

  // 🔑 THE TOP BAND GOES FIRST, because it is the one piece of this screen
  // that is empty on purpose: 102pt holding the place of a back button this
  // screen deliberately does not have. Giving it back costs no copy, no
  // spacing rhythm and no control — it just moves the headline up toward the
  // status bar. Lang's 40pt rhythm is only touched once that runs out.
  const padCut = Math.min(TOP_BAND - MIN_TOP_BAND, shrink);
  const gapCut = Math.min(
    BLOCK_GAP - MIN_BLOCK_GAP,
    Math.ceil(Math.max(0, shrink - padCut) / gaps),
  );

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
      // Consent now hands off to Type ready, not the reveal: the Type stays
      // hidden until purchase (Bryan, 2026-09-29 — Flow rows 13-16). The reveal
      // is what the paywall sells, so it sits on the far side of it.
      navigation.reset({ index: 0, routes: [{ name: "TypeReady" }] });
    }
  };

  return (
    <View style={styles.page}>
      {/* Bottom-darken gradient over the page surface — the same treatment as
          Pre-scan, Type ready and the reveal, so the run reads as one surface. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="consentBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.4358" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.815" stopColor="#000000" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#consentBg)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: TOP_BAND - padCut, gap: BLOCK_GAP - gapCut },
        ]}
        /* Hidden while everything fits, which is Lang's clean frame. Shown
           once the screen overflows anyway — a smaller device, or a large
           accessibility font scale — because then something IS hidden and the
           member has to be told it is there. */
        showsVerticalScrollIndicator={contentH > viewportH}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentH(h)}
      >
        <Text style={styles.title}>Before we build your type</Text>

        {/* ✅ Open Check #4, closed by Bryan 2026-10-01: omit the face-video
            sentence for skippers and change nothing else. There is no face
            video to make a promise about. Do NOT add a replacement line. */}
        {scanned ? (
          <Text style={styles.lead}>
            Your face video never leaves your device—the scan is processed
            right on your phone.
          </Text>
        ) : null}

        <Text style={styles.body}>
          {/* Row 11 `consent.body`, status LOCKED. The Sheet punctuates this
              "our AI partners, OpenAI and ElevenLabs when you use voice:" — we
              had an em dash and a stray comma after OpenAI. Consent copy is
              not ours to repunctuate. The bold on the two provider names is
              the production rendering the Sheet's note defers to. */}
          To create your type and personalize your meals, Reset shares a few
          things with our AI partners,{" "}
          <Text style={styles.strong}>OpenAI</Text> and{" "}
          <Text style={styles.strong}>ElevenLabs</Text> when you use voice:
        </Text>

        <View style={styles.list}>
          <Bullet text="Your first name" />
          <Bullet text="The things you tell Ester" />
          <Bullet text="Your check-in answers" />
          {/* ✅ Open Check #4, closed by Bryan 2026-10-01: omit this bullet for
              skippers — they have no wellness signals to share. Do NOT add a
              replacement bullet. */}
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
          <ConsentCheckbox checked={agreed} />
          <Text style={styles.checkLabel}>
            I agree to Reset sharing this information with these providers to
            personalize my experience.
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bottom}>
        {/* Locked CTA, Screen Copy row 11: "Create my Type" — capital T. */}
        <OnboardingCta
          title="Create my Type"
          onPress={() => decide("granted")}
          disabled={!agreed || busy}
          loading={busy && agreed}
        />
        <OnboardingCta
          title="Not now"
          variant="ghost"
          onPress={() => decide("declined")}
          disabled={busy}
        />
      </View>
      </SafeAreaView>
    </View>
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

// Figma 5266:67914 (unchecked) / 5266:68035 (checked).
const DIVIDER = "#7E6869";     // divider-line

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: K.brown },
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    /**
     * 102 = where Lang starts the headline (y=164 on the frame, 62 of which is
     * the status bar). That space is the back button's in 5266:67914 — 22 above
     * it, 40 for the button, 40 below — and we deliberately have no back button
     * here: BOTH entry points reach this screen with `navigation.reset`, so
     * there is no back entry to return to. Going "back" would mean undoing an
     * account that already exists. The band is kept so the copy lands where
     * she placed it rather than riding up against the status bar.
     */
    paddingTop: TOP_BAND,
    paddingBottom: 12,
    // The frame's rhythm is a consistent 40 between every block — headline,
    // body, checkbox, buttons. This was 24.
    gap: BLOCK_GAP,
  },
  title: {
    fontFamily: fonts.catalogue,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.32,
    color: K.white,
  },
  lead: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: K.white,
  },
  body: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: K.white,
  },
  strong: {
    fontFamily: fonts.catalogueBold,
    color: K.white,
  },
  list: { gap: 10 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: K.white,
  },
  bulletText: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
    color: K.white,
    flex: 1,
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  link: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    letterSpacing: -0.16,
    color: K.white,
    textDecorationLine: "underline",
  },
  linkDot: {
    fontFamily: fonts.catalogue,
    fontSize: 16,
    color: DIVIDER,
  },
  // The frame's card: page surface inside a hairline, square but for a large
  // bottom-left corner — the mirror of the CTA's top-right.
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: K.brown,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    borderBottomLeftRadius: 24,
    paddingTop: 16,
    paddingBottom: 20,
    paddingLeft: 12,
    paddingRight: 16,
  },
  checkLabel: {
    fontFamily: fonts.catalogue,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.14,
    color: K.white,
    flex: 1,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
});

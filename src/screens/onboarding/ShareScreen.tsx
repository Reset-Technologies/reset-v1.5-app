import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Share,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { K, TC } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { TYPE_CONFIGS } from "../../constants/types";
import { Button, EsterBubble } from "../../components";
import { useApp } from "../../context/AppContext";
import { logEvent } from "../../services/braze";

type Props = NativeStackScreenProps<any, "Share">;

export function ShareScreen({ navigation }: Props) {
  const { state, completeOnboarding } = useApp();
  const metabolicType = state.user.metabolicType || "Explorer";
  const typeConfig = TYPE_CONFIGS[metabolicType];
  const colors = TC[metabolicType];
  const hasScan = !!state.biometrics;

  // Generate biometric headline for share card (only if scanned)
  const getBiometricHeadline = () => {
    if (!state.biometrics) return null;
    if (metabolicType === "Burner") {
      return "I'm seeing a stress-driven pattern";
    }
    if (metabolicType === "Rebounder") {
      return "Protective metabolism pattern";
    }
    if (metabolicType === "Ember") {
      return "Energy restoration needed";
    }
    if (metabolicType === "Chameleon") {
      return "I'm seeing a cyclical pattern";
    }
    return "Balanced baseline metabolism";
  };

  const biometricHeadline = getBiometricHeadline();

  useEffect(() => {
    logEvent("onboarding_share");
  }, []);

  const handleShare = async () => {
    logEvent("onboarding_share_shareCTA");
    try {
      const message = biometricHeadline
        ? `I just discovered I'm "${typeConfig.title}" on Reset! ${biometricHeadline}. Find your type → reset.app`
        : `I just discovered I'm "${typeConfig.title}" on Reset! ${typeConfig.tagline} Find your type → reset.app`;

      await Share.share({
        message,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
    // Continue regardless of share result
  };

  // Share is now the final onboarding screen — both paths end the flow.
  const handleSkip = () => {
    logEvent("onboarding_share_skipCTA");
    completeOnboarding();
  };

  const handleContinue = () => {
    completeOnboarding();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <EsterBubble message="This is your metabolic type. Want to share it?" />

        {/* Share card preview */}
        <View style={[styles.shareCard, { backgroundColor: colors.bg }]}>
          {/* Reset logo */}
          <View style={styles.cardHeader}>
            <Text style={[styles.logo, { color: colors.text }]}>reset</Text>
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { color: colors.text + "80" }]}>
                MY RESET
              </Text>
            </View>
          </View>

          {/* Type name */}
          <Text style={[styles.typeName, { color: colors.text }]}>
            {typeConfig.title}
          </Text>

          {/* Tagline or biometric headline */}
          <Text style={[styles.typeTagline, { color: colors.text + "CC" }]}>
            {biometricHeadline || typeConfig.tagline}
          </Text>

          {/* CTA */}
          <Text style={[styles.cardCta, { color: colors.text + "60" }]}>
            Find your type → reset.app
          </Text>
        </View>

        {/* Share buttons */}
        <View style={styles.shareButtons}>
          <TouchableOpacity style={styles.shareOption} onPress={handleShare}>
            <View style={styles.shareIcon}>
              <Text style={styles.shareEmoji}>📱</Text>
            </View>
            <Text style={styles.shareLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareOption} onPress={handleShare}>
            <View style={styles.shareIcon}>
              <Text style={styles.shareEmoji}>📸</Text>
            </View>
            <Text style={styles.shareLabel}>Story</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareOption} onPress={handleShare}>
            <View style={styles.shareIcon}>
              <Text style={styles.shareEmoji}>💬</Text>
            </View>
            <Text style={styles.shareLabel}>Message</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <Button title="Share" onPress={handleShare} />
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
    flexGrow: 1,
    padding: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  shareCard: {
    width: "85%",
    aspectRatio: 0.72,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: typography.h1.fontFamily,
  },
  badge: {
    marginTop: 8,
  },
  badgeText: {
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "600",
  },
  typeName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: typography.h1.fontFamily,
    marginBottom: 8,
  },
  typeTagline: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  cardCta: {
    fontSize: 11,
    marginTop: 28,
  },
  shareButtons: {
    flexDirection: "row",
    gap: 32,
    marginTop: 16,
    marginBottom: 8,
  },
  shareOption: {
    alignItems: "center",
  },
  shareIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: K.warmGray,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  shareEmoji: {
    fontSize: 24,
  },
  shareLabel: {
    fontSize: 12,
    color: K.sub,
  },
  bottom: {
    padding: 24,
    paddingBottom: 24,
    alignItems: "center",
    gap: 12,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: K.faded,
  },
});

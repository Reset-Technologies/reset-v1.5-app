import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { K } from "../../constants/colors";
import { typography, spacing, radius } from "../../constants/typography";
import { DIETARY_RESTRICTIONS, TASTE_CLUSTERS } from "../../constants/types";
import {
  AI_DISCLOSURE_URL,
  PRIVACY_POLICY_URL,
  TERMS_OF_USE_URL,
} from "../../constants/legal";
import { setAiConsent as persistAiConsent } from "../../services/aiConsent";
import { Pill } from "../../components";
import { useApp } from "../../context/AppContext";
import { logout } from "../../services/auth";
import * as BrazeService from "../../services/braze";
import { resetAppOpenFlowGate } from "../../utils/appOpenFlowGate";
import { shouldShowExperiments } from "../../../modules/build-env";

const NOTIFICATION_PREFS_KEY = "notification_preferences";

// Notification categories — PRD §19.3 forbids check-in reminder pushes, so
// they are intentionally absent from this list.
const NOTIFICATION_CATEGORIES = [
  { id: "meals", label: "Daily Meal Plan" },
  { id: "observations", label: "Ester Observations" },
  { id: "weekly", label: "Weekly Review" },
];

export function SettingsScreen() {
  const navigation = useNavigation();
  const {
    state,
    setDietaryRestrictions,
    setTastePreferences,
    clearAuth,
    resetState,
    setHomeV2Enabled,
    setAppOpenFlowEnabled,
    setUseNewSurveyFlow,
    setAiConsent,
  } = useApp();

  // Notification toggles — persisted via AsyncStorage
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.id, true]))
  );

  useEffect(() => {
    BrazeService.logEvent("profile_settings");
    AsyncStorage.getItem(NOTIFICATION_PREFS_KEY).then((stored) => {
      if (stored) setNotifications(JSON.parse(stored));
    });
  }, []);

  // Local state for dietary restrictions editing
  const [editingDiet, setEditingDiet] = useState(false);
  const [dietSelection, setDietSelection] = useState<string[]>(
    state.user.dietaryRestrictions
  );

  // Local state for taste preferences editing
  const [editingTaste, setEditingTaste] = useState(false);
  const [tasteSelection, setTasteSelection] = useState<string[]>(
    state.user.tastePreferences
  );

  const toggleNotification = (id: string) => {
    setNotifications((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
      BrazeService.setCustomAttribute(`notification_pref_${id}`, updated[id]);
      return updated;
    });
  };

  const toggleDietOption = (id: string) => {
    if (id === "none") {
      setDietSelection(["none"]);
      return;
    }
    setDietSelection((prev) => {
      const filtered = prev.filter((s) => s !== "none");
      return filtered.includes(id)
        ? filtered.filter((s) => s !== id)
        : [...filtered, id];
    });
  };

  const saveDietaryRestrictions = () => {
    setDietaryRestrictions(dietSelection);
    setEditingDiet(false);
  };

  const selectTaste = (id: string) => {
    setTasteSelection([id]);
  };

  const saveTastePreferences = () => {
    setTastePreferences(tasteSelection);
    setEditingTaste(false);
  };

  // RES-188 — grant / withdraw third-party-AI data-sharing consent. Withdrawing
  // turns all AI features off and returns the user to the non-AI experience;
  // for subscribers we're honest that paid features can't run without it.
  const aiConsentGranted = state.user.aiConsentGranted === true;

  const applyAiConsent = async (status: "granted" | "declined") => {
    // Optimistic: reflect immediately, reconcile from the server response.
    setAiConsent(status === "granted", status !== "granted");
    try {
      const next = await persistAiConsent(status);
      setAiConsent(next.consent?.status === "granted", next.needsPrompt);
    } catch {
      // Revert on failure so the toggle never lies about the saved state.
      setAiConsent(aiConsentGranted, !aiConsentGranted);
      Alert.alert(
        "Couldn't update",
        "We couldn't save that change. Please try again.",
      );
    }
  };

  const handleAiConsentToggle = (nextOn: boolean) => {
    if (nextOn) {
      applyAiConsent("granted");
      return;
    }
    const isPro = state.user.subscriptionTier !== "free";
    Alert.alert(
      "Turn off AI personalization?",
      isPro
        ? "Ester, insights, and meal reasoning will stop, and your data will no longer be shared with our AI partners. Your paid features rely on this processing, so they won't run until you turn it back on."
        : "Ester, insights, and meal reasoning will stop, and your data will no longer be shared with our AI partners. You can turn this back on anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn off",
          style: "destructive",
          onPress: () => applyAiConsent("declined"),
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "You'll need to sign in again next time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        onPress: async () => {
          await logout();
          clearAuth();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Type DELETE to confirm.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: async () => {
                    // TODO: Call delete account API endpoint
                    await logout();
                    resetState();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription — RES-127: read the real tier from the backend
            instead of treating "has any biometric data" as Pro. */}
        {(() => {
          const isPro = state.user.subscriptionTier !== "free";
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
              <View style={styles.card}>
                <View style={styles.subscriptionRow}>
                  <View>
                    <Text style={styles.planName}>{isPro ? "Pro" : "Free"}</Text>
                    <Text style={styles.planDesc}>
                      {isPro
                        ? "Full signal tracking & personalized meals"
                        : "Basic meal plan & limited features"}
                    </Text>
                  </View>
                </View>
                {!isPro && (
                  <TouchableOpacity style={styles.upgradeButton}>
                    <Text style={styles.upgradeText}>Upgrade to Pro</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <View style={styles.card}>
            {NOTIFICATION_CATEGORIES.map((category, i) => (
              <View
                key={category.id}
                style={[
                  styles.toggleRow,
                  i < NOTIFICATION_CATEGORIES.length - 1 && styles.toggleBorder,
                ]}
              >
                <Text style={styles.toggleLabel}>{category.label}</Text>
                <Switch
                  value={notifications[category.id]}
                  onValueChange={() => toggleNotification(category.id)}
                  trackColor={{ false: K.border, true: K.ochre }}
                  thumbColor={K.white}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Dietary Restrictions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DIETARY RESTRICTIONS</Text>
            <TouchableOpacity
              onPress={() => {
                if (editingDiet) {
                  saveDietaryRestrictions();
                } else {
                  setDietSelection(state.user.dietaryRestrictions);
                  setEditingDiet(true);
                }
              }}
            >
              <Text style={styles.editText}>
                {editingDiet ? "Save" : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>
          {editingDiet ? (
            <View style={styles.pillGrid}>
              {DIETARY_RESTRICTIONS.map((option) => (
                <Pill
                  key={option.id}
                  label={option.label}
                  selected={dietSelection.includes(option.id)}
                  onPress={() => toggleDietOption(option.id)}
                  style={styles.pill}
                />
              ))}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.currentValue}>
                {state.user.dietaryRestrictions.length > 0
                  ? state.user.dietaryRestrictions
                      .map(
                        (id) =>
                          DIETARY_RESTRICTIONS.find((d) => d.id === id)
                            ?.label ?? id
                      )
                      .join(", ")
                  : "None set"}
              </Text>
            </View>
          )}
        </View>

        {/* Taste Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TASTE PREFERENCE</Text>
            <TouchableOpacity
              onPress={() => {
                if (editingTaste) {
                  saveTastePreferences();
                } else {
                  setTasteSelection(state.user.tastePreferences);
                  setEditingTaste(true);
                }
              }}
            >
              <Text style={styles.editText}>
                {editingTaste ? "Save" : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>
          {editingTaste ? (
            <View style={styles.tasteGrid}>
              {TASTE_CLUSTERS.map((cluster) => (
                <TouchableOpacity
                  key={cluster.id}
                  style={[
                    styles.tasteCard,
                    tasteSelection.includes(cluster.id) &&
                      styles.tasteCardSelected,
                  ]}
                  onPress={() => selectTaste(cluster.id)}
                >
                  <Text
                    style={[
                      styles.tasteCardName,
                      tasteSelection.includes(cluster.id) &&
                        styles.tasteCardNameSelected,
                    ]}
                  >
                    {cluster.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.currentValue}>
                {state.user.tastePreferences.length > 0
                  ? state.user.tastePreferences
                      .map(
                        (id) =>
                          TASTE_CLUSTERS.find((t) => t.id === id)?.name ?? id
                      )
                      .join(", ")
                  : "None set"}
              </Text>
            </View>
          )}
        </View>

        {/* Data & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA & PRIVACY</Text>
          <View style={styles.card}>
            {/* RES-188 — third-party-AI consent grant/withdraw. */}
            <View style={styles.toggleRow}>
              <View style={styles.aiConsentLabelWrap}>
                <Text style={styles.toggleLabel}>AI personalization</Text>
                <Text style={styles.aiConsentSub}>
                  Shares your first name, chats, check-ins, and scan wellness
                  signals with OpenAI (and ElevenLabs for voice) to personalize
                  your experience.
                </Text>
              </View>
              <Switch
                value={aiConsentGranted}
                onValueChange={handleAiConsentToggle}
                trackColor={{ false: K.border, true: K.ochre }}
                thumbColor={K.white}
              />
            </View>
            <View style={styles.linkBorder} />
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(AI_DISCLOSURE_URL)}
            >
              <Text style={styles.linkText}>AI Disclosure</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.linkBorder} />
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            >
              <Text style={styles.linkText}>Privacy Policy</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.linkBorder} />
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(TERMS_OF_USE_URL)}
            >
              <Text style={styles.linkText}>Terms of Use</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.linkBorder} />
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkText}>Export My Data</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkText}>Help Center</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.linkBorder} />
            <TouchableOpacity style={styles.linkRow}>
              <Text style={styles.linkText}>Contact Us</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Experimental — visible only in local dev + TestFlight builds;
            hidden on the shipping App Store build (see modules/build-env). */}
        {shouldShowExperiments() && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EXPERIMENTAL</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>New home screen</Text>
              <Switch
                value={state.settings.homeV2Enabled}
                onValueChange={setHomeV2Enabled}
                trackColor={{ false: K.border, true: K.ochre }}
                thumbColor={K.white}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>App-open flow</Text>
              <Switch
                value={state.settings.appOpenFlowEnabled}
                onValueChange={setAppOpenFlowEnabled}
                trackColor={{ false: K.border, true: K.ochre }}
                thumbColor={K.white}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>New survey flow (Figma)</Text>
              <Switch
                value={state.settings.useNewSurveyFlow}
                onValueChange={setUseNewSurveyFlow}
                trackColor={{ false: K.border, true: K.ochre }}
                thumbColor={K.white}
              />
            </View>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={async () => {
                const userId = state.auth.authUser?.id;
                if (!userId) return;
                await resetAppOpenFlowGate(userId);
                Alert.alert(
                  "Reset",
                  "App-open flow will show again on next foreground.",
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Reset app-open flow (today)</Text>
              <Text style={{ color: K.ochre, fontWeight: "600" }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                (navigation as any).navigate("AppOpenFlow", {
                  screen: "DataGate",
                  params: { debugForceShow: true },
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Preview Quick scan screen</Text>
              <Text style={{ color: K.ochre, fontWeight: "600" }}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                (navigation as any).navigate("AppOpenFlow", {
                  screen: "NextMeal",
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Preview Next meal screen</Text>
              <Text style={{ color: K.ochre, fontWeight: "600" }}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                (navigation as any).navigate("AppOpenFlow", {
                  screen: "SurveyV2",
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Preview Survey v2</Text>
              <Text style={{ color: K.ochre, fontWeight: "600" }}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                (navigation as any).navigate("AppOpenFlow", {
                  screen: "ScoreReveal",
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Preview Score reveal</Text>
              <Text style={{ color: K.ochre, fontWeight: "600" }}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Account Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Reset v1.5.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: K.border,
  },
  backButton: {
    width: 60,
  },
  backText: {
    ...typography.bodyMedium,
    color: K.brown,
  },
  headerTitle: {
    ...typography.h3,
    textAlign: "center",
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: K.textMuted,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  editText: {
    ...typography.bodySmall,
    color: K.ochre,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: K.bone,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  subscriptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planName: {
    ...typography.bodyMedium,
    color: K.brown,
    fontSize: 18,
  },
  planDesc: {
    ...typography.bodySmall,
    color: K.textMuted,
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: K.ochre,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  upgradeText: {
    ...typography.button,
    color: K.brown,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  toggleBorder: {
    borderBottomWidth: 1,
    borderBottomColor: K.border,
  },
  toggleLabel: {
    ...typography.body,
    color: K.brown,
  },
  aiConsentLabelWrap: {
    flex: 1,
    paddingRight: 12,
  },
  aiConsentSub: {
    ...typography.caption,
    color: K.sub,
    marginTop: 4,
    lineHeight: 17,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    minWidth: "45%",
    flexGrow: 1,
  },
  currentValue: {
    ...typography.body,
    color: K.brown,
  },
  tasteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tasteCard: {
    width: "47%",
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: K.border,
    backgroundColor: K.bone,
    padding: spacing.md,
    alignItems: "center",
  },
  tasteCardSelected: {
    borderColor: K.brown,
    backgroundColor: K.brown,
  },
  tasteCardName: {
    ...typography.bodyMedium,
    fontSize: 13,
    color: K.text,
  },
  tasteCardNameSelected: {
    color: K.bone,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  linkBorder: {
    height: 1,
    backgroundColor: K.border,
  },
  linkText: {
    ...typography.body,
    color: K.brown,
  },
  linkArrow: {
    ...typography.body,
    color: K.textMuted,
    fontSize: 20,
  },
  signOutButton: {
    backgroundColor: K.bone,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  signOutText: {
    ...typography.bodyMedium,
    color: K.brown,
  },
  deleteButton: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  deleteText: {
    ...typography.bodyMedium,
    color: K.err,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  versionText: {
    ...typography.caption,
    color: K.faded,
  },
});

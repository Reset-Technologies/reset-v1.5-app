import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MetabolicType } from "../constants/colors";
import { getTokens, clearTokens } from "../services/apiClient";
import { fetchMe, AuthUser } from "../services/auth";
import { getProfile } from "../services/profile";
import { getAiConsent } from "../services/aiConsent";
import * as BrazeService from "../services/braze";
import {
  configureRevenueCat,
  loginRevenueCat,
  logoutRevenueCat,
} from "../services/revenuecat";
import { requestPushPermission } from "../services/pushNotifications";
import { notifyAppOpened } from "../services/notifications";

// State types

// RES-121 pre-scan calibration — height/weight/age/biological sex. Feeds
// ShenAI (so it can return BMR/TDEE) and the typing function (age/sex for
// HRV norms; height/weight to compute the expected-BMR delta).
export interface CalibrationData {
  heightCm: number;
  weightKg: number;
  age: number;
  biologicalSex: "male" | "female";
}

export type SubscriptionTier = "free" | "pro";

interface UserProfile {
  email?: string;
  name?: string;
  metabolicType?: MetabolicType;
  // RES-121 typing-function flags. `internalConfidence` itself stays
  // backend-only — only these public flags surface here.
  startingRead?: boolean;
  glp1Flag?: boolean;
  // RES-127 — account status. Defaults to 'pro' on first load until the
  // backend confirms otherwise, so we never accidentally gate biomarkers
  // a user already has access to.
  subscriptionTier?: SubscriptionTier;
  // RES-188 — third-party-AI data-sharing consent. `aiConsentGranted` gates
  // AI features on the client (the backend enforces independently);
  // `aiConsentNeedsPrompt` is true when the user hasn't decided (or the
  // disclosure materially changed) so we can prompt on the next AI action.
  aiConsentGranted?: boolean;
  aiConsentNeedsPrompt?: boolean;
  goal?: string;
  calibration?: CalibrationData;
  quizAnswers: Record<string, string>;
  tastePreferences: string[];
  dietaryRestrictions: string[];
  hasCompletedOnboarding: boolean;
}

interface ScanResultsRaw {
  heartRate: number;
  stressIndex: number | null;
  hrvSdnn: number | null;
  hrvLnrmssd: number | null;
  breathingRate: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  parasympatheticActivity: number | null;
  cardiacWorkload: number | null;
  ageEstimate: number | null;
  signalQuality: number;
  bmi: number | null;
  weightKg: number | null;
  heightCm: number | null;
}

interface BiometricData {
  stressIndex: number;
  heartRate: number;
  wellness: number;
  // RES-147: vascularAge is still captured + fed into the Reset Score; it's
  // just no longer surfaced in the UI. hrvSdnn + breathingRate are now shown
  // in its place.
  vascularAge: number;
  hrvSdnn: number | null;
  breathingRate: number | null;
  raw?: ScanResultsRaw;
}

interface AuthState {
  isAuthenticated: boolean;
  authUser: AuthUser | null;
}

interface SettingsState {
  homeV2Enabled: boolean;
  appOpenFlowEnabled: boolean;
  useNewSurveyFlow: boolean;
}

/**
 * RES-207 — what the last login told us about a returning BetterWell member.
 * Session-scoped and deliberately NOT persisted: both are answers about one
 * sign-in, and a stale `hasUnclaimedLegacyAccount` would keep offering to
 * restore a subscription that was already restored.
 */
export interface LegacyState {
  /** This login just created the v3 account from legacy credentials. */
  isReturningLegacyMember: boolean;
  /** An unredeemed legacy claim exists on this email. Grants nothing on its
   *  own — it only decides whether to offer the emailed-code claim flow. */
  hasUnclaimedLegacyAccount: boolean;
}

const LEGACY_DEFAULTS: LegacyState = {
  isReturningLegacyMember: false,
  hasUnclaimedLegacyAccount: false,
};

interface AppState {
  user: UserProfile;
  biometrics: BiometricData | null;
  auth: AuthState;
  legacy: LegacyState;
  settings: SettingsState;
  isLoading: boolean;
}

// Action types
type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_STATE"; payload: Omit<AppState, "auth" | "isLoading"> }
  | { type: "SET_QUIZ_ANSWER"; payload: { questionId: string; answer: string } }
  | { type: "SET_METABOLIC_TYPE"; payload: MetabolicType }
  | { type: "SET_SUBSCRIPTION_TIER"; payload: SubscriptionTier }
  | {
      type: "SET_AI_CONSENT";
      payload: { granted: boolean; needsPrompt: boolean };
    }
  | {
      type: "SET_TYPING_RESULT";
      payload: {
        metabolicType: MetabolicType;
        startingRead: boolean;
        glp1Flag: boolean;
      };
    }
  | { type: "SET_GOAL"; payload: string }
  | { type: "SET_CALIBRATION"; payload: CalibrationData }
  | { type: "SET_BIOMETRICS"; payload: BiometricData }
  | { type: "SET_TASTE_PREFERENCES"; payload: string[] }
  | { type: "SET_DIETARY_RESTRICTIONS"; payload: string[] }
  | { type: "SET_USER_ACCOUNT"; payload: { email: string; name?: string } }
  | { type: "SET_AUTH"; payload: AuthState }
  | { type: "SET_LEGACY_FLAGS"; payload: LegacyState }
  | { type: "SET_HOME_V2_ENABLED"; payload: boolean }
  | { type: "SET_APP_OPEN_FLOW_ENABLED"; payload: boolean }
  | { type: "SET_USE_NEW_SURVEY_FLOW"; payload: boolean }
  | { type: "COMPLETE_ONBOARDING" }
  | { type: "RESET_STATE" };

// Initial state
const initialState: AppState = {
  user: {
    quizAnswers: {},
    tastePreferences: [],
    dietaryRestrictions: [],
    hasCompletedOnboarding: false,
  },
  biometrics: null,
  auth: { isAuthenticated: false, authUser: null },
  legacy: LEGACY_DEFAULTS,
  // Experimental flags default ON — testers opt out, not in. They're also
  // re-asserted on every SET_AUTH (account creation + sign-in).
  settings: { homeV2Enabled: true, appOpenFlowEnabled: true, useNewSurveyFlow: true },
  isLoading: true,
};

// Storage key
const STORAGE_KEY = "@reset_app_state";

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "LOAD_STATE":
      // Note: does NOT flip isLoading. The launch splash stays up until the
      // session is resolved in loadState() so a logged-in user never flashes
      // the Auth screen (RES-186); loadState dispatches SET_LOADING when done.
      return {
        ...state,
        user: action.payload.user,
        biometrics: action.payload.biometrics,
        settings: action.payload.settings ?? state.settings,
      };

    case "SET_QUIZ_ANSWER":
      return {
        ...state,
        user: {
          ...state.user,
          quizAnswers: {
            ...state.user.quizAnswers,
            [action.payload.questionId]: action.payload.answer,
          },
        },
      };

    case "SET_METABOLIC_TYPE":
      return {
        ...state,
        user: {
          ...state.user,
          metabolicType: action.payload,
        },
      };

    case "SET_SUBSCRIPTION_TIER":
      return {
        ...state,
        user: {
          ...state.user,
          subscriptionTier: action.payload,
        },
      };

    case "SET_AI_CONSENT":
      return {
        ...state,
        user: {
          ...state.user,
          aiConsentGranted: action.payload.granted,
          aiConsentNeedsPrompt: action.payload.needsPrompt,
        },
      };

    case "SET_TYPING_RESULT":
      return {
        ...state,
        user: {
          ...state.user,
          metabolicType: action.payload.metabolicType,
          startingRead: action.payload.startingRead,
          glp1Flag: action.payload.glp1Flag,
        },
      };

    case "SET_GOAL":
      return {
        ...state,
        user: {
          ...state.user,
          goal: action.payload,
        },
      };

    case "SET_CALIBRATION":
      return {
        ...state,
        user: {
          ...state.user,
          calibration: action.payload,
        },
      };

    case "SET_BIOMETRICS":
      return {
        ...state,
        biometrics: action.payload,
      };

    case "SET_TASTE_PREFERENCES":
      return {
        ...state,
        user: {
          ...state.user,
          tastePreferences: action.payload,
        },
      };

    case "SET_DIETARY_RESTRICTIONS":
      return {
        ...state,
        user: {
          ...state.user,
          dietaryRestrictions: action.payload,
        },
      };

    case "SET_USER_ACCOUNT":
      return {
        ...state,
        user: {
          ...state.user,
          email: action.payload.email,
          name: action.payload.name,
        },
      };

    case "SET_LEGACY_FLAGS":
      return { ...state, legacy: action.payload };

    case "SET_AUTH":
      return {
        ...state,
        auth: action.payload,
        // Force the experimental flags ON whenever a user is created or
        // signs back in, so testers never land on the legacy flows by
        // default. A persisted `false` from an earlier session (or a
        // mid-session opt-out) is overridden here. setAuth only fires on
        // explicit auth actions — never on app launch — so a tester's
        // opt-out still holds for the rest of that session.
        settings: {
          ...state.settings,
          homeV2Enabled: true,
          appOpenFlowEnabled: true,
          useNewSurveyFlow: true,
        },
      };

    case "SET_HOME_V2_ENABLED":
      return {
        ...state,
        settings: { ...state.settings, homeV2Enabled: action.payload },
      };

    case "SET_APP_OPEN_FLOW_ENABLED":
      return {
        ...state,
        settings: { ...state.settings, appOpenFlowEnabled: action.payload },
      };
    case "SET_USE_NEW_SURVEY_FLOW":
      return {
        ...state,
        settings: { ...state.settings, useNewSurveyFlow: action.payload },
      };

    case "COMPLETE_ONBOARDING":
      return {
        ...state,
        user: {
          ...state.user,
          hasCompletedOnboarding: true,
        },
      };

    case "RESET_STATE":
      return { ...initialState, isLoading: false };

    default:
      return state;
  }
}

// Context
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setQuizAnswer: (questionId: string, answer: string) => void;
  setMetabolicType: (type: MetabolicType) => void;
  setSubscriptionTier: (tier: SubscriptionTier) => void;
  setAiConsent: (granted: boolean, needsPrompt: boolean) => void;
  setTypingResult: (payload: {
    metabolicType: MetabolicType;
    startingRead: boolean;
    glp1Flag: boolean;
  }) => void;
  setGoal: (goal: string) => void;
  setCalibration: (data: CalibrationData) => void;
  setBiometrics: (data: BiometricData) => void;
  setTastePreferences: (preferences: string[]) => void;
  setDietaryRestrictions: (restrictions: string[]) => void;
  setUserAccount: (email: string, name?: string) => void;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  setHomeV2Enabled: (enabled: boolean) => void;
  setAppOpenFlowEnabled: (enabled: boolean) => void;
  setUseNewSurveyFlow: (enabled: boolean) => void;
  completeOnboarding: () => void;
  setLegacyFlags: (flags: LegacyState) => void;
  resetState: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Configure RevenueCat as early as possible (anonymous). No-ops until the
  // dashboard + public key are in place. loginRevenueCat() later attaches the
  // backend user id once the user authenticates.
  useEffect(() => {
    configureRevenueCat();
  }, []);

  // Load saved state on mount
  useEffect(() => {
    loadState();
  }, []);

  // Save state on change (exclude auth — derived from tokens)
  useEffect(() => {
    if (!state.isLoading) {
      saveState(state);
    }
  }, [state]);

  // Tell backend whenever the app opens / returns to foreground so it can
  // cancel any pending re-engagement pushes (PRD §19.2 Action Paths).
  useEffect(() => {
    if (!state.auth.isAuthenticated) return;

    notifyAppOpened();

    const sub = RNAppState.addEventListener("change", (status) => {
      if (status === "active") {
        notifyAppOpened();
      }
    });
    return () => sub.remove();
  }, [state.auth.isAuthenticated]);

  async function loadState() {
    // Resolve persisted state + session BEFORE flipping isLoading, so a
    // logged-in user never sees the Auth (Login/Sign Up) screen flash on launch
    // (RES-186). The reveal happens in the `finally`, once we know whether the
    // user is authenticated and (on reinstall) whether onboarding is complete.
    let savedState: string | null = null;
    let authUser: Awaited<ReturnType<typeof fetchMe>> | null = null;
    try {
      // Load persisted app state (user profile, biometrics, settings)
      savedState = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedState) {
        dispatch({ type: "LOAD_STATE", payload: JSON.parse(savedState) });
      }

      // Restore the session if we have a token
      const { accessToken } = await getTokens();
      if (accessToken) {
        try {
          authUser = await fetchMe();
          dispatch({
            type: "SET_AUTH",
            payload: { isAuthenticated: true, authUser },
          });

          // Re-identify with Braze on session restore + register push token
          BrazeService.changeUser(authUser.id);
          loginRevenueCat(authUser.id);
          requestPushPermission();

          // If local state is missing onboarding data but the backend has it
          // (e.g. reinstall), restore it BEFORE revealing so we route straight
          // to Main instead of flashing the onboarding flow. Only runs when
          // local onboarding is absent, so returning users don't pay for it.
          const savedParsed = savedState ? JSON.parse(savedState) : null;
          if (!savedParsed?.user?.hasCompletedOnboarding) {
            try {
              const profile = await getProfile();
              if (profile.layer1.primaryBucket) {
                dispatch({
                  type: "SET_METABOLIC_TYPE",
                  payload: profile.layer1.primaryBucket as MetabolicType,
                });
                if (profile.layer1.tasteCluster) {
                  dispatch({
                    type: "SET_TASTE_PREFERENCES",
                    payload: [profile.layer1.tasteCluster],
                  });
                }
                if (profile.layer1.dietaryRestrictions.length > 0) {
                  dispatch({
                    type: "SET_DIETARY_RESTRICTIONS",
                    payload: profile.layer1.dietaryRestrictions,
                  });
                }
                if (profile.layer1.goal) {
                  dispatch({ type: "SET_GOAL", payload: profile.layer1.goal });
                }
                dispatch({ type: "COMPLETE_ONBOARDING" });
              }
            } catch {
              // Profile fetch failed — continue with local state
            }
          }
        } catch {
          // Token invalid/expired and refresh failed
          await clearTokens();
          authUser = null;
        }
      }
    } catch (error) {
      console.error("Failed to load state:", error);
    } finally {
      // Session (and reinstall onboarding) resolved — reveal the correct root
      // stack now. No more Auth-screen flash for logged-in users.
      dispatch({ type: "SET_LOADING", payload: false });
    }

    // Background re-sync — runs with the app already visible, so a slow network
    // never holds the launch. Best-effort; failures keep local values. These
    // update content within the current stack, not which stack is shown (tier
    // and type are already restored from persisted state by LOAD_STATE).
    if (!authUser) return;
    try {
      // Re-sync metabolicType + subscriptionTier from the backend so
      // type-derived UI (check-in surfaces, etc.) and Ester's gating match the
      // source of truth on every session restore.
      const profile = await getProfile();
      if (profile.layer1.primaryBucket) {
        dispatch({
          type: "SET_METABOLIC_TYPE",
          payload: profile.layer1.primaryBucket as MetabolicType,
        });
      }
      if (profile.subscriptionTier) {
        dispatch({
          type: "SET_SUBSCRIPTION_TIER",
          payload: profile.subscriptionTier,
        });
      }
      // Tag the analytics identity with where this account came from. Set on
      // every profile sync rather than once at signup: user properties are
      // idempotent, and this way accounts that existed before the flag shipped
      // get tagged on their next app open instead of staying unknown forever.
      // Goes to Amplitude AND Braze through the shared setCustomAttribute.
      if (typeof profile.isLegacyMember === "boolean") {
        BrazeService.setCustomAttribute(
          "isLegacyMember",
          profile.isLegacyMember,
        );
      }
    } catch {
      // Leave existing local value.
    }
    // RES-188 — hydrate third-party-AI consent so AI surfaces gate correctly on
    // session restore (and we can prompt if it's stale).
    try {
      const { consent, needsPrompt } = await getAiConsent();
      dispatch({
        type: "SET_AI_CONSENT",
        payload: { granted: consent?.status === "granted", needsPrompt },
      });
    } catch {
      // Leave existing local value on failure.
    }
  }

  async function saveState(stateToSave: AppState) {
    try {
      // Only persist user profile, biometrics, and settings — not auth
      const { user, biometrics, settings } = stateToSave;
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user, biometrics, settings }),
      );
    } catch (error) {
      console.error("Failed to save state:", error);
    }
  }

  // Helper functions
  const setQuizAnswer = (questionId: string, answer: string) => {
    dispatch({ type: "SET_QUIZ_ANSWER", payload: { questionId, answer } });
  };

  const setTypingResult = (payload: {
    metabolicType: MetabolicType;
    startingRead: boolean;
    glp1Flag: boolean;
  }) => {
    dispatch({ type: "SET_TYPING_RESULT", payload });
  };

  const setMetabolicType = (type: MetabolicType) => {
    dispatch({ type: "SET_METABOLIC_TYPE", payload: type });
  };

  const setSubscriptionTier = (tier: SubscriptionTier) => {
    dispatch({ type: "SET_SUBSCRIPTION_TIER", payload: tier });
  };

  const setAiConsent = (granted: boolean, needsPrompt: boolean) => {
    dispatch({ type: "SET_AI_CONSENT", payload: { granted, needsPrompt } });
  };

  const setGoal = (goal: string) => {
    dispatch({ type: "SET_GOAL", payload: goal });
  };

  const setCalibration = (data: CalibrationData) => {
    dispatch({ type: "SET_CALIBRATION", payload: data });
  };

  const setBiometrics = (data: BiometricData) => {
    dispatch({ type: "SET_BIOMETRICS", payload: data });
  };

  const setTastePreferences = (preferences: string[]) => {
    dispatch({ type: "SET_TASTE_PREFERENCES", payload: preferences });
  };

  const setDietaryRestrictions = (restrictions: string[]) => {
    dispatch({ type: "SET_DIETARY_RESTRICTIONS", payload: restrictions });
  };

  const setUserAccount = (email: string, name?: string) => {
    dispatch({ type: "SET_USER_ACCOUNT", payload: { email, name } });
  };

  const setAuth = (user: AuthUser) => {
    dispatch({
      type: "SET_AUTH",
      payload: { isAuthenticated: true, authUser: user },
    });
    // Identify user with Braze + RevenueCat. RES-188: the push soft-ask is no
    // longer fired here at signup (it stacked with the AI-consent screen) —
    // it's now primed once from the home screen after the first meal card.
    BrazeService.changeUser(user.id);
    loginRevenueCat(user.id);
    // Pull metabolicType + subscriptionTier from backend so type-derived UI
    // and Ester's account-status gating both match the user we just signed in
    // as (rather than the previous user's local state).
    getProfile()
      .then((profile) => {
        if (profile.layer1.primaryBucket) {
          dispatch({
            type: "SET_METABOLIC_TYPE",
            payload: profile.layer1.primaryBucket as MetabolicType,
          });
        }
        if (profile.subscriptionTier) {
          dispatch({
            type: "SET_SUBSCRIPTION_TIER",
            payload: profile.subscriptionTier,
          });
        }
      })
      .catch(() => {});
    // RES-188 — hydrate third-party-AI consent for the user we just signed in
    // as, mirroring the session-restore path. Without this an in-session
    // account switch would carry the prior user's consent flag (clearAuth now
    // resets it to the fail-safe default, so a failure here leaves AI off).
    getAiConsent()
      .then(({ consent, needsPrompt }) => {
        dispatch({
          type: "SET_AI_CONSENT",
          payload: { granted: consent?.status === "granted", needsPrompt },
        });
      })
      .catch(() => {});
  };

  const clearAuth = () => {
    dispatch({
      type: "SET_AUTH",
      payload: { isAuthenticated: false, authUser: null },
    });
    // RES-207 — same fail-safe as the AI-consent reset below. These describe
    // the previous sign-in; leaving them set would offer the next account a
    // "restore your subscription" prompt for someone else's legacy claim.
    dispatch({ type: "SET_LEGACY_FLAGS", payload: LEGACY_DEFAULTS });
    // RES-188 — reset third-party-AI consent to the fail-safe "not granted,
    // needs prompt" default so the previous user's grant never leaks into the
    // next account. setAuth re-hydrates the real value from the backend on the
    // next sign-in; if that fetch fails we stay fail-safe (nudge shown, no AI
    // call) rather than fail-open.
    dispatch({
      type: "SET_AI_CONSENT",
      payload: { granted: false, needsPrompt: true },
    });
    // Drop the RevenueCat identity so the next user starts clean.
    logoutRevenueCat();
  };

  const setHomeV2Enabled = (enabled: boolean) => {
    dispatch({ type: "SET_HOME_V2_ENABLED", payload: enabled });
  };

  const setAppOpenFlowEnabled = (enabled: boolean) => {
    dispatch({ type: "SET_APP_OPEN_FLOW_ENABLED", payload: enabled });
  };

  const setUseNewSurveyFlow = (enabled: boolean) => {
    dispatch({ type: "SET_USE_NEW_SURVEY_FLOW", payload: enabled });
  };

  const completeOnboarding = () => {
    dispatch({ type: "COMPLETE_ONBOARDING" });
  };

  const setLegacyFlags = (flags: LegacyState) => {
    dispatch({ type: "SET_LEGACY_FLAGS", payload: flags });
  };

  const resetState = () => {
    dispatch({ type: "RESET_STATE" });
    AsyncStorage.removeItem(STORAGE_KEY);
    clearTokens();
  };

  const value: AppContextValue = {
    state,
    dispatch,
    setQuizAnswer,
    setMetabolicType,
    setSubscriptionTier,
    setAiConsent,
    setTypingResult,
    setGoal,
    setCalibration,
    setBiometrics,
    setTastePreferences,
    setDietaryRestrictions,
    setUserAccount,
    setAuth,
    clearAuth,
    setHomeV2Enabled,
    setAppOpenFlowEnabled,
    setUseNewSurveyFlow,
    completeOnboarding,
    setLegacyFlags,
    resetState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

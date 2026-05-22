import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MetabolicType } from "../constants/colors";
import { getTokens, clearTokens } from "../services/apiClient";
import { fetchMe, AuthUser } from "../services/auth";
import { getProfile } from "../services/profile";
import * as BrazeService from "../services/braze";
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

interface UserProfile {
  email?: string;
  name?: string;
  metabolicType?: MetabolicType;
  // RES-121 typing-function flags. `internalConfidence` itself stays
  // backend-only — only these public flags surface here.
  startingRead?: boolean;
  glp1Flag?: boolean;
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
}

interface BiometricData {
  stressIndex: number;
  heartRate: number;
  wellness: number;
  vascularAge: number;
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

interface AppState {
  user: UserProfile;
  biometrics: BiometricData | null;
  auth: AuthState;
  settings: SettingsState;
  isLoading: boolean;
}

// Action types
type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_STATE"; payload: Omit<AppState, "auth" | "isLoading"> }
  | { type: "SET_QUIZ_ANSWER"; payload: { questionId: string; answer: string } }
  | { type: "SET_METABOLIC_TYPE"; payload: MetabolicType }
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
      return {
        ...state,
        user: action.payload.user,
        biometrics: action.payload.biometrics,
        settings: action.payload.settings ?? state.settings,
        isLoading: false,
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
  resetState: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

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
    try {
      // Load persisted app state
      const savedState = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        dispatch({ type: "LOAD_STATE", payload: parsed });
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      // Check if user has a valid session
      const { accessToken } = await getTokens();
      if (accessToken) {
        try {
          const authUser = await fetchMe();
          dispatch({
            type: "SET_AUTH",
            payload: { isAuthenticated: true, authUser },
          });

          // Re-identify with Braze on session restore + register push token
          BrazeService.changeUser(authUser.id);
          requestPushPermission();

          // If local state is missing onboarding data but backend has it (e.g. reinstall),
          // restore from backend profile
          const savedParsed = savedState ? JSON.parse(savedState) : null;
          const localHasOnboarding = savedParsed?.user?.hasCompletedOnboarding;
          if (!localHasOnboarding) {
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
                  dispatch({
                    type: "SET_GOAL",
                    payload: profile.layer1.goal,
                  });
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
        }
      }
    } catch (error) {
      console.error("Failed to load state:", error);
      dispatch({ type: "SET_LOADING", payload: false });
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
    // Identify user with Braze and request push permission
    BrazeService.changeUser(user.id);
    requestPushPermission();
  };

  const clearAuth = () => {
    dispatch({
      type: "SET_AUTH",
      payload: { isAuthenticated: false, authUser: null },
    });
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

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera } from "expo-camera";
import { ShenaiSdkView } from "react-native-shenai-sdk";
import { K } from "../../constants/colors";
import { useApp } from "../../context/AppContext";
import { submitScanResults } from "../../services/profile";
import Constants from "expo-constants";
import {
  initShenAI,
  shutdownShenAI,
  startScan,
  stopScan,
  getScanResults,
  getFaceStateValue,
  isReady,
  getRealtimeHeartRate,
  getMeasureState,
  getMeasureProgress,
  getViolatedCondition,
  type ScanResults,
  type FaceState,
  type EnvCondition,
} from "../../services/shenai";
import { logEvent } from "../../services/braze";

const SCAN_PHASE_EVENTS = [
  "onboarding_scan_phase_aligning",
  "onboarding_scan_phase_reading",
  "onboarding_scan_phase_mapping",
] as const;

type Props = NativeStackScreenProps<any, "Scan"> & {
  route: {
    params?: {
      mode?: "onboarding" | "rescan";
      returnTo?: "ScanResults" | "ScoreReveal";
    };
  };
};

const SHEN_API_KEY =
  Constants.expoConfig?.extra?.shenAiApiKey ?? "";

// On short screens (Galaxy S24 ≈ 780dp tall, iPhone SE/mini) the ShenAI view
// has to share height with our controls below it, leaving the camera small.
// Dropping the phase bubbles + progress bar reclaims that height for the
// camera. Larger phones (iPhone 14/15 ≈ 844dp+) keep the full controls.
const SCREEN_H = Dimensions.get("window").height;
const IS_SHORT_SCREEN = SCREEN_H < 800;

const SCAN_PHASES = [
  {
    id: "aligning",
    label: "Aligning",
    ester: "Got you. Hold still — I'm reading your signals.",
  },
  {
    id: "reading",
    label: "Reading signals",
    ester: "I can see your pulse. Reading deeper...",
  },
  {
    id: "mapping",
    label: "Mapping markers",
    ester: "Stress index... vascular age... wellness score...",
  },
];

const POSITION_TIMEOUT = 30000;
const FACE_LOST_THRESHOLD = 5000;
const MIN_SIGNAL_QUALITY = 0.3;

type ScreenState =
  | "initializing"
  | "positioning"
  | "measuring"
  | "complete"
  | "error";

interface FailureInfo {
  type:
    | "face_not_detected"
    | "poor_lighting"
    | "too_much_movement"
    | "scan_timeout"
    | "camera_error"
    | "low_signal_quality";
  message: string;
}

const FAILURE_MESSAGES: Record<FailureInfo["type"], string> = {
  face_not_detected:
    "I can't see you clearly. Try facing the camera directly.",
  poor_lighting: "It's a bit dark. Try moving to better light.",
  too_much_movement: "Hold still for me — I need a steady read.",
  scan_timeout: "Taking longer than expected. Let's try again.",
  camera_error: "Camera hiccup. Let me try again.",
  low_signal_quality: "The reading wasn't strong enough. One more try?",
};

// RES-159: live, actionable guidance for each scan-quality problem ShenAI
// surfaces mid-scan. FACE_POSITION is handled by the directional faceState
// guidance (close/far/centered), so it's intentionally omitted here.
const CONDITION_HINTS: Record<Exclude<EnvCondition, "FACE_POSITION">, string> = {
  FOREHEAD_COVERED: "Clear your forehead — move hair or a hat aside.",
  GLASSES_DETECTED: "Take your glasses off for a clearer read.",
  LOW_LIGHT: "Move somewhere brighter.",
  UNEVEN_LIGHTING: "Even out the light — avoid shadows on one side of your face.",
  BACKLIGHT: "Face the light — keep bright windows behind your phone, not you.",
  FACE_UNSTABLE: "Hold still — keep your head steady.",
  DEVICE_UNSTABLE: "Keep your phone steady.",
};

function deriveBiometrics(results: ScanResults) {
  // Prefer the real SDK HealthRisks output. Fall back to the legacy local
  // derivations only when the SDK didn't return them (e.g., HealthRisks
  // disabled, missing factors).
  const wellness =
    results.wellnessScore ??
    Math.round(
      Math.min(
        100,
        Math.max(
          0,
          (results.parasympatheticActivity ?? 50) * 0.6 +
            ((results.hrvSdnn ?? 40) / 80) * 40,
        ),
      ),
    );

  // SDK vascularAge is the absolute estimated vascular age in years; we
  // display the offset above the user's chronological estimate.
  let vascularAgeOffset: number;
  if (
    typeof results.vascularAge === "number" &&
    typeof results.ageEstimate === "number"
  ) {
    vascularAgeOffset = Math.max(0, results.vascularAge - results.ageEstimate);
  } else if (results.ageEstimate) {
    vascularAgeOffset = Math.max(0, Math.round(results.ageEstimate - 30));
  } else {
    vascularAgeOffset = Math.floor(Math.random() * 6) + 2;
  }

  return {
    stressIndex: results.stressIndex ?? 65,
    heartRate: results.heartRate,
    wellness,
    vascularAge: vascularAgeOffset,
    raw: results,
  };
}

export function ScanScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? "onboarding";
  const returnTo = route.params?.returnTo ?? "ScanResults";
  const scanSource: "onboarding" | "home" | "appopen" =
    mode === "onboarding"
      ? "onboarding"
      : returnTo === "ScoreReveal"
        ? "appopen"
        : "home";
  const { state, setBiometrics } = useApp();
  const calibration = state.user.calibration;
  const insets = useSafeAreaInsets();
  const [sdkReady, setSdkReady] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>("initializing");
  const [phase, setPhase] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [showMarkers, setShowMarkers] = useState(false);
  const [faceState, setFaceState] = useState<FaceState>("NOT_VISIBLE");
  const [condition, setCondition] = useState<EnvCondition | null>(null);
  const [failure, setFailure] = useState<FailureInfo | null>(null);
  const [liveMarkers, setLiveMarkers] = useState({
    stress: 0,
    wellness: 0,
    vascAge: 0,
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const markerFadeAnim = useRef(new Animated.Value(0)).current;

  const faceLostSinceRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pulse animation for heart rate
  useEffect(() => {
    if (heartRate <= 0) return;
    const beatDuration = 60000 / heartRate;

    const pulse = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.15,
        duration: beatDuration * 0.15,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: beatDuration * 0.85,
        useNativeDriver: true,
      }),
    ]);

    const loop = Animated.loop(pulse);
    loop.start();
    return () => loop.stop();
  }, [heartRate]);

  useEffect(() => {
    logEvent("onboarding_scan", { source: scanSource });
    logEvent(SCAN_PHASE_EVENTS[0], { source: scanSource });
  }, []);

  // Initialize SDK on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Request camera permission first
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== "granted") {
          console.warn("[ShenAI] Camera permission denied");
          if (!cancelled) {
            setFailure({
              type: "camera_error",
              message: "Camera access is required for the scan.",
            });
            setScreenState("error");
          }
          return;
        }

        console.log("[ShenAI] Initializing with key:", SHEN_API_KEY ? "present" : "MISSING");
        await initShenAI(SHEN_API_KEY, calibration);
        console.log("[ShenAI] Init success");
        if (!cancelled) {
          setSdkReady(true);
          setScreenState("positioning");
        }
      } catch (err) {
        console.error("[ShenAI] Init failed:", err);
        if (!cancelled) {
          setFailure({
            type: "camera_error",
            message: FAILURE_MESSAGES.camera_error,
          });
          setScreenState("error");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      shutdownShenAI();
    };
  }, []);

  // Positioning phase: poll face state and auto-start when ready
  useEffect(() => {
    if (screenState !== "positioning") return;

    positionTimeoutRef.current = setTimeout(() => {
      setFailure({
        type: "scan_timeout",
        message: FAILURE_MESSAGES.scan_timeout,
      });
      setScreenState("error");
    }, POSITION_TIMEOUT);

    const poll = setInterval(async () => {
      try {
        const face = await getFaceStateValue();
        setFaceState(face);
        // RES-159: surface lighting/backlight problems while the user is still
        // lining up, so they can fix them before the scan even starts.
        setCondition(await getViolatedCondition());

        if (face === "OK") {
          const ready = await isReady();
          if (ready) {
            clearInterval(poll);
            if (positionTimeoutRef.current) {
              clearTimeout(positionTimeoutRef.current);
            }
            beginMeasurement();
          }
        }
      } catch {
        // SDK polling error — continue trying
      }
    }, 500);

    return () => {
      clearInterval(poll);
      if (positionTimeoutRef.current) {
        clearTimeout(positionTimeoutRef.current);
      }
    };
  }, [screenState]);

  const beginMeasurement = useCallback(async () => {
    try {
      await startScan();
      setScreenState("measuring");
      setPhase(0);

      progressAnim.setValue(0);
    } catch {
      setFailure({
        type: "camera_error",
        message: FAILURE_MESSAGES.camera_error,
      });
      setScreenState("error");
    }
  }, []);

  // During measurement: poll state, HR, progress, face
  useEffect(() => {
    if (screenState !== "measuring") return;

    pollRef.current = setInterval(async () => {
      try {
        // Poll measurement state
        const measureState = await getMeasureState();

        if (measureState === "FINISHED") {
          if (pollRef.current) clearInterval(pollRef.current);
          await finishMeasurement();
          return;
        }

        if (measureState === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setFailure({
            type: "camera_error",
            message: FAILURE_MESSAGES.camera_error,
          });
          setScreenState("error");
          return;
        }

        // Poll progress and update phase/animation
        const progress = await getMeasureProgress();
        const normalizedProgress = progress / 100;
        progressAnim.setValue(normalizedProgress);

        // Phase transitions based on progress. Emit every phase event we
        // pass through so a single-tick jump from <16% to >=66% doesn't drop
        // the "reading" event.
        if (progress >= 66 && phase < 2) {
          if (phase < 1) logEvent(SCAN_PHASE_EVENTS[1], { source: scanSource });
          setPhase(2);
          setShowMarkers(true);
          logEvent(SCAN_PHASE_EVENTS[2], { source: scanSource });
          Animated.timing(markerFadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        } else if (progress >= 16 && phase < 1) {
          setPhase(1);
          logEvent(SCAN_PHASE_EVENTS[1], { source: scanSource });
        }

        // Poll live heart rate
        const hr = await getRealtimeHeartRate();
        if (hr && hr > 0) setHeartRate(hr);

        // Poll face state for loss detection
        const face = await getFaceStateValue();
        setFaceState(face);

        // RES-159: surface real-time scan-quality problems (lighting, backlight,
        // head/device movement) so the user can correct them mid-scan instead
        // of waiting for the signal to degrade into a failure.
        setCondition(await getViolatedCondition());

        if (face !== "OK") {
          if (!faceLostSinceRef.current) {
            faceLostSinceRef.current = Date.now();
          } else if (
            Date.now() - faceLostSinceRef.current >
            FACE_LOST_THRESHOLD
          ) {
            await stopScan();
            if (pollRef.current) clearInterval(pollRef.current);
            setFailure({
              type: "face_not_detected",
              message: FAILURE_MESSAGES.face_not_detected,
            });
            setScreenState("error");
            return;
          }
        } else {
          faceLostSinceRef.current = null;
        }
      } catch {
        // Polling error — continue
      }
    }, 500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [screenState, phase]);

  const finishMeasurement = useCallback(async () => {
    try {
      console.log("[ShenAI] Measurement finished, stopping scan...");
      await stopScan();
      console.log("[ShenAI] Fetching results...");
      const results = await getScanResults(calibration);
      console.log("[ShenAI] Results:", JSON.stringify(results));

      if (!results) {
        setFailure({
          type: "camera_error",
          message: FAILURE_MESSAGES.camera_error,
        });
        setScreenState("error");
        return;
      }

      // Check signal quality
      if (results.signalQuality < MIN_SIGNAL_QUALITY) {
        setFailure({
          type: "low_signal_quality",
          message: FAILURE_MESSAGES.low_signal_quality,
        });
        setScreenState("error");
        return;
      }

      // Update live markers for display
      setLiveMarkers({
        stress: results.stressIndex ?? 0,
        wellness: Math.round(
          ((results.parasympatheticActivity ?? 50) * 0.6) +
            (((results.hrvSdnn ?? 40) / 80) * 40),
        ),
        vascAge: results.ageEstimate
          ? Math.round(results.ageEstimate - 30)
          : 4,
      });

      const biometrics = deriveBiometrics(results);
      console.log("[ShenAI] Biometrics derived, navigating...");
      setBiometrics(biometrics);
      setScreenState("complete");
      logEvent("onboarding_scan_completed", { source: scanSource });

      setTimeout(async () => {
        await shutdownShenAI();
        if (mode === "rescan") {
          // Post-onboarding: submit to backend.
          try {
            await submitScanResults(results);
          } catch {
            // Non-blocking: scan still saved locally
          }
          if (returnTo === "ScoreReveal") {
            // AppOpen flow: jump back into the in-progress check-in so the
            // user sees their updated score, not the standalone rescan modal.
            navigation.navigate("AppOpenFlow", { screen: "ScoreReveal" });
          } else {
            navigation.replace("ScanResults");
          }
        } else {
          // Onboarding: straight into the chat-style survey questions.
          navigation.replace("Survey", { step: 0 });
        }
      }, 1500);
    } catch (err) {
      console.error("[ShenAI] finishMeasurement error:", err);
      setFailure({
        type: "camera_error",
        message: FAILURE_MESSAGES.camera_error,
      });
      setScreenState("error");
    }
  }, [navigation, setBiometrics]);

  const handleRetry = useCallback(async () => {
    setFailure(null);
    setPhase(0);
    setShowMarkers(false);
    setHeartRate(0);
    setFaceState("NOT_VISIBLE");
    setCondition(null);
    faceLostSinceRef.current = null;
    progressAnim.setValue(0);
    markerFadeAnim.setValue(0);

    try {
      await initShenAI(SHEN_API_KEY, calibration);
      setScreenState("positioning");
    } catch {
      setFailure({
        type: "camera_error",
        message: FAILURE_MESSAGES.camera_error,
      });
      setScreenState("error");
    }
  }, []);

  const handleSkip = useCallback(async () => {
    await shutdownShenAI();
    if (mode === "rescan") {
      navigation.goBack();
    } else {
      // TODO RES-119 (#125): declining the scan should drop the user into the
      // "false start" home (blurred recs + scan CTA), not continue onboarding.
      // Until that screen exists, send them through the survey; AccountScreen
      // skips the type reveal when there are no biometrics.
      navigation.replace("Survey", { step: 0 });
    }
  }, [navigation, mode]);

  // TEMP / DEV-ONLY: skip the camera scan with mock biometrics so post-scan
  // screens (Survey → TypeReveal → Paywall) can be reached on the iOS
  // simulator, where ShenAI has no camera and never completes. Gated on
  // __DEV__ so it never ships. Remove when sim testing is done.
  const devSkipScan = useCallback(async () => {
    try {
      await shutdownShenAI();
    } catch {
      // SDK may not have initialized on the sim — safe to ignore.
    }
    setBiometrics({
      stressIndex: 65,
      heartRate: 72,
      wellness: 78,
      vascularAge: 4,
      raw: {
        heartRate: 72,
        wellnessScore: 78,
        stressIndex: 65,
        signalQuality: 1,
      } as ScanResults,
    });
    if (mode === "rescan") {
      navigation.goBack();
    } else {
      navigation.replace("Survey", { step: 0 });
    }
  }, [navigation, setBiometrics, mode]);

  // Persistent exit: tearing down any in-flight scan and returning the user
  // to the screen that pushed Scan. Partial data is never persisted because
  // setBiometrics / submitScanResults only run after a FINISHED measurement.
  const handleCancel = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (positionTimeoutRef.current) clearTimeout(positionTimeoutRef.current);
    try {
      await stopScan();
    } catch {
      // stopScan may throw if no scan is active — safe to ignore.
    }
    try {
      await shutdownShenAI();
    } catch {
      // shutdownShenAI may throw if SDK never initialized — safe to ignore.
    }
    navigation.goBack();
  }, [navigation]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const currentPhase = SCAN_PHASES[phase];

  const getFaceGuidanceText = (): string => {
    switch (faceState) {
      case "NOT_VISIBLE":
        return "Position your face in the frame.";
      case "NOT_CENTERED":
        return "Center your face in the oval.";
      case "TOO_CLOSE":
        return "Move back a little.";
      case "TOO_FAR":
        return "Move a bit closer.";
      case "OK":
        return "Hold still — starting scan...";
      default:
        return "Position your face in the frame.";
    }
  };

  // RES-159: the most pressing live correction the user should make right now,
  // or null when the scan environment is good. Environment problems (lighting,
  // backlight, movement) take priority over face positioning since they're the
  // silent reasons a scan degrades; FACE_POSITION defers to the directional
  // faceState guidance below.
  const getLiveGuidance = (): string | null => {
    if (condition && condition !== "FACE_POSITION") {
      return CONDITION_HINTS[condition];
    }
    if (faceState !== "OK") return getFaceGuidanceText();
    return null;
  };

  const hasLiveGuidance =
    (screenState === "positioning" || screenState === "measuring") &&
    !failure &&
    getLiveGuidance() !== null;

  const getEsterMessage = (): string => {
    if (failure) return failure.message;
    if (screenState === "initializing") return "Setting up the scan...";
    if (screenState === "positioning") {
      return getLiveGuidance() ?? getFaceGuidanceText();
    }
    // Measuring: surface a live correction if there's a problem, otherwise the
    // ambient phase narration. Other states (complete) just show the narration.
    if (screenState === "measuring") {
      return getLiveGuidance() ?? currentPhase.ester;
    }
    return currentPhase.ester;
  };

  const getStatusLabel = (): string => {
    if (failure) return "ISSUE DETECTED";
    if (screenState === "initializing") return "PREPARING";
    if (screenState === "positioning") return "POSITIONING";
    if (screenState === "complete") return "COMPLETE";
    return "READING";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* SDK camera + metrics panel */}
      {sdkReady ? (
        <ShenaiSdkView style={styles.sdkView} />
      ) : (
        <View style={styles.sdkPlaceholder} />
      )}

      {/* Persistent cancel — visible at every state so users can always exit.
          The Shen SDK letterboxes its camera preview internally when its parent
          becomes too tall (error state has a taller controls bar). The native
          view's RN frame stays full-width, so we approximate the visible camera
          right edge with a heuristic inset that widens in the shrunken state. */}
      <TouchableOpacity
        style={[
          styles.cancelButton,
          {
            top: insets.top,
            right: screenState === "error" ? 32 : 12,
          },
        ]}
        onPress={handleCancel}
        hitSlop={20}
        accessibilityLabel="Cancel scan"
        accessibilityRole="button"
      >
        <Text style={styles.cancelGlyph}>✕</Text>
      </TouchableOpacity>

      {/* Our controls below the SDK */}
      <View style={styles.controlsBar}>
        <View style={[styles.esterBox, hasLiveGuidance && styles.esterBoxHint]}>
          <Text
            style={[styles.esterText, hasLiveGuidance && styles.esterTextHint]}
          >
            {getEsterMessage()}
          </Text>
        </View>

        {/* TEMP / DEV-ONLY immediate skip — see devSkipScan. Remove before ship. */}
        {__DEV__ && (
          <TouchableOpacity style={styles.devSkipButton} onPress={devSkipScan}>
            <Text style={styles.devSkipText}>DEV: skip scan →</Text>
          </TouchableOpacity>
        )}

        {screenState === "measuring" && !IS_SHORT_SCREEN && (
          <View style={styles.phaseIndicators}>
            {SCAN_PHASES.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.phaseIndicator,
                  i === phase && styles.phaseIndicatorActive,
                  i < phase && styles.phaseIndicatorComplete,
                ]}
              >
                <Text
                  style={[
                    styles.phaseLabel,
                    i === phase && styles.phaseLabelActive,
                  ]}
                >
                  {p.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {screenState === "measuring" && !IS_SHORT_SCREEN && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, { width: progressWidth }]}
              />
            </View>
          </View>
        )}

        {failure && (
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipText}>Skip scan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C0806",
  },
  sdkView: {
    flex: 1,
  },
  sdkPlaceholder: {
    flex: 1,
    backgroundColor: "#0C0806",
  },
  controlsBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#0C0806",
    gap: 8,
  },
  phaseIndicators: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  phaseIndicator: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  phaseIndicatorActive: {
    backgroundColor: K.mustard + "30",
  },
  phaseIndicatorComplete: {
    backgroundColor: K.ok + "30",
  },
  phaseLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  phaseLabelActive: {
    color: K.mustard,
  },
  esterBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
  },
  // RES-159: live correction hints read as an actionable amber callout, not the
  // ambient italic narration.
  esterBoxHint: {
    backgroundColor: K.mustard + "26",
    borderWidth: 1,
    borderColor: K.mustard + "66",
  },
  esterText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    fontStyle: "italic",
  },
  esterTextHint: {
    color: K.mustard,
    fontStyle: "normal",
    fontWeight: "600",
  },
  // TEMP / DEV-ONLY skip button styling.
  devSkipButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  devSkipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  retryButton: {
    flex: 1,
    backgroundColor: K.mustard,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: K.warmBlack,
  },
  skipButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  progressContainer: {
    alignItems: "center",
  },
  progressTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: K.mustard,
  },
  cancelButton: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  cancelGlyph: {
    fontSize: 22,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "400",
  },
});

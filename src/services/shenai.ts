import {
  initialize,
  deinitialize,
  getMeasurementResults,
  getHealthRisks,
  getMeasurementState,
  getMeasurementProgressPercentage,
  getFaceState as sdkGetFaceState,
  getHeartRate4s,
  getCurrentViolatedMeasurementEnvironmentCondition,
  setOperatingMode,
  setCameraMode,
  setCustomMeasurementConfig,
  setRecordingEnabled,
  OperatingMode,
  MeasurementPreset,
  PrecisionMode,
  OnboardingMode,
  CameraMode,
  Metric,
  HealthIndex,
  UiVersion,
  Gender,
  FaceState as SdkFaceState,
  MeasurementState as SdkMeasurementState,
  MeasurementEnvironmentCondition as SdkEnvCondition,
  type MeasurementResults,
  type HealthRisks,
} from "react-native-shenai-sdk";
import { Platform } from "react-native";

// Pre-scan calibration passed to ShenAI as risksFactors. Without these
// ShenAI can't compute basalMetabolicRate / totalDailyEnergyExpenditure.
export interface ShenCalibration {
  heightCm: number;
  weightKg: number;
  age: number;
  biologicalSex: "male" | "female";
}

export interface ScanResults {
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
  vascularAge: number | null;
  wellnessScore: number | null;
  // RES-121: ShenAI's energy-expenditure estimates — only non-null when
  // calibration (height/weight/age/sex) was supplied at init.
  basalMetabolicRate: number | null;
  totalDailyEnergyExpenditure: number | null;
  // RES-121 Rebounder marker: fraction ShenAI's BMR sits below the
  // Mifflin-St Jeor expectation for the user's body. Positive = depressed
  // metabolism. null when calibration or ShenAI BMR is missing.
  bmrTdeeDelta: number | null;
  // RES-121 calibration values carried on the scan record so the backend
  // typing function uses the real age/sex (not ShenAI's age estimate).
  age: number | null;
  biologicalSex: "male" | "female" | null;
}

export type FaceState =
  | "OK"
  | "NOT_CENTERED"
  | "TOO_CLOSE"
  | "TOO_FAR"
  | "NOT_VISIBLE";

export type MeasurementState =
  | "NOT_STARTED"
  | "WAITING_FOR_FACE"
  | "RUNNING"
  | "FINISHED"
  | "FAILED";

// RES-159: real-time scan-quality problems ShenAI detects while the camera is
// live. Named for the *problem* (the SDK enum is named for the desired state,
// e.g. SUFFICIENT_LIGHT_LEVEL — a violation of it means the light is too low).
// Surfacing these lets us guide the user mid-scan instead of failing after a
// timeout.
export type EnvCondition =
  | "FACE_POSITION"
  | "FOREHEAD_COVERED"
  | "GLASSES_DETECTED"
  | "LOW_LIGHT"
  | "UNEVEN_LIGHTING"
  | "BACKLIGHT"
  | "FACE_UNSTABLE"
  | "DEVICE_UNSTABLE";

function r1(v: number | null | undefined): number | null {
  return v != null ? Math.round(v) : null;
}

export function mapSdkResults(
  raw: MeasurementResults,
  health?: HealthRisks | null,
): ScanResults {
  return {
    heartRate: Math.round(raw.heartRateBpm),
    stressIndex: r1(raw.stressIndex),
    hrvSdnn: r1(raw.hrvSdnnMs),
    hrvLnrmssd: r1(raw.hrvLnrmssdMs),
    breathingRate: r1(raw.breathingRateBpm),
    systolicBP: r1(raw.systolicBloodPressureMmhg),
    diastolicBP: r1(raw.diastolicBloodPressureMmhg),
    parasympatheticActivity: r1(raw.parasympatheticActivity),
    cardiacWorkload: r1(raw.cardiacWorkloadMmhgPerSec),
    ageEstimate: r1(raw.ageYears),
    signalQuality: raw.averageSignalQuality,
    bmi: r1(raw.bmiKgPerM2),
    weightKg: r1(raw.weightKg),
    heightCm: r1(raw.heightCm),
    vascularAge: r1(health?.vascularAge ?? null),
    wellnessScore: r1(health?.wellnessScore ?? null),
    basalMetabolicRate: r1(health?.basalMetabolicRate ?? null),
    totalDailyEnergyExpenditure: r1(health?.totalDailyEnergyExpenditure ?? null),
    // These three are filled in by getScanResults once calibration is in hand.
    bmrTdeeDelta: null,
    age: null,
    biologicalSex: null,
  };
}

// Mifflin-St Jeor expected BMR (kcal/day) from calibration.
function expectedBmr(c: ShenCalibration): number {
  const base = 10 * c.weightKg + 6.25 * c.heightCm - 5 * c.age;
  return c.biologicalSex === "female" ? base - 161 : base + 5;
}

// RES-121 Rebounder marker. Positive when ShenAI's scan-derived BMR sits
// below the Mifflin-St Jeor expectation — a depressed-metabolism signal.
export function computeBmrTdeeDelta(
  shenBmr: number | null,
  calibration?: ShenCalibration,
): number | null {
  if (shenBmr == null || shenBmr <= 0 || !calibration) return null;
  const expected = expectedBmr(calibration);
  if (expected <= 0) return null;
  return (expected - shenBmr) / expected;
}

// App-Store wellness framing (Apple Guideline 1.4.1 + ShenAI rep guidance):
// the SDK's own in-scan UI renders a live tile per displayed metric, and the
// ALL_METRICS preset shows "Blood Pressure" and "Stress Index" tiles — a
// diagnostic-looking presentation Apple flags. We switch to the CUSTOM preset
// and display only heart rate, HRV, and breathing rate (the metrics with
// published clinical validation). Blood Pressure is dropped entirely; stress is
// still computed and surfaced through our own wellness "Stress Balance" band
// (see utils/stress), so we hide the SDK's raw stress tile too.
//
// instantMetrics/summaryMetrics are DISPLAY lists — they control which tiles
// the SDK paints, not what it computes. The 30s duration + RELAXED precision is
// unchanged, so getMeasurementResults() still returns stressIndex (verified on
// a physical device: real scan → "Stress Balance" band renders) and BP (which
// we keep parsing but never show).
const SCAN_DURATION_SECONDS = 30;
const DISPLAYED_METRICS: Metric[] = [
  Metric.HEART_RATE,
  Metric.HRV_SDNN,
  Metric.BREATHING_RATE,
];
// Health indices we read in mapSdkResults — keep them computed under CUSTOM.
const HEALTH_INDICES: HealthIndex[] = [
  HealthIndex.WELLNESS_SCORE,
  HealthIndex.VASCULAR_AGE,
  HealthIndex.BASAL_METABOLIC_RATE,
  HealthIndex.TOTAL_DAILY_ENERGY_EXPENDITURE,
];

// ⚠️ react-native-shenai-sdk's two native bridges disagree on the wire format
// for the CUSTOM config's enum arrays, and the shipped TypeScript types
// (Metric[] / HealthIndex[], numeric const enums) are only correct for iOS:
//
//   iOS   ShenaiSdkNativeModule.m  → [metricNumber integerValue]  (NUMBERS)
//   Android ShenaiSdkModule.java   → Metric.valueOf(array.getString(i))  (NAMES)
//
// Passing the numeric enum on Android makes getString() hit a Double, which is
// the "java.lang.Double cannot be cast to java.lang.String" crash we previously
// attributed to the CUSTOM preset itself (and worked around by leaving Android
// on ALL_METRICS, i.e. still showing BP/Stress tiles). It was never a preset
// limitation — just a marshalling mismatch. We send each platform the shape its
// bridge parses. The name strings below are verified against the AAR's enum
// constants (ai.mxlabs.shenai_sdk.ShenAIAndroidSDK$Metric / $HealthIndex);
// note the SDK's own TS enum misspells NON_ALCOHOLIC_FATTY_..., so map only the
// members we use rather than deriving names generically.
const METRIC_NAMES: Record<number, string> = {
  [Metric.HEART_RATE]: "HEART_RATE",
  [Metric.HRV_SDNN]: "HRV_SDNN",
  [Metric.BREATHING_RATE]: "BREATHING_RATE",
};
const HEALTH_INDEX_NAMES: Record<number, string> = {
  [HealthIndex.WELLNESS_SCORE]: "WELLNESS_SCORE",
  [HealthIndex.VASCULAR_AGE]: "VASCULAR_AGE",
  [HealthIndex.BASAL_METABOLIC_RATE]: "BASAL_METABOLIC_RATE",
  [HealthIndex.TOTAL_DAILY_ENERGY_EXPENDITURE]: "TOTAL_DAILY_ENERGY_EXPENDITURE",
};

// Android wants enum names, iOS wants ordinals. The cast is the point: the
// declared param type matches only the iOS bridge.
function toEnumWire<T extends number>(
  values: T[],
  names: Record<number, string>,
): T[] {
  if (Platform.OS !== "android") return values;
  return values.map((v) => names[v] ?? v) as unknown as T[];
}

export async function initShenAI(
  apiKey: string,
  calibration?: ShenCalibration,
): Promise<void> {
  const result = await initialize(apiKey, undefined, {
    measurementPreset: MeasurementPreset.CUSTOM,
    precisionMode: PrecisionMode.RELAXED,
    cameraMode: CameraMode.FACING_USER,
    // RES-133 / App Store privacy declaration: SDK 3.x defaults to
    // "on-demand server models" — model files download to the device, then
    // inference runs LOCALLY. MX Labs (Liliana, 2026-06-03) confirmed in
    // writing: with offlineProcessing unset/false, the SDK does NOT send
    // camera frames, face imagery, or PPG/biometric signal to Shen.AI servers
    // for measurement — the pipeline runs on-device. (offlineProcessing:true
    // is NOT server-vs-local; it's a heavier lockstep mode that degraded
    // real-time scans on iPhone in build 44, so we stay on the default.)
    // Conditions MX Labs gave for "no biometric image/video leaves the
    // device," which we satisfy: models pre-available before scan; measurement
    // recording disabled (see setRecordingEnabled(false) below); dashboard off.
    // ⚠️ One residual is license-level, not code: MX Labs must confirm our
    // specific license does not enable cropped-frame / image-bearing
    // diagnostic telemetry.
    // SDK 3.x UI version. Moved V1 → V3 (Bryan/Alex): V3 is ShenAI's
    // general-wellness UI layout (per MX Labs' 1.4.1 guidance). Completion
    // verified on a Galaxy S24 — V3 auto-advances FINALIZING → FINISHED with
    // showResultsFinishButton/enableSummaryScreen disabled (the July-2026 stall
    // no longer reproduces). ⚠️ Re-verify on a physical iPhone that the iOS
    // CUSTOM preset still hides BP/stress under V3 before shipping (Apple 1.4.1).
    uiVersion: UiVersion.V3,
    showUserInterface: true,
    showFacePositioningOverlay: true,
    // Red low-signal indicator so the user knows to hold still / fix lighting.
    showVisualWarnings: true,
    // 3D face-mask mesh rendered over the face on the camera feed.
    showFaceMask: true,
    // Blood-flow visualization animated over the user's face during the
    // measurement (the effect ShenAI flagged for us).
    showBloodFlow: true,
    showStartStopButton: false,
    showInfoButton: false,
    hideShenaiLogo: true,
    enableSummaryScreen: false,
    showResultsFinishButton: false,
    showSignalQualityIndicator: false,
    showSignalTile: false,
    showOutOfRangeResultIndicators: false,
    showTrialMetricLabels: false,
    enableMeasurementsDashboard: false,
    showDisclaimer: false,
    onboardingMode: OnboardingMode.HIDDEN,
    operatingMode: OperatingMode.POSITIONING,
    enableHealthRisks: true,
    saveHealthRisksFactors: true,
    // RES-121: pre-scan calibration. ShenAI needs height/weight/age/sex to
    // compute basalMetabolicRate + totalDailyEnergyExpenditure.
    ...(calibration
      ? {
          risksFactors: {
            age: calibration.age,
            bodyHeight: calibration.heightCm,
            bodyWeight: calibration.weightKg,
            gender:
              calibration.biologicalSex === "female"
                ? Gender.FEMALE
                : Gender.MALE,
          },
        }
      : {}),
  });

  // InitializationResult.OK === 0
  if (result !== 0) {
    throw new Error(`Shen AI init failed: code ${result}`);
  }

  // Explicitly disable measurement recording so no scan video/frames are ever
  // captured — a condition MX Labs gave for guaranteeing no biometric
  // image/video leaves the device, and the basis of our App Store privacy
  // declaration. We never enable recording, but we assert it defensively
  // rather than rely on the SDK default.
  await setRecordingEnabled(false);

  // Only takes effect because the preset is CUSTOM. Enum arrays go over the
  // wire per-platform — see toEnumWire.
  await setCustomMeasurementConfig({
    durationSeconds: SCAN_DURATION_SECONDS,
    instantMetrics: toEnumWire(DISPLAYED_METRICS, METRIC_NAMES),
    summaryMetrics: toEnumWire(DISPLAYED_METRICS, METRIC_NAMES),
    healthIndices: toEnumWire(HEALTH_INDICES, HEALTH_INDEX_NAMES),
  });
}

// Measurement starts automatically when in MEASURE mode and a face is detected.
export async function startScan(): Promise<void> {
  await setOperatingMode(OperatingMode.MEASURE);
}

export async function stopScan(): Promise<void> {
  await setOperatingMode(OperatingMode.POSITIONING);
}

export async function shutdownShenAI(): Promise<void> {
  try {
    await deinitialize();
  } catch {
    // Best effort cleanup
  }
}

export async function getScanResults(
  calibration?: ShenCalibration,
): Promise<ScanResults | null> {
  const raw = await getMeasurementResults();
  if (!raw) return null;
  let health: HealthRisks | null = null;
  try {
    health = await getHealthRisks();
  } catch {
    // SDK may throw if HealthRisks aren't configured; fall back to nulls.
  }
  const mapped = mapSdkResults(raw, health);
  return {
    ...mapped,
    bmrTdeeDelta: computeBmrTdeeDelta(mapped.basalMetabolicRate, calibration),
    age: calibration?.age ?? null,
    biologicalSex: calibration?.biologicalSex ?? null,
  };
}

const FACE_STATE_MAP: Record<number, FaceState> = {
  [SdkFaceState.OK]: "OK",
  [SdkFaceState.TOO_FAR]: "TOO_FAR",
  [SdkFaceState.TOO_CLOSE]: "TOO_CLOSE",
  [SdkFaceState.NOT_CENTERED]: "NOT_CENTERED",
  [SdkFaceState.NOT_VISIBLE]: "NOT_VISIBLE",
};

export async function getFaceStateValue(): Promise<FaceState> {
  const state = await sdkGetFaceState();
  return FACE_STATE_MAP[state] ?? "NOT_VISIBLE";
}

// Readiness is determined by face state being OK.
export async function isReady(): Promise<boolean> {
  const face = await sdkGetFaceState();
  return face === SdkFaceState.OK;
}

export async function getRealtimeHeartRate(): Promise<number | null> {
  return getHeartRate4s();
}

const MEASUREMENT_STATE_MAP: Record<number, MeasurementState> = {
  [SdkMeasurementState.NOT_STARTED]: "NOT_STARTED",
  [SdkMeasurementState.WAITING_FOR_FACE]: "WAITING_FOR_FACE",
  [SdkMeasurementState.RUNNING_SIGNAL_SHORT]: "RUNNING",
  [SdkMeasurementState.RUNNING_SIGNAL_GOOD]: "RUNNING",
  [SdkMeasurementState.RUNNING_SIGNAL_BAD]: "RUNNING",
  [SdkMeasurementState.RUNNING_SIGNAL_BAD_DEVICE_UNSTABLE]: "RUNNING",
  // RES-133: SDK 3.x added FINALIZING (capture done, computing final result).
  // Treat as still-running so the UI doesn't snap back to "not started".
  [SdkMeasurementState.FINALIZING]: "RUNNING",
  [SdkMeasurementState.FINISHED]: "FINISHED",
  [SdkMeasurementState.FAILED]: "FAILED",
};

export async function getMeasureState(): Promise<MeasurementState> {
  const state = await getMeasurementState();
  return MEASUREMENT_STATE_MAP[state] ?? "NOT_STARTED";
}

export async function getMeasureProgress(): Promise<number> {
  return getMeasurementProgressPercentage();
}

const ENV_CONDITION_MAP: Record<number, EnvCondition> = {
  [SdkEnvCondition.FACE_POSITION]: "FACE_POSITION",
  [SdkEnvCondition.FOREHEAD_VISIBLE]: "FOREHEAD_COVERED",
  [SdkEnvCondition.GLASSES_NOT_DETECTED]: "GLASSES_DETECTED",
  [SdkEnvCondition.SUFFICIENT_LIGHT_LEVEL]: "LOW_LIGHT",
  [SdkEnvCondition.EVEN_LIGHTING]: "UNEVEN_LIGHTING",
  [SdkEnvCondition.NO_BACKLIGHT]: "BACKLIGHT",
  [SdkEnvCondition.FACE_STABLE]: "FACE_UNSTABLE",
  [SdkEnvCondition.DEVICE_STABLE]: "DEVICE_UNSTABLE",
};

// RES-159: the highest-priority condition ShenAI is currently flagging, or null
// when the scan environment is good. ShenAI monitors these against its default
// blocking (FacePosition) + warning (forehead, lighting, backlight, stability)
// sets, so no extra init config is needed to read them.
export async function getViolatedCondition(): Promise<EnvCondition | null> {
  const code = await getCurrentViolatedMeasurementEnvironmentCondition();
  if (code == null) return null;
  return ENV_CONDITION_MAP[code] ?? null;
}

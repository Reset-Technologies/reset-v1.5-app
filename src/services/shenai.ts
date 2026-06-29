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
  OperatingMode,
  MeasurementPreset,
  PrecisionMode,
  OnboardingMode,
  CameraMode,
  UiVersion,
  Gender,
  FaceState as SdkFaceState,
  MeasurementState as SdkMeasurementState,
  MeasurementEnvironmentCondition as SdkEnvCondition,
  type MeasurementResults,
  type HealthRisks,
} from "react-native-shenai-sdk";

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

export async function initShenAI(
  apiKey: string,
  calibration?: ShenCalibration,
): Promise<void> {
  const result = await initialize(apiKey, undefined, {
    measurementPreset: MeasurementPreset.THIRTY_SECONDS_ALL_METRICS,
    precisionMode: PrecisionMode.RELAXED,
    cameraMode: CameraMode.FACING_USER,
    // RES-133: SDK 3.x defaults to "on-demand server models" — the model
    // files are fetched to the device, then inference runs locally. We use
    // that default path because forcing `offlineProcessing: true` pushed the
    // scan onto a heavier fully-local path that the device couldn't keep up
    // with in real time, degrading signal quality and making scans hard to
    // complete (build 44). TODO: confirm with MX Labs that this default does
    // not upload biometric/face data before relying on it for the App Store
    // privacy declaration.
    // SDK 3.x introduced UI V2/V3. Pin V1 to preserve the 2.11.6 scan UX
    // (face-positioning overlay only, our own React UI layered on top).
    uiVersion: UiVersion.V1,
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

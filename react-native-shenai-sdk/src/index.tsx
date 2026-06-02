import { requireNativeComponent, UIManager, Platform, type ViewProps, NativeModules } from "react-native"

const { ShenaiSdkNativeModule } = NativeModules
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const BASE64_LOOKUP = (() => {
  const lookup = new Int16Array(128)
  lookup.fill(-1)
  for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
    lookup[BASE64_ALPHABET.charCodeAt(index)] = index
  }
  return lookup
})()

const LINKING_ERROR =
  `The package '@shenai/react-native-sdk' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: "" }) +
  "- You rebuilt the app after installing the package\n" +
  "- You are not using Expo Go\n"

const ComponentName = "ShenaiSdkView"

export const ShenaiSdkView =
  UIManager.getViewManagerConfig(ComponentName) != null
    ? requireNativeComponent<ViewProps>(ComponentName)
    : () => {
        throw new Error(LINKING_ERROR)
      }

export const enum InitializationResult {
  OK = 0,
  INVALID_API_KEY,
  CONNECTION_ERROR,
  INTERNAL_ERROR
}

export const enum OperatingMode {
  POSITIONING = 0,
  MEASURE,
  SYSTEM_OVERLOADED
}

export const enum CalibrationState {
  CALIBRATED = 0,
  NOT_CALIBRATED,
  OUTDATED
}

export const enum PrecisionMode {
  STRICT = 0,
  RELAXED
}

export const enum MeasurementEnvironmentCondition {
  FACE_POSITION = 0,
  FOREHEAD_VISIBLE,
  GLASSES_NOT_DETECTED,
  SUFFICIENT_LIGHT_LEVEL,
  EVEN_LIGHTING,
  NO_BACKLIGHT,
  FACE_STABLE,
  DEVICE_STABLE
}

export const enum Screen {
  INITIALIZATION = 0,
  ONBOARDING,
  MEASUREMENT,
  INSTRUCTIONS,
  RESULTS,
  HEALTH_RISKS,
  HEALTH_RISKS_EDIT,
  CALIBRATION_ONBOARDING,
  CALIBRATION_FINISH,
  CALIBRATION_DATA_ENTRY,
  DISCLAIMER,
  DASHBOARD
}

export const enum Metric {
  HEART_RATE = 0,
  HRV_SDNN,
  BREATHING_RATE,
  SYSTOLIC_BP,
  DIASTOLIC_BP,
  CARDIAC_STRESS,
  PNS_ACTIVITY,
  CARDIAC_WORKLOAD,
  AGE,
  BMI,
  BLOOD_PRESSURE,
  BLOOD_PRESSURE_SCALE
}

export const enum BmiCategory {
  UNDERWEIGHT_SEVERE = 0,
  UNDERWEIGHT_MODERATE,
  UNDERWEIGHT_MILD,
  NORMAL,
  OVERWEIGHT,
  OBESE_CLASS_I,
  OBESE_CLASS_II,
  OBESE_CLASS_III
}

export const enum HealthIndex {
  WELLNESS_SCORE = 0,
  VASCULAR_AGE,
  CARDIOVASCULAR_DISEASE_RISK,
  HARD_AND_FATAL_EVENTS_RISKS,
  CARDIO_VASCULAR_RISK_SCORE,
  WAIST_TO_HEIGHT_RATIO,
  BODY_FAT_PERCENTAGE,
  BODY_ROUNDNESS_INDEX,
  A_BODY_SHAPE_INDEX,
  CONICITY_INDEX,
  BASAL_METABOLIC_RATE,
  TOTAL_DAILY_ENERGY_EXPENDITURE,
  HYPERTENSION_RISK,
  DIABETES_RISK,
  NON_ALCOHOLIC_FATYY_LIVER_DISEASE_RISK
}

export const enum MeasurementPreset {
  ONE_MINUTE_HR_HRV_BR = 0,
  ONE_MINUTE_BETA_METRICS,
  INFINITE_HR,
  INFINITE_METRICS,
  FOURTY_FIVE_SECONDS_UNVALIDATED,
  THIRTY_SECONDS_UNVALIDATED,
  CUSTOM,
  ONE_MINUTE_ALL_METRICS,
  FOURTY_FIVE_SECONDS_ALL_METRICS,
  THIRTY_SECONDS_ALL_METRICS,
  QUICK_HR_MODE
}

export const enum CameraMode {
  OFF = 0,
  FACING_USER,
  FACING_ENVIRONMENT,
  CUSTOM_FRAMES
}

export const enum CameraError {
  UNKNOWN = 0,
  UNSUPPORTED_MODE,
  NO_CAMERA_DEVICE,
  PERMISSION_NOT_GRANTED,
  INVALID_DEVICE_ID,
  DEVICE_UNAVAILABLE
}

export const enum OnboardingMode {
  HIDDEN = 0,
  SHOW_ONCE,
  SHOW_ALWAYS
}

export const enum UiVersion {
  V1 = 0,
  V2,
  V3
}

export const enum InitializationMode {
  MEASUREMENT = 0,
  CALIBRATION,
  CALIBRATED_MEASUREMENT,
  FAST_CALIBRATION
}

export type EventName =
  | "START_BUTTON_CLICKED"
  | "STOP_BUTTON_CLICKED"
  | "MEASUREMENT_FINISHED"
  | "USER_FLOW_FINISHED"
  | "SCREEN_CHANGED"

export interface InitializationSettings {
  precisionMode?: PrecisionMode
  operatingMode?: OperatingMode
  measurementPreset?: MeasurementPreset
  cameraMode?: CameraMode
  onboardingMode?: OnboardingMode
  initializationMode?: InitializationMode
  offlineProcessing?: boolean
  showUserInterface?: boolean
  showFacePositioningOverlay?: boolean
  showVisualWarnings?: boolean
  enableCameraSwap?: boolean
  showFaceMask?: boolean
  showBloodFlow?: boolean
  hideShenaiLogo?: boolean
  includeTimestampInPdf?: boolean
  enableStartAfterSuccess?: boolean
  enableSummaryScreen?: boolean
  showResultsFinishButton?: boolean
  enableHealthRisks?: boolean
  showHealthIndicesFinishButton?: boolean
  saveHealthRisksFactors?: boolean
  showOutOfRangeResultIndicators?: boolean
  showTrialMetricLabels?: boolean
  applyPrecisionModeToBloodPressure?: boolean
  blockingMeasurementConditions?: MeasurementEnvironmentCondition[]
  warningMeasurementConditions?: MeasurementEnvironmentCondition[]
  showSignalQualityIndicator?: boolean
  showSignalTile?: boolean
  showStartStopButton?: boolean
  showInfoButton?: boolean
  showDisclaimer?: boolean
  enableMeasurementsDashboard?: boolean
  uiVersion?: UiVersion
  uiFlowScreens?: Screen[]
  frameWidth?: number
  frameHeight?: number
  rotation?: number
  risksFactors?: RisksFactors
}

export interface CustomMeasurementConfig {
  durationSeconds?: number
  infiniteMeasurement?: boolean

  instantMetrics?: Metric[]
  summaryMetrics?: Metric[]
  healthIndices?: HealthIndex[]

  realtimeHrPeriodSeconds?: number
  realtimeHrvPeriodSeconds?: number
  realtimeCardiacStressPeriodSeconds?: number
}

export interface CustomColorTheme {
  themeColor: string
  textColor: string
  backgroundColor: string
  tileColor: string
  buttonMainColor?: string
  buttonSecondaryColor?: string
}

function ensureNativeModuleAvailable() {
  if (!ShenaiSdkNativeModule) {
    throw new Error(LINKING_ERROR)
  }
}

export async function initialize(
  apiKey: string,
  userId?: string,
  settings?: InitializationSettings
): Promise<InitializationResult> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.initialize(apiKey, userId ?? "", settings ?? {})
}

export async function isInitialized(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.isInitialized()
}

export async function deinitialize(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.deinitialize()
}

export async function setOperatingMode(operatingMode: OperatingMode): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setOperatingMode(operatingMode)
}
export async function getOperatingMode(): Promise<OperatingMode> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getOperatingMode()
}

export async function startMeasurement(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.startMeasurement()
}

export async function stopMeasurement(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.stopMeasurement()
}

export async function resetMeasurementSession(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.resetMeasurementSession()
}

export async function isReadyToStartMeasurement(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.isReadyToStartMeasurement()
}

export async function areRequiredModelsDownloaded(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.areRequiredModelsDownloaded()
}

export async function getCalibrationState(): Promise<CalibrationState> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getCalibrationState()
}

export async function setPrecisionMode(precisionMode: PrecisionMode): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setPrecisionMode(precisionMode)
}
export async function getPrecisionMode(): Promise<PrecisionMode> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getPrecisionMode()
}

export async function setApplyPrecisionModeToBloodPressure(apply: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setApplyPrecisionModeToBloodPressure(apply)
}
export async function getApplyPrecisionModeToBloodPressure(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getApplyPrecisionModeToBloodPressure()
}

export async function setBlockingMeasurementConditions(conditions: MeasurementEnvironmentCondition[]): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setBlockingMeasurementConditions(conditions)
}
export async function getBlockingMeasurementConditions(): Promise<MeasurementEnvironmentCondition[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getBlockingMeasurementConditions()
}

export async function setWarningMeasurementConditions(conditions: MeasurementEnvironmentCondition[]): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setWarningMeasurementConditions(conditions)
}
export async function getWarningMeasurementConditions(): Promise<MeasurementEnvironmentCondition[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getWarningMeasurementConditions()
}
export async function getCurrentViolatedMeasurementEnvironmentCondition(): Promise<MeasurementEnvironmentCondition | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getCurrentViolatedMeasurementEnvironmentCondition()
}

export async function setMeasurementPreset(measurementPreset: MeasurementPreset): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setMeasurementPreset(measurementPreset)
}
export async function getMeasurementPreset(): Promise<MeasurementPreset> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMeasurementPreset()
}

export async function setCustomMeasurementConfig(config: CustomMeasurementConfig): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setCustomMeasurementConfig(config)
}

export async function setCustomColorTheme(theme: CustomColorTheme): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setCustomColorTheme(theme)
}

export async function setCameraMode(cameraMode: CameraMode): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setCameraMode(cameraMode)
}
export async function getCameraMode(): Promise<CameraMode> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getCameraMode()
}
export async function getLastCameraError(): Promise<CameraError | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getLastCameraError()
}

export async function setScreen(screen: Screen): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setScreen(screen)
}
export async function getScreen(): Promise<Screen> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getScreen()
}

//* ---- SDK interface elements ---- *//

export async function setShowUserInterface(showUserInterface: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowUserInterface(showUserInterface)
}
export async function getShowUserInterface(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowUserInterface()
}

export async function setShowFacePositioningOverlay(showFacePositioningOverlay: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowFacePositioningOverlay(showFacePositioningOverlay)
}
export async function getShowFacePositioningOverlay(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowFacePositioningOverlay()
}

export async function setShowVisualWarnings(showVisualWarnings: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowVisualWarnings(showVisualWarnings)
}
export async function getShowVisualWarnings(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowVisualWarnings()
}

export async function setEnableCameraSwap(enableCameraSwap: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setEnableCameraSwap(enableCameraSwap)
}
export async function getEnableCameraSwap(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getEnableCameraSwap()
}

export async function setShowFaceMask(showFaceMask: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowFaceMask(showFaceMask)
}
export async function getShowFaceMask(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowFaceMask()
}

export async function setShowBloodFlow(showBloodFlow: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowBloodFlow(showBloodFlow)
}
export async function getShowBloodFlow(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowBloodFlow()
}

export async function setIncludeTimestampInPdf(include: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setIncludeTimestampInPdf(include)
}
export async function getIncludeTimestampInPdf(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getIncludeTimestampInPdf()
}

export async function setShowStartStopButton(show: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowStartStopButton(show)
}
export async function getShowStartStopButton(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowStartStopButton()
}

export async function setEnableMeasurementsDashboard(enable: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setEnableMeasurementsDashboard(enable)
}
export async function getEnableMeasurementsDashboard(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getEnableMeasurementsDashboard()
}

export async function setShowInfoButton(show: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setShowInfoButton(show)
}
export async function getShowInfoButton(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowInfoButton()
}

export async function getShowDisclaimer(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getShowDisclaimer()
}

export async function setEnableStartAfterSuccess(enableStartAfterSuccess: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setEnableStartAfterSuccess(enableStartAfterSuccess)
}
export async function getEnableStartAfterSuccess(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getEnableStartAfterSuccess()
}

//* ---- SDK face positioning ---- *//

export const enum FaceState {
  OK = 0,
  TOO_FAR,
  TOO_CLOSE,
  NOT_CENTERED,
  NOT_VISIBLE,
  UNKNOWN
}

export async function getFaceState(): Promise<FaceState> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getFaceState()
}

export interface NormalizedFaceBbox {
  x: number
  y: number
  width: number
  height: number
}

export async function getNormalizedFaceBbox(): Promise<NormalizedFaceBbox | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getNormalizedFaceBbox()
}

//* ---- SDK measurement state ---- *//

export const enum MeasurementState {
  NOT_STARTED = 0, // Measurement has not started yet
  WAITING_FOR_FACE, // Waiting for face to be properly positioned in the frame
  RUNNING_SIGNAL_SHORT, // Measurement started: Signal is too short for any conclusions
  RUNNING_SIGNAL_GOOD, // Measurement proceeding: Signal quality is good
  RUNNING_SIGNAL_BAD, // Measurement stalled due to poor signal quality
  RUNNING_SIGNAL_BAD_DEVICE_UNSTABLE, // Measurement stalled due to poor signal quality (because of unstable device)
  FINALIZING, // Measurement capture has ended and final result computation is in progress
  FINISHED, // Measurement has finished successfully
  FAILED // Measurement has failed
}

export async function getMeasurementState(): Promise<MeasurementState> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMeasurementState()
}

export async function getMeasurementProgressPercentage(): Promise<number> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMeasurementProgressPercentage()
}

//* ---- Event ---- *//

export const enum Event {
  START_BUTTON_CLICKED = 0,
  STOP_BUTTON_CLICKED,
  MEASUREMENT_FINISHED,
  USER_FLOW_FINISHED,
  SCREEN_CHANGED
}

/* ---- SDK measurement results ---- */

export async function getHeartRate10s(): Promise<number | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getHeartRate10s()
}

export async function getHeartRate4s(): Promise<number | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getHeartRate4s()
}

export interface Heartbeat {
  startLocationSec: number
  endLocationSec: number
  durationMs: number
}

export interface MeasurementQualityMetrics {
  ppgQualityIndex: number | null
  bcgQualityIndex: number | null
  bloodPressureQualityIndex: number | null
  expectedSbpMedianAbsErrorMmhg: number | null
  expectedSbpP80AbsErrorMmhg: number | null
  expectedSbpMeanAbsErrorMmhg: number | null
  expectedSbpBalancedMaeMmhg: number | null
  expectedDbpMedianAbsErrorMmhg: number | null
  expectedDbpP80AbsErrorMmhg: number | null
  expectedDbpMeanAbsErrorMmhg: number | null
  expectedDbpBalancedMaeMmhg: number | null
}

export interface MeasurementResults {
  heartRateBpm: number // Heart rate, rounded to 1 BPM
  hrvSdnnMs: number | null // Heart rate variability, SDNN metric, rounded to 1 ms
  hrvLnrmssdMs: number | null // Heart rate variability, lnRMSSD metric, rounded to 0.1 ms
  stressIndex: number | null // Cardiac Stress, rounded to 0.1
  parasympatheticActivity: number | null // Parasympathetic activity, rounded to 1%
  breathingRateBpm: number | null // Breathing rate, rounded to 1 BPM
  systolicBloodPressureMmhg: number | null // Systolic blood pressure, rounded to 1 mmHg
  diastolicBloodPressureMmhg: number | null // Diastolic blood pressure, rounded to 1 mmHg
  cardiacWorkloadMmhgPerSec: number | null // Cardiac workload, rounded to 1 mmHg/s
  ageYears: number | null // Age, rounded to 1 year
  bmiKgPerM2: number | null // BMI, rounded to 0.01 kg/m^2
  bmiCategory?: BmiCategory | null // BMI category
  weightKg: number | null // Weight, rounded to 1 kg
  heightCm: number | null // Height, rounded to 1 cm
  qualityMetrics: MeasurementQualityMetrics | null // Optional quality/error metrics bundle
  heartbeats: Heartbeat[] // Heartbeat locations
  averageSignalQuality: number // Average signal quality metric
}

export interface MeasurementResultsWithMetadata {
  measurementResults: MeasurementResults
  epochTimestamp: number
  isCalibration: boolean
}

export interface MeasurementResultsHistory {
  history: MeasurementResultsWithMetadata[]
}

export async function getRealtimeMetrics(periodSec: number): Promise<MeasurementResults | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getRealtimeMetrics(periodSec)
}

export async function getMeasurementResults(): Promise<MeasurementResults | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMeasurementResults()
}

export async function getMeasurementResultsHistory(): Promise<MeasurementResultsHistory | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMeasurementResultsHistory()
}

export async function getResultAsFhirObservation(): Promise<string | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getResultAsFhirObservation()
}

export async function sendResultFhirObservation(url: string): Promise<string | null> {
  ensureNativeModuleAvailable()
  const response = await ShenaiSdkNativeModule.sendResultFhirObservation(url)
  return response ?? null
}

//* ---- SDK signals ---- *//

export interface MomentaryHrValue {
  timestamp: number
  value: number
}

export async function getHeartRateHistory10s(maxTimeSec?: number): Promise<MomentaryHrValue[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getHeartRateHistory10s(maxTimeSec)
}

export async function getHeartRateHistory4s(maxTimeSec?: number): Promise<MomentaryHrValue[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getHeartRateHistory4s(maxTimeSec)
}

export async function getRealtimeHeartbeats(periodSec?: number): Promise<Heartbeat[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getRealtimeHeartbeats(periodSec)
}

export async function getFullPpgSignal(): Promise<number[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getFullPpgSignal()
}

//* ---- SDK recording ---- *//

export async function setRecordingEnabled(enabled: boolean): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setRecordingEnabled(enabled)
}

export async function getRecordingEnabled(): Promise<boolean> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getRecordingEnabled()
}

//* ---- SDK quality control ---- *//

export async function getTotalBadSignalSeconds(): Promise<number> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getTotalBadSignalSeconds()
}

export async function getCurrentSignalQualityMetric(): Promise<number> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getCurrentSignalQualityMetric()
}

//* ---- SDK visualizations ---- *//

export async function getSignalQualityMapPng(): Promise<number[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getSignalQualityMapPng()
}

export async function getFaceTexturePng(): Promise<number[]> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getFaceTexturePng()
}

export async function setLanguage(language: string): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.setLanguage(language)
}

//* ---- Health Risks ---- *//

export const enum Gender {
  MALE = 0,
  FEMALE,
  OTHER
}

export const enum PhysicalActivity {
  SEDENTARY = 0,
  LIGHTLY_ACTIVE,
  MODERATELY,
  VERY_ACTIVE,
  EXTRA_ACTIVE
}

export const enum Race {
  WHITE = 0,
  AFRICAN_AMERICAN,
  OTHER
}

export const enum HypertensionTreatment {
  NOT_NEEDED = 0,
  NO,
  YES
}

export const enum ParentalHistory {
  NONE = 0,
  ONE,
  BOTH
}

export const enum FamilyHistory {
  NONE = 0,
  NONE_FIRST_DEGREE,
  FIRST_DEGREE
}

export const enum NAFLDRisk {
  LOW = 0,
  MODERATE,
  HIGH
}

export interface HardAndFatalEventsRisks {
  coronaryDeathEventRisk: number | null
  fatalStrokeEventRisk: number | null
  totalCVMortalityRisk: number | null
  hardCVEventRisk: number | null
}

export interface CVDiseasesRisks {
  overallRisk: number | null
  coronaryHeartDiseaseRisk: number | null
  strokeRisk: number | null
  heartFailureRisk: number | null
  peripheralVascularDiseaseRisk: number | null
}

export interface RisksFactorsScores {
  ageScore: number | null
  sbpScore: number | null
  smokingScore: number | null
  diabetesScore: number | null
  bmiScore: number | null
  cholesterolScore: number | null
  cholesterolHdlScore: number | null
  totalScore: number | null
}

export interface HealthRisks {
  wellnessScore: number | null
  hardAndFatalEvents: HardAndFatalEventsRisks
  cvDiseases: CVDiseasesRisks
  vascularAge: number | null
  waistToHeightRatio: number | null
  bodyFatPercentage: number | null
  basalMetabolicRate: number | null
  bodyRoundnessIndex: number | null
  conicityIndex: number | null
  aBodyShapeIndex: number | null
  totalDailyEnergyExpenditure: number | null
  scores: RisksFactorsScores
  hypertensionRisk?: number | null
  diabetesRisk?: number | null
  nonAlcoholicFattyLiverDiseaseRisk?: NAFLDRisk | null
}

export interface RisksFactors {
  age?: number
  cholesterol?: number
  cholesterolHdl?: number
  sbp?: number
  dbp?: number
  isSmoker?: boolean
  hypertensionTreatment?: HypertensionTreatment
  hasDiabetes?: boolean
  bodyHeight?: number // in centimeters
  bodyWeight?: number // in kilograms
  waistCircumference?: number // in centimeters
  neckCircumference?: number // in centimeters
  hipCircumference?: number // in centimeters
  gender?: Gender
  physicalActivity?: PhysicalActivity
  country?: string // country name ISO code: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
  race?: Race
  vegetableFruitDiet?: boolean
  historyOfHypertension?: boolean
  historyOfHighGlucose?: boolean
  fastingGlucose?: number
  triglyceride?: number
  parentalHypertension?: ParentalHistory
  familyDiabetes?: FamilyHistory
}

export async function getHealthRisksFactors(): Promise<RisksFactors> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getHealthRisksFactors()
}

export async function clearHealthRisksFactors(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.clearHealthRisksFactors()
}

export async function getHealthRisks(): Promise<HealthRisks> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getHealthRisks()
}

export async function computeHealthRisks(factors: RisksFactors): Promise<HealthRisks> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.computeHealthRisks(factors)
}

export async function getMaximalRisks(factors: RisksFactors): Promise<HealthRisks> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMaximalRisks(factors)
}

export async function getMinimalRisks(factors: RisksFactors): Promise<HealthRisks> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMinimalRisks(factors)
}

export async function getReferenceRisks(factors: RisksFactors): Promise<HealthRisks> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getReferenceRisks(factors)
}

export async function openMeasurementResultsPdfInBrowser(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.openMeasurementResultsPdfInBrowser()
}

export async function sendMeasurementResultsPdfToEmail(email: string): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.sendMeasurementResultsPdfToEmail(email)
}

export async function requestMeasurementResultsPdfUrl(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.requestMeasurementResultsPdfUrl()
}

export async function getMeasurementResultsPdfUrl(): Promise<string | null> {
  ensureNativeModuleAvailable()
  return ShenaiSdkNativeModule.getMeasurementResultsPdfUrl()
}

export async function requestMeasurementResultsPdfBytes(): Promise<void> {
  ensureNativeModuleAvailable()
  await ShenaiSdkNativeModule.requestMeasurementResultsPdfBytes()
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  const outputLength = Math.floor((base64.length * 3) / 4) - padding
  const bytes = new Uint8Array(outputLength)

  let buffer = 0
  let bitsCollected = 0
  let outputIndex = 0

  for (let index = 0; index < base64.length; index += 1) {
    const charCode = base64.charCodeAt(index)
    if (charCode === 61) {
      break
    }
    if (charCode >= BASE64_LOOKUP.length) {
      continue
    }

    const value = BASE64_LOOKUP[charCode]
    if (value === undefined || value < 0) {
      continue
    }

    buffer = (buffer << 6) | value
    bitsCollected += 6
    if (bitsCollected < 8) {
      continue
    }

    bitsCollected -= 8
    bytes[outputIndex] = (buffer >> bitsCollected) & 0xff
    outputIndex += 1
  }

  return bytes
}

export async function getMeasurementResultsPdfBytes(): Promise<number[] | null> {
  ensureNativeModuleAvailable()
  const response = await ShenaiSdkNativeModule.getMeasurementResultsPdfBytes()
  if (typeof response === "string" && response.length > 0) {
    return Array.from(decodeBase64ToUint8Array(response))
  }
  if (Array.isArray(response)) {
    return response
  }
  return null
}

export * from "./hooks"

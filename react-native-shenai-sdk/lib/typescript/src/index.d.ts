import { type ViewProps } from "react-native";
export declare const ShenaiSdkView: import("react-native").HostComponent<ViewProps> | (() => never);
export declare const enum InitializationResult {
    OK = 0,
    INVALID_API_KEY = 1,
    CONNECTION_ERROR = 2,
    INTERNAL_ERROR = 3
}
export declare const enum OperatingMode {
    POSITIONING = 0,
    MEASURE = 1,
    SYSTEM_OVERLOADED = 2
}
export declare const enum CalibrationState {
    CALIBRATED = 0,
    NOT_CALIBRATED = 1,
    OUTDATED = 2
}
export declare const enum PrecisionMode {
    STRICT = 0,
    RELAXED = 1
}
export declare const enum MeasurementEnvironmentCondition {
    FACE_POSITION = 0,
    FOREHEAD_VISIBLE = 1,
    GLASSES_NOT_DETECTED = 2,
    SUFFICIENT_LIGHT_LEVEL = 3,
    EVEN_LIGHTING = 4,
    NO_BACKLIGHT = 5,
    FACE_STABLE = 6,
    DEVICE_STABLE = 7
}
export declare const enum Screen {
    INITIALIZATION = 0,
    ONBOARDING = 1,
    MEASUREMENT = 2,
    INSTRUCTIONS = 3,
    RESULTS = 4,
    HEALTH_RISKS = 5,
    HEALTH_RISKS_EDIT = 6,
    CALIBRATION_ONBOARDING = 7,
    CALIBRATION_FINISH = 8,
    CALIBRATION_DATA_ENTRY = 9,
    DISCLAIMER = 10,
    DASHBOARD = 11
}
export declare const enum Metric {
    HEART_RATE = 0,
    HRV_SDNN = 1,
    BREATHING_RATE = 2,
    SYSTOLIC_BP = 3,
    DIASTOLIC_BP = 4,
    CARDIAC_STRESS = 5,
    PNS_ACTIVITY = 6,
    CARDIAC_WORKLOAD = 7,
    AGE = 8,
    BMI = 9,
    BLOOD_PRESSURE = 10,
    BLOOD_PRESSURE_SCALE = 11
}
export declare const enum BmiCategory {
    UNDERWEIGHT_SEVERE = 0,
    UNDERWEIGHT_MODERATE = 1,
    UNDERWEIGHT_MILD = 2,
    NORMAL = 3,
    OVERWEIGHT = 4,
    OBESE_CLASS_I = 5,
    OBESE_CLASS_II = 6,
    OBESE_CLASS_III = 7
}
export declare const enum HealthIndex {
    WELLNESS_SCORE = 0,
    VASCULAR_AGE = 1,
    CARDIOVASCULAR_DISEASE_RISK = 2,
    HARD_AND_FATAL_EVENTS_RISKS = 3,
    CARDIO_VASCULAR_RISK_SCORE = 4,
    WAIST_TO_HEIGHT_RATIO = 5,
    BODY_FAT_PERCENTAGE = 6,
    BODY_ROUNDNESS_INDEX = 7,
    A_BODY_SHAPE_INDEX = 8,
    CONICITY_INDEX = 9,
    BASAL_METABOLIC_RATE = 10,
    TOTAL_DAILY_ENERGY_EXPENDITURE = 11,
    HYPERTENSION_RISK = 12,
    DIABETES_RISK = 13,
    NON_ALCOHOLIC_FATYY_LIVER_DISEASE_RISK = 14
}
export declare const enum MeasurementPreset {
    ONE_MINUTE_HR_HRV_BR = 0,
    ONE_MINUTE_BETA_METRICS = 1,
    INFINITE_HR = 2,
    INFINITE_METRICS = 3,
    FOURTY_FIVE_SECONDS_UNVALIDATED = 4,
    THIRTY_SECONDS_UNVALIDATED = 5,
    CUSTOM = 6,
    ONE_MINUTE_ALL_METRICS = 7,
    FOURTY_FIVE_SECONDS_ALL_METRICS = 8,
    THIRTY_SECONDS_ALL_METRICS = 9,
    QUICK_HR_MODE = 10
}
export declare const enum CameraMode {
    OFF = 0,
    FACING_USER = 1,
    FACING_ENVIRONMENT = 2,
    CUSTOM_FRAMES = 3
}
export declare const enum CameraError {
    UNKNOWN = 0,
    UNSUPPORTED_MODE = 1,
    NO_CAMERA_DEVICE = 2,
    PERMISSION_NOT_GRANTED = 3,
    INVALID_DEVICE_ID = 4,
    DEVICE_UNAVAILABLE = 5
}
export declare const enum OnboardingMode {
    HIDDEN = 0,
    SHOW_ONCE = 1,
    SHOW_ALWAYS = 2
}
export declare const enum UiVersion {
    V1 = 0,
    V2 = 1,
    V3 = 2
}
export declare const enum InitializationMode {
    MEASUREMENT = 0,
    CALIBRATION = 1,
    CALIBRATED_MEASUREMENT = 2,
    FAST_CALIBRATION = 3
}
export type EventName = "START_BUTTON_CLICKED" | "STOP_BUTTON_CLICKED" | "MEASUREMENT_FINISHED" | "USER_FLOW_FINISHED" | "SCREEN_CHANGED";
export interface InitializationSettings {
    precisionMode?: PrecisionMode;
    operatingMode?: OperatingMode;
    measurementPreset?: MeasurementPreset;
    cameraMode?: CameraMode;
    onboardingMode?: OnboardingMode;
    initializationMode?: InitializationMode;
    offlineProcessing?: boolean;
    showUserInterface?: boolean;
    showFacePositioningOverlay?: boolean;
    showVisualWarnings?: boolean;
    enableCameraSwap?: boolean;
    showFaceMask?: boolean;
    showBloodFlow?: boolean;
    hideShenaiLogo?: boolean;
    includeTimestampInPdf?: boolean;
    enableStartAfterSuccess?: boolean;
    enableSummaryScreen?: boolean;
    showResultsFinishButton?: boolean;
    enableHealthRisks?: boolean;
    showHealthIndicesFinishButton?: boolean;
    saveHealthRisksFactors?: boolean;
    showOutOfRangeResultIndicators?: boolean;
    showTrialMetricLabels?: boolean;
    applyPrecisionModeToBloodPressure?: boolean;
    blockingMeasurementConditions?: MeasurementEnvironmentCondition[];
    warningMeasurementConditions?: MeasurementEnvironmentCondition[];
    showSignalQualityIndicator?: boolean;
    showSignalTile?: boolean;
    showStartStopButton?: boolean;
    showInfoButton?: boolean;
    showDisclaimer?: boolean;
    enableMeasurementsDashboard?: boolean;
    uiVersion?: UiVersion;
    uiFlowScreens?: Screen[];
    frameWidth?: number;
    frameHeight?: number;
    rotation?: number;
    risksFactors?: RisksFactors;
}
export interface CustomMeasurementConfig {
    durationSeconds?: number;
    infiniteMeasurement?: boolean;
    instantMetrics?: Metric[];
    summaryMetrics?: Metric[];
    healthIndices?: HealthIndex[];
    realtimeHrPeriodSeconds?: number;
    realtimeHrvPeriodSeconds?: number;
    realtimeCardiacStressPeriodSeconds?: number;
}
export interface CustomColorTheme {
    themeColor: string;
    textColor: string;
    backgroundColor: string;
    tileColor: string;
    buttonMainColor?: string;
    buttonSecondaryColor?: string;
}
export declare function initialize(apiKey: string, userId?: string, settings?: InitializationSettings): Promise<InitializationResult>;
export declare function isInitialized(): Promise<boolean>;
export declare function deinitialize(): Promise<void>;
export declare function setOperatingMode(operatingMode: OperatingMode): Promise<void>;
export declare function getOperatingMode(): Promise<OperatingMode>;
export declare function startMeasurement(): Promise<void>;
export declare function stopMeasurement(): Promise<void>;
export declare function resetMeasurementSession(): Promise<void>;
export declare function isReadyToStartMeasurement(): Promise<boolean>;
export declare function areRequiredModelsDownloaded(): Promise<boolean>;
export declare function getCalibrationState(): Promise<CalibrationState>;
export declare function setPrecisionMode(precisionMode: PrecisionMode): Promise<void>;
export declare function getPrecisionMode(): Promise<PrecisionMode>;
export declare function setApplyPrecisionModeToBloodPressure(apply: boolean): Promise<void>;
export declare function getApplyPrecisionModeToBloodPressure(): Promise<boolean>;
export declare function setBlockingMeasurementConditions(conditions: MeasurementEnvironmentCondition[]): Promise<void>;
export declare function getBlockingMeasurementConditions(): Promise<MeasurementEnvironmentCondition[]>;
export declare function setWarningMeasurementConditions(conditions: MeasurementEnvironmentCondition[]): Promise<void>;
export declare function getWarningMeasurementConditions(): Promise<MeasurementEnvironmentCondition[]>;
export declare function getCurrentViolatedMeasurementEnvironmentCondition(): Promise<MeasurementEnvironmentCondition | null>;
export declare function setMeasurementPreset(measurementPreset: MeasurementPreset): Promise<void>;
export declare function getMeasurementPreset(): Promise<MeasurementPreset>;
export declare function setCustomMeasurementConfig(config: CustomMeasurementConfig): Promise<void>;
export declare function setCustomColorTheme(theme: CustomColorTheme): Promise<void>;
export declare function setCameraMode(cameraMode: CameraMode): Promise<void>;
export declare function getCameraMode(): Promise<CameraMode>;
export declare function getLastCameraError(): Promise<CameraError | null>;
export declare function setScreen(screen: Screen): Promise<void>;
export declare function getScreen(): Promise<Screen>;
export declare function setShowUserInterface(showUserInterface: boolean): Promise<void>;
export declare function getShowUserInterface(): Promise<boolean>;
export declare function setShowFacePositioningOverlay(showFacePositioningOverlay: boolean): Promise<void>;
export declare function getShowFacePositioningOverlay(): Promise<boolean>;
export declare function setShowVisualWarnings(showVisualWarnings: boolean): Promise<void>;
export declare function getShowVisualWarnings(): Promise<boolean>;
export declare function setEnableCameraSwap(enableCameraSwap: boolean): Promise<void>;
export declare function getEnableCameraSwap(): Promise<boolean>;
export declare function setShowFaceMask(showFaceMask: boolean): Promise<void>;
export declare function getShowFaceMask(): Promise<boolean>;
export declare function setShowBloodFlow(showBloodFlow: boolean): Promise<void>;
export declare function getShowBloodFlow(): Promise<boolean>;
export declare function setIncludeTimestampInPdf(include: boolean): Promise<void>;
export declare function getIncludeTimestampInPdf(): Promise<boolean>;
export declare function setShowStartStopButton(show: boolean): Promise<void>;
export declare function getShowStartStopButton(): Promise<boolean>;
export declare function setEnableMeasurementsDashboard(enable: boolean): Promise<void>;
export declare function getEnableMeasurementsDashboard(): Promise<boolean>;
export declare function setShowInfoButton(show: boolean): Promise<void>;
export declare function getShowInfoButton(): Promise<boolean>;
export declare function getShowDisclaimer(): Promise<boolean>;
export declare function setEnableStartAfterSuccess(enableStartAfterSuccess: boolean): Promise<void>;
export declare function getEnableStartAfterSuccess(): Promise<boolean>;
export declare const enum FaceState {
    OK = 0,
    TOO_FAR = 1,
    TOO_CLOSE = 2,
    NOT_CENTERED = 3,
    NOT_VISIBLE = 4,
    UNKNOWN = 5
}
export declare function getFaceState(): Promise<FaceState>;
export interface NormalizedFaceBbox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare function getNormalizedFaceBbox(): Promise<NormalizedFaceBbox | null>;
export declare const enum MeasurementState {
    NOT_STARTED = 0,// Measurement has not started yet
    WAITING_FOR_FACE = 1,// Waiting for face to be properly positioned in the frame
    RUNNING_SIGNAL_SHORT = 2,// Measurement started: Signal is too short for any conclusions
    RUNNING_SIGNAL_GOOD = 3,// Measurement proceeding: Signal quality is good
    RUNNING_SIGNAL_BAD = 4,// Measurement stalled due to poor signal quality
    RUNNING_SIGNAL_BAD_DEVICE_UNSTABLE = 5,// Measurement stalled due to poor signal quality (because of unstable device)
    FINALIZING = 6,// Measurement capture has ended and final result computation is in progress
    FINISHED = 7,// Measurement has finished successfully
    FAILED = 8
}
export declare function getMeasurementState(): Promise<MeasurementState>;
export declare function getMeasurementProgressPercentage(): Promise<number>;
export declare const enum Event {
    START_BUTTON_CLICKED = 0,
    STOP_BUTTON_CLICKED = 1,
    MEASUREMENT_FINISHED = 2,
    USER_FLOW_FINISHED = 3,
    SCREEN_CHANGED = 4
}
export declare function getHeartRate10s(): Promise<number | null>;
export declare function getHeartRate4s(): Promise<number | null>;
export interface Heartbeat {
    startLocationSec: number;
    endLocationSec: number;
    durationMs: number;
}
export interface MeasurementQualityMetrics {
    ppgQualityIndex: number | null;
    bcgQualityIndex: number | null;
    bloodPressureQualityIndex: number | null;
    expectedSbpMedianAbsErrorMmhg: number | null;
    expectedSbpP80AbsErrorMmhg: number | null;
    expectedSbpMeanAbsErrorMmhg: number | null;
    expectedSbpBalancedMaeMmhg: number | null;
    expectedDbpMedianAbsErrorMmhg: number | null;
    expectedDbpP80AbsErrorMmhg: number | null;
    expectedDbpMeanAbsErrorMmhg: number | null;
    expectedDbpBalancedMaeMmhg: number | null;
}
export interface MeasurementResults {
    heartRateBpm: number;
    hrvSdnnMs: number | null;
    hrvLnrmssdMs: number | null;
    stressIndex: number | null;
    parasympatheticActivity: number | null;
    breathingRateBpm: number | null;
    systolicBloodPressureMmhg: number | null;
    diastolicBloodPressureMmhg: number | null;
    cardiacWorkloadMmhgPerSec: number | null;
    ageYears: number | null;
    bmiKgPerM2: number | null;
    bmiCategory?: BmiCategory | null;
    weightKg: number | null;
    heightCm: number | null;
    qualityMetrics: MeasurementQualityMetrics | null;
    heartbeats: Heartbeat[];
    averageSignalQuality: number;
}
export interface MeasurementResultsWithMetadata {
    measurementResults: MeasurementResults;
    epochTimestamp: number;
    isCalibration: boolean;
}
export interface MeasurementResultsHistory {
    history: MeasurementResultsWithMetadata[];
}
export declare function getRealtimeMetrics(periodSec: number): Promise<MeasurementResults | null>;
export declare function getMeasurementResults(): Promise<MeasurementResults | null>;
export declare function getMeasurementResultsHistory(): Promise<MeasurementResultsHistory | null>;
export declare function getResultAsFhirObservation(): Promise<string | null>;
export declare function sendResultFhirObservation(url: string): Promise<string | null>;
export interface MomentaryHrValue {
    timestamp: number;
    value: number;
}
export declare function getHeartRateHistory10s(maxTimeSec?: number): Promise<MomentaryHrValue[]>;
export declare function getHeartRateHistory4s(maxTimeSec?: number): Promise<MomentaryHrValue[]>;
export declare function getRealtimeHeartbeats(periodSec?: number): Promise<Heartbeat[]>;
export declare function getFullPpgSignal(): Promise<number[]>;
export declare function setRecordingEnabled(enabled: boolean): Promise<void>;
export declare function getRecordingEnabled(): Promise<boolean>;
export declare function getTotalBadSignalSeconds(): Promise<number>;
export declare function getCurrentSignalQualityMetric(): Promise<number>;
export declare function getSignalQualityMapPng(): Promise<number[]>;
export declare function getFaceTexturePng(): Promise<number[]>;
export declare function setLanguage(language: string): Promise<void>;
export declare const enum Gender {
    MALE = 0,
    FEMALE = 1,
    OTHER = 2
}
export declare const enum PhysicalActivity {
    SEDENTARY = 0,
    LIGHTLY_ACTIVE = 1,
    MODERATELY = 2,
    VERY_ACTIVE = 3,
    EXTRA_ACTIVE = 4
}
export declare const enum Race {
    WHITE = 0,
    AFRICAN_AMERICAN = 1,
    OTHER = 2
}
export declare const enum HypertensionTreatment {
    NOT_NEEDED = 0,
    NO = 1,
    YES = 2
}
export declare const enum ParentalHistory {
    NONE = 0,
    ONE = 1,
    BOTH = 2
}
export declare const enum FamilyHistory {
    NONE = 0,
    NONE_FIRST_DEGREE = 1,
    FIRST_DEGREE = 2
}
export declare const enum NAFLDRisk {
    LOW = 0,
    MODERATE = 1,
    HIGH = 2
}
export interface HardAndFatalEventsRisks {
    coronaryDeathEventRisk: number | null;
    fatalStrokeEventRisk: number | null;
    totalCVMortalityRisk: number | null;
    hardCVEventRisk: number | null;
}
export interface CVDiseasesRisks {
    overallRisk: number | null;
    coronaryHeartDiseaseRisk: number | null;
    strokeRisk: number | null;
    heartFailureRisk: number | null;
    peripheralVascularDiseaseRisk: number | null;
}
export interface RisksFactorsScores {
    ageScore: number | null;
    sbpScore: number | null;
    smokingScore: number | null;
    diabetesScore: number | null;
    bmiScore: number | null;
    cholesterolScore: number | null;
    cholesterolHdlScore: number | null;
    totalScore: number | null;
}
export interface HealthRisks {
    wellnessScore: number | null;
    hardAndFatalEvents: HardAndFatalEventsRisks;
    cvDiseases: CVDiseasesRisks;
    vascularAge: number | null;
    waistToHeightRatio: number | null;
    bodyFatPercentage: number | null;
    basalMetabolicRate: number | null;
    bodyRoundnessIndex: number | null;
    conicityIndex: number | null;
    aBodyShapeIndex: number | null;
    totalDailyEnergyExpenditure: number | null;
    scores: RisksFactorsScores;
    hypertensionRisk?: number | null;
    diabetesRisk?: number | null;
    nonAlcoholicFattyLiverDiseaseRisk?: NAFLDRisk | null;
}
export interface RisksFactors {
    age?: number;
    cholesterol?: number;
    cholesterolHdl?: number;
    sbp?: number;
    dbp?: number;
    isSmoker?: boolean;
    hypertensionTreatment?: HypertensionTreatment;
    hasDiabetes?: boolean;
    bodyHeight?: number;
    bodyWeight?: number;
    waistCircumference?: number;
    neckCircumference?: number;
    hipCircumference?: number;
    gender?: Gender;
    physicalActivity?: PhysicalActivity;
    country?: string;
    race?: Race;
    vegetableFruitDiet?: boolean;
    historyOfHypertension?: boolean;
    historyOfHighGlucose?: boolean;
    fastingGlucose?: number;
    triglyceride?: number;
    parentalHypertension?: ParentalHistory;
    familyDiabetes?: FamilyHistory;
}
export declare function getHealthRisksFactors(): Promise<RisksFactors>;
export declare function clearHealthRisksFactors(): Promise<void>;
export declare function getHealthRisks(): Promise<HealthRisks>;
export declare function computeHealthRisks(factors: RisksFactors): Promise<HealthRisks>;
export declare function getMaximalRisks(factors: RisksFactors): Promise<HealthRisks>;
export declare function getMinimalRisks(factors: RisksFactors): Promise<HealthRisks>;
export declare function getReferenceRisks(factors: RisksFactors): Promise<HealthRisks>;
export declare function openMeasurementResultsPdfInBrowser(): Promise<void>;
export declare function sendMeasurementResultsPdfToEmail(email: string): Promise<void>;
export declare function requestMeasurementResultsPdfUrl(): Promise<void>;
export declare function getMeasurementResultsPdfUrl(): Promise<string | null>;
export declare function requestMeasurementResultsPdfBytes(): Promise<void>;
export declare function getMeasurementResultsPdfBytes(): Promise<number[] | null>;
export * from "./hooks";
//# sourceMappingURL=index.d.ts.map
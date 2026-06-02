#pragma once

#include <any>
#include <array>
#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "bmi.h"
#include "health_risks.h"

#define SHEN_PUBLIC_API __attribute__((visibility("default"))) __attribute__((used))

namespace cv {
class Mat;
}

/**
 * This is a minimal C++ API surface for Shen AI SDK.
 * Only one instance of the SDK exists at a time.
 */

namespace shen {

/**
 * The precision mode of the SDK.
 */
enum class PrecisionMode { Strict = 0, Relaxed };

/**
 * Environment-related conditions used for pre-measurement checks.
 */
enum class MeasurementEnvironmentCondition {
  FacePosition = 0,
  ForeheadVisible,
  GlassesNotDetected,
  SufficientLightLevel,
  EvenLighting,
  NoBacklight,
  FaceStable,
  DeviceStable
};
inline constexpr size_t kMeasurementEnvironmentConditionCount = 8;

inline constexpr std::array kDefaultBlockingMeasurementEnvironmentConditions{
    MeasurementEnvironmentCondition::FacePosition};
inline constexpr std::array kDefaultWarningMeasurementEnvironmentConditions{
    MeasurementEnvironmentCondition::ForeheadVisible, MeasurementEnvironmentCondition::SufficientLightLevel,
    MeasurementEnvironmentCondition::EvenLighting,    MeasurementEnvironmentCondition::NoBacklight,
    MeasurementEnvironmentCondition::FaceStable,      MeasurementEnvironmentCondition::DeviceStable};

inline std::vector<MeasurementEnvironmentCondition> defaultBlockingMeasurementConditions() {
  return {kDefaultBlockingMeasurementEnvironmentConditions.begin(),
          kDefaultBlockingMeasurementEnvironmentConditions.end()};
}

inline std::vector<MeasurementEnvironmentCondition> defaultWarningMeasurementConditions() {
  return {kDefaultWarningMeasurementEnvironmentConditions.begin(),
          kDefaultWarningMeasurementEnvironmentConditions.end()};
}

/**
 * The current screen displayed by the SDK.
 */
enum class Screen {
  Initialization = 0,
  Onboarding,
  Measurement,
  Instructions,
  Results,
  HealthRisks,
  HealthRisksEdit,
  CalibrationOnboarding,
  CalibrationFinish,
  EnterId,
  CalibrationDataEntry,
  History,
  Disclaimer,
  Dashboard
};

/**
 * The operating mode of the SDK.
 */
enum class OperatingMode { Positioning = 0, Measure, SystemOverloaded };

/**
 * The available metrics for the measurement session.
 */
enum class Metric {
  HeartRate,
  HrvSdnn,
  BreathingRate,
  SystolicBp,
  DiastolicBp,
  CardiacStress,
  PnsActivity,
  CardiacWorkload,
  Age,
  Bmi,
  BloodPressure,
  BloodPressureScale
};

/**
 * The available health indices the measurement session.
 */

enum class HealthIndex {
  WellnessScore,
  VascularAge,
  CardiovascularDiseaseRisk,
  HardAndFatalEventsRisks,
  CardiovascularRiskScore,
  WaistToHeightRatio,
  BodyFatPercentage,
  BodyRoundnessIndex,
  ABodyShapeIndex,
  ConicityIndex,
  BasalMetabolicRate,
  TotalDailyEnergyExpenditure,
  HypertensionRisk,
  DiabetesRisk,
  NonAlcoholicFattyLiverDiseaseRisk
};

/**
 * Publicly available presets for the measurement session.
 */
enum class MeasurementPreset {
  OneMinuteHrHrvBr = 0,
  OneMinuteBetaMetrics,
  InfiniteHr,
  InfiniteMetrics,
  FourtyFiveSecondsUnvalidated,
  ThirtySecondsUnvalidated,
  Custom,
  OneMinuteAllMetrics,
  FourtyFiveSecondsAllMetrics,
  ThirtySecondsAllMetrics,
  QuickHrMode
};

/*
 * SDK flow mode
 */
enum class InitializationMode { Measurement = 0, Calibration, CalibratedMeasurement, FastCalibration };

/*
 * Calibration state
 */
enum class CalibrationState { Calibrated = 0, NotCalibrated, Outdated };

/**
 * Configuration for a custom measurement session.
 */
struct custom_measurement_config {
  std::optional<float> duration_seconds;
  std::optional<bool> infinite_measurement;

  std::vector<Metric> instant_metrics;
  std::vector<Metric> summary_metrics;
  std::vector<HealthIndex> health_indices;

  std::optional<float> realtime_hr_period_seconds;
  std::optional<float> realtime_hrv_period_seconds;
  std::optional<float> realtime_cardiac_stress_period_seconds;
};

/**
 * Calibration result data
 */
struct calibration_data {
  std::vector<std::string> sbps, dbps, pulses, sdk_sbps, sdk_dbps, sdk_pulses, measurement_ids;
  std::string trace_id;
};

/**
 * Configuration for a custom color theme.
 */
struct custom_color_theme {
  std::string theme_color;
  std::string text_color;
  std::string background_color;
  std::string tile_color;
  std::string button_main_color;
  std::string button_secondary_color;
};

/**
 * Camera modes for the SDK.
 */
enum class CameraMode {
  Off = 0,
  FacingUser = 1,
  FacingEnvironment = 2,
  DeviceId = 3,
#ifdef __EMSCRIPTEN__
  MediaStream = 4,
#else
  CustomFrames = 5,
#endif
};

/**
 * Camera startup error exposed by the SDK.
 */
enum class CameraError {
  Unknown = 0,
  UnsupportedMode = 1,
  NoCameraDevice = 2,
  PermissionNotGranted = 3,
  InvalidDeviceId = 4,
  DeviceUnavailable = 5,
};

#ifndef __EMSCRIPTEN__
/**
 * Metadata attached to frames submitted in CustomFrames mode.
 */
struct frame_metadata {
  // Optional input. When provided, this should be a monotonic capture timestamp in microseconds.
  // If set to a negative value, the SDK synthesizes a monotonic submission-time timestamp internally.
  int64_t timestampUs{-1};
  bool cameraFacingUser{true};
  std::optional<int> cameraDeviceId;
  std::optional<double> cameraFieldOfViewYDegrees;
};
#endif

/**
 * User onboarding mode
 */
enum class OnboardingMode { Hidden = 0, ShowOnce, ShowAlways };

/**
 * UI version for SDK screens.
 */
enum class UiVersion { V1 = 0, V2, V3 };

/**
 * Events that can be sent to the event callback.
 */
enum class Event {
  START_BUTTON_CLICKED,
  STOP_BUTTON_CLICKED,
  MEASUREMENT_FINISHED,
  USER_FLOW_FINISHED,
  SCREEN_CHANGED
};

/**
 * Additional settings for the initialization.
 */
struct initialization_settings {
  PrecisionMode precisionMode{PrecisionMode::Strict};
  OperatingMode operatingMode{OperatingMode::Positioning};
  MeasurementPreset measurementPreset{MeasurementPreset::OneMinuteBetaMetrics};
  CameraMode cameraMode{CameraMode::FacingUser};
  double cameraAspectRatio{0.};
  OnboardingMode onboardingMode{OnboardingMode::ShowOnce};
  InitializationMode initializationMode{InitializationMode::Measurement};

  bool showUserInterface{true};
  bool showFacePositioningOverlay{true};
  bool showVisualWarnings{true};
  bool enableCameraSwap{true};
  bool showFaceMask{true};
  bool showBloodFlow{true};
  bool hideShenaiLogo{true};
  bool includeTimestampInPdf{true};
  bool enableStartAfterSuccess{true};
  bool enableSummaryScreen{true};
  bool showResultsFinishButton{true};
  bool enableHealthRisks{true};
  bool showHealthIndicesFinishButton{true};
  bool saveHealthRisksFactors{true};
  bool showOutOfRangeResultIndicators{true};
  bool showTrialMetricLabels{false};
  bool showExpectedErrors{false};
  bool applyPrecisionModeToBloodPressure{false};
  bool enableFullFrameProcessing{false};
  bool showSignalQualityIndicator{true};
  bool showSignalTile{true};
  bool showStartStopButton{true};
  bool showInfoButton{true};
  bool showDisclaimer{false};
  bool enableMeasurementsDashboard{true};
  UiVersion uiVersion{UiVersion::V2};
  std::vector<MeasurementEnvironmentCondition> blockingMeasurementConditions = defaultBlockingMeasurementConditions();
  std::vector<MeasurementEnvironmentCondition> warningMeasurementConditions = defaultWarningMeasurementConditions();

  std::vector<shen::Screen> uiFlowScreens;

  std::optional<int> rotation;                   // degrees
  std::optional<std::pair<int, int>> frameSize;  // (width, height)

  std::string language{"auto"};
  std::optional<custom_measurement_config> customMeasurementConfig;
  std::optional<custom_color_theme> customColorTheme;
  std::optional<std::string> pdfLogoId;
  std::optional<mx::health_risks::RisksFactors> risksFactors;

  std::function<void(Event)> eventCallback;

  bool offlineProcessing{false};
};

/**
 * The result of the SDK initialization.
 */
enum class InitializationResult { Success = 0, FailureInvalidApiKey, FailureConnectionError, FailureInternalError };

/**
 * Gets version of the SDK.
 */
SHEN_PUBLIC_API std::string GetVersion();

/**
 * Initializes the SDK.
 * This function must be called before any other function in this API (except for IsInitialized()).
 *
 * @param api_key The API key to use for license validation.
 * @param user_id The user ID to use for license validation (optional).
 * @param settings Additional settings for the initialization (optional).
 * @return The result of the initialization. If the SDK has previously been initialized and not deinitialized, this
 * function will return Success immediately.
 */
SHEN_PUBLIC_API InitializationResult Initialize(std::string api_key, std::string user_id = "",
                                                initialization_settings settings = {});

/**
 * Checks if the SDK has been successfully initialized.
 * @return True if the SDK has been successfully initialized, false otherwise.
 */
SHEN_PUBLIC_API bool IsInitialized();

/**
 * Deinitializes the SDK, releasing all resources.
 * This function must be called before the application exits.
 */
SHEN_PUBLIC_API void Deinitialize();

/**
 * Terminates tracing and sends remaining telemetry data to the server.
 * To be used as a last measure if the SDK wasn't deinitialized and the runtime is about to be terminated.
 */
SHEN_PUBLIC_API void FinalizeTracing();

/**
 * Gets current SDK config string.
 * @return Current SDK config string.
 */
SHEN_PUBLIC_API std::string GetSDKConfigString();

/**
 * Applies an SDK configuration.
 * @param config_json The SDK configuration JSON string to apply.
 */
SHEN_PUBLIC_API void ApplySDKConfig(std::string config_json);

/**
 * Sets the content-addressable logo id used by generated PDFs. Pass an empty string to clear it.
 */
SHEN_PUBLIC_API void SetPdfLogoId(std::string logo_id);
SHEN_PUBLIC_API void SetIncludeTimestampInPdf(bool include);
SHEN_PUBLIC_API bool GetIncludeTimestampInPdf();

/**
 * Sets the operational mode of the SDK.
 * @param mode The operational mode to set.
 */
SHEN_PUBLIC_API void SetOperatingMode(OperatingMode mode);

/**
 * Gets the operational mode of the SDK.
 * @return The operational mode of the SDK.
 */
SHEN_PUBLIC_API OperatingMode GetOperatingMode();

/**
 * Starts measurement using the same flow as clicking the START button in the SDK UI.
 */
SHEN_PUBLIC_API void StartMeasurement();

/**
 * Stops measurement using the same flow as clicking the STOP button in the SDK UI.
 */
SHEN_PUBLIC_API void StopMeasurement();

/**
 * Resets the current measurement session state.
 * Stops active measurement mode and clears the previous result so the flow starts from "Start" again.
 */
SHEN_PUBLIC_API void ResetMeasurementSession();

/**
 * Returns whether measurement is ready to be started now.
 * This matches SDK pre-start readiness checks (positioning conditions + required start models availability).
 */
SHEN_PUBLIC_API bool IsReadyToStartMeasurement();

/**
 * Returns whether all models required to begin a measurement have finished downloading.
 * Unlike IsReadyToStartMeasurement(), this does not depend on camera or face-positioning readiness.
 */
SHEN_PUBLIC_API bool AreRequiredModelsDownloaded();

/**
 * Sets the view mode of the SDK.
 * @param mode The view mode to set.
 */
SHEN_PUBLIC_API void SetScreen(Screen screen);

/**
 * Gets the view mode of the SDK.
 * @return The view mode of the SDK.
 */
SHEN_PUBLIC_API Screen GetScreen();

/**
 * Sets the precision mode of the SDK.
 * @param mode The precision mode to set.
 */
SHEN_PUBLIC_API void SetPrecisionMode(PrecisionMode mode);

/**
 * Gets the precision mode of the SDK.
 * @return The precision mode of the SDK.
 */
SHEN_PUBLIC_API PrecisionMode GetPrecisionMode();

SHEN_PUBLIC_API void SetApplyPrecisionModeToBloodPressure(bool apply);
SHEN_PUBLIC_API bool GetApplyPrecisionModeToBloodPressure();
SHEN_PUBLIC_API void SetBlockingMeasurementConditions(std::vector<MeasurementEnvironmentCondition> conditions);
SHEN_PUBLIC_API std::vector<MeasurementEnvironmentCondition> GetBlockingMeasurementConditions();
SHEN_PUBLIC_API void SetWarningMeasurementConditions(std::vector<MeasurementEnvironmentCondition> conditions);
SHEN_PUBLIC_API std::vector<MeasurementEnvironmentCondition> GetWarningMeasurementConditions();
/**
 * Returns the highest-priority violated measurement environment condition among currently enabled
 * blocking/warning conditions.
 * Returns std::nullopt when all enabled conditions are currently satisfied.
 */
SHEN_PUBLIC_API std::optional<MeasurementEnvironmentCondition> GetCurrentViolatedMeasurementEnvironmentCondition();

/**
 * Sets the measurement preset of the SDK.
 * Preset is treated as a live control in playground-style flows, so changing it can affect an in-progress session
 * immediately. Production SDK integrations are expected to set the preset before measurement start and not mutate it
 * during recording.
 * @param preset The measurement preset to set.
 */
SHEN_PUBLIC_API void SetMeasurementPreset(MeasurementPreset preset);

/**
 * @brief Sets the BP calibration offset of the SDK.
 *
 * @param systolic_offset The systolic pressure calibration offset to set.
 * @param diastolic_offset The diastolic pressure calibration offset to set.
 */
SHEN_PUBLIC_API void SetBpCalibrationOffset(double systolic_offset, double diastolic_offset);

/**
 * Sets the custom measurement configuration of the SDK.
 * Causes the SDK to enter Custom measurement mode.
 * @param config The custom measurement configuration to set.
 */
SHEN_PUBLIC_API void SetCustomMeasurementConfig(custom_measurement_config config);

/**
 * Gets the custom measurement configuration of the SDK.
 * @return The custom measurement configuration of the SDK.
 */
SHEN_PUBLIC_API custom_measurement_config GetCustomMeasurementConfig();

/**
 * Gets the measurement preset of the SDK.
 * @return The measurement preset of the SDK.
 */
SHEN_PUBLIC_API MeasurementPreset GetMeasurementPreset();

/**
 * Sets the camera mode of the SDK.
 * Re-applying `CameraMode::CustomFrames` starts a new logical external-frame session so the SDK can treat a
 * restarted host camera pipeline as a fresh feed.
 * @param mode The camera mode to set.
 */
SHEN_PUBLIC_API void SetCameraMode(CameraMode mode);

/**
 * Gets the camera mode of the SDK.
 * Returns the currently requested camera mode even if camera startup failed.
 * Use GetLastCameraError() to distinguish an active camera from a failed startup.
 * @return The camera mode of the SDK.
 */
SHEN_PUBLIC_API CameraMode GetCameraMode();

/**
 * Gets the latest camera startup error of the SDK, if any.
 * @return The latest camera startup error, or std::nullopt when camera startup is healthy or the camera is off.
 */
SHEN_PUBLIC_API std::optional<CameraError> GetLastCameraError();

/**
 *  Selects the camera by ID (and changes to DeviceID mode if needed)
 *  and optionally specifies whether the camera is facing the user
 * @param device_id The ID of the selected camera device.
 * @param facing_user Whether the camera is facing the user.
 */
SHEN_PUBLIC_API void SelectCameraByDeviceId(std::string device_id, std::optional<bool> facing_user = std::nullopt);

#ifndef __EMSCRIPTEN__
/**
 * Submits the next BGR frame to the SDK when camera mode is set to CustomFrames.
 * The frame must already be in the intended processed orientation and size.
 * `metadata.timestampUs` should be a monotonic capture timestamp in microseconds when available.
 * If `metadata.timestampUs < 0`, the SDK synthesizes monotonic timestamps from frame submission time.
 * For best accuracy, submit frames in capture order using source timestamps when available and prefer a stable
 * sampling rate of at least 30 FPS.
 * Returns `true` if the frame was accepted for processing, or `false` if the SDK is not initialized,
 * not in CustomFrames mode, or the frame is empty.
 */
SHEN_PUBLIC_API bool HandleNextFrame(const cv::Mat& frame_bgr, frame_metadata metadata = {});
#else
/**
 *  Sets custom media stream as camera input (and changes to MediaStream mode if needed)
 *  and optionally specifies whether the camera is facing the user
 * @param stream The custom media stream object (platform-specific).
 * @param facing_user Whether the camera is facing the user.
 */
SHEN_PUBLIC_API void SetMediaStream(std::any stream, std::optional<bool> facing_user = std::nullopt);
#endif

/**
 * Sets the custom color theme of the SDK.
 * @param theme The custom color theme to set.
 */
SHEN_PUBLIC_API void SetCustomColorTheme(custom_color_theme theme);

/**
 * Gets the custom color theme of the SDK.
 * @return The custom color theme of the SDK.
 */
SHEN_PUBLIC_API custom_color_theme GetCustomColorTheme();

/**
 * Sets whether the user interface should be shown.
 * @param show True if the user interface should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowUserInterface(bool show);

/**
 * Gets whether the user interface should be shown.
 * @return True if the user interface should be shown, false otherwise.
 */
SHEN_PUBLIC_API bool GetShowUserInterface();

/**
 * Sets whether the face positioning interface should be shown.
 * @param show True if the face positioning interface should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowFacePositioningOverlay(bool show);

/**
 * Gets whether the face positioning interface should be shown.
 * @return True if the face positioning interface should be shown, false otherwise.
 */
SHEN_PUBLIC_API bool GetShowFacePositioningOverlay();

/**
 * Sets whether the visual warnings should be shown.
 * @param show True if the visual warnings should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowVisualWarnings(bool show);

/**
 * Gets whether the visual warnings should be shown.
 * @return True if the visual warnings should be shown, false otherwise.
 */
SHEN_PUBLIC_API bool GetShowVisualWarnings();

/**
 * Sets whether the camera swap button should be shown.
 * @param enable True if the camera swap button should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetEnableCameraSwap(bool enable);

/**
 * Gets whether the camera swap button should be shown.
 * @return True if the camera swap button should be shown, false otherwise.
 */
SHEN_PUBLIC_API bool GetEnableCameraSwap();

/**
 * Sets whether the face mask should be shown.
 * @param show True if the face mask should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowFaceMask(bool show);

/**
 * Gets whether the face mask should be shown.
 * @return True if the face mask should be shown, false otherwise.
 */
SHEN_PUBLIC_API bool GetShowFaceMask();

/**
 * Sets whether the blood flow visualization should be shown.
 * @param show True if the blood flow should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowBloodFlow(bool show);

/**
 * Gets whether the blood flow visualization should be shown.
 * @return True if the blood flow should be shown, false otherwise.
 */
SHEN_PUBLIC_API bool GetShowBloodFlow();

/**
 * Sets whether it should be possible to start another measurement after the measurement has succeeded.
 * @param show True if it should be possible to start another measurement after the measurement has succeeded, false
 */
SHEN_PUBLIC_API void SetEnableStartAfterSuccess(bool show);

/**
 * Gets whether it should be possible to start another measurement after the measurement has succeeded.
 * @return True if it should be possible to start another measurement after the measurement has succeeded, false
 * otherwise.
 */
SHEN_PUBLIC_API bool GetEnableStartAfterSuccess();

SHEN_PUBLIC_API void SetHideShenaiLogo(bool hide);
SHEN_PUBLIC_API bool GetHideShenaiLogo();
SHEN_PUBLIC_API void SetShowOutOfRangeResultIndicators(bool show);
SHEN_PUBLIC_API bool GetShowOutOfRangeResultIndicators();
SHEN_PUBLIC_API void SetShowTrialMetricLabels(bool show);
SHEN_PUBLIC_API bool GetShowTrialMetricLabels();
SHEN_PUBLIC_API void SetShowExpectedErrors(bool show);
SHEN_PUBLIC_API bool GetShowExpectedErrors();
SHEN_PUBLIC_API void SetShowSignalTile(bool show);
SHEN_PUBLIC_API bool GetShowSignalTile();
SHEN_PUBLIC_API void SetShowSignalQualityIndicator(bool show);
SHEN_PUBLIC_API bool GetShowSignalQualityIndicator();
SHEN_PUBLIC_API void SetShowStartStopButton(bool show);
SHEN_PUBLIC_API bool GetShowStartStopButton();
SHEN_PUBLIC_API void SetShowInfoButton(bool show);
SHEN_PUBLIC_API bool GetShowInfoButton();
SHEN_PUBLIC_API bool GetShowDisclaimer();
SHEN_PUBLIC_API void SetEnableMeasurementsDashboard(bool enable);
SHEN_PUBLIC_API bool GetEnableMeasurementsDashboard();
SHEN_PUBLIC_API void SetUiVersion(UiVersion version);
SHEN_PUBLIC_API UiVersion GetUiVersion();
SHEN_PUBLIC_API void SetUiFlowScreens(std::vector<shen::Screen> screens);
SHEN_PUBLIC_API std::vector<shen::Screen> GetUiFlowScreens();

/**
 * Face states for the SDK.
 */
enum class FaceState { Ok = 0, TooFar, TooClose, NotCentered, NotVisible, TurnedAway, Unknown };

/**
 * Gets the current face state.
 * @return The current face state.
 */
SHEN_PUBLIC_API FaceState GetFaceState();

struct NormalizedFaceBbox {
  float x;
  float y;
  float width;
  float height;
};

/**
 * Gets the current face bounding box.
 * @return The current face bounding box.
 */
SHEN_PUBLIC_API std::optional<NormalizedFaceBbox> GetNormalizedFaceBbox();

enum class MeasurementState {
  NotStarted = 0,                  // Measurement has not started yet
  WaitingForFace,                  // Waiting for face to be properly positioned in the frame
  RunningSignalShort,              // Measurement started: Signal is too short for any conclusions
  RunningSignalGood,               // Measurement proceeding: Signal quality is good
  RunningSignalBad,                // Measurement stalled due to poor signal quality
  RunningSignalBadDeviceUnstable,  // Measurement stalled due to poor signal quality (because of unstable device)
  Finalizing,                      // Measurement capture has ended and final result computation is in progress
  Finished,                        // Measurement has finished successfully
  Failed,                          // Measurement has failed
};

/**
 * Gets the current measurement state.
 * @return The current measurement state.
 */
SHEN_PUBLIC_API MeasurementState GetMeasurementState();

/**
 * Gets the current measurement progress percentage.
 * @return The current measurement progress percentage.
 */
SHEN_PUBLIC_API float GetMeasurementProgressPercentage();

/**
 * Gets the current heart rate based on the last 10 seconds of signal
 * @return The current heart rate based on the last 10 seconds of signal
 */
SHEN_PUBLIC_API std::optional<int> GetHeartRate10s();

/**
 * Gets the current heart rate based on the last 4 seconds of signal
 * @return The current heart rate based on the last 4 seconds of signal
 */
SHEN_PUBLIC_API std::optional<int> GetHeartRate4s();

/**
 * Gets the current heart rate based on the last N seconds of signal (N=10 or as specified in custom measurement config)
 * @return The current heart rate
 */
SHEN_PUBLIC_API std::optional<int> GetRealtimeHeartRate();

/**
 * Gets the current HRV SDNN based on the last N seconds of signal (N=30 or as specified in custom measurement config)
 * @return The current HRV SDNN
 */
SHEN_PUBLIC_API std::optional<double> GetRealtimeHrvSdnn();

/**
 * Gets the current Cardiac Stress Index based on the last N seconds of signal (N=30 or as specified in custom
 * measurement config)
 * @return The current Cardiac Stress Index
 */
SHEN_PUBLIC_API std::optional<double> GetRealtimeCardiacStress();

struct heartbeat {
  double start_location_sec;  // exact start location in seconds
  double end_location_sec;    // exact end location in seconds
  double duration_ms;         // heartbeat duration, rounded to 1 ms
};

struct measurement_quality_metrics {
  std::optional<double> ppg_quality_index;                   // PPG quality index [0,1]
  std::optional<double> bcg_quality_index;                   // BCG quality index [0,1]
  std::optional<double> blood_pressure_quality_index;        // Blood pressure quality index [0,1]
  std::optional<double> expected_sbp_median_abs_error_mmHg;  // Expected SBP median absolute error
  std::optional<double> expected_sbp_p80_abs_error_mmHg;     // Expected SBP 80th percentile absolute error
  std::optional<double> expected_sbp_mean_abs_error_mmHg;    // Expected SBP mean absolute error
  std::optional<double> expected_sbp_balanced_mae_mmHg;      // Expected SBP balanced MAE
  std::optional<double> expected_dbp_median_abs_error_mmHg;  // Expected DBP median absolute error
  std::optional<double> expected_dbp_p80_abs_error_mmHg;     // Expected DBP 80th percentile absolute error
  std::optional<double> expected_dbp_mean_abs_error_mmHg;    // Expected DBP mean absolute error
  std::optional<double> expected_dbp_balanced_mae_mmHg;      // Expected DBP balanced MAE
};

struct measurement_results {
  double heart_rate_bpm;                                // Heart rate, rounded to 1 BPM
  std::optional<double> hrv_sdnn_ms;                    // Heart rate variability, SDNN metric, rounded to 1 ms
  std::optional<double> hrv_lnrmssd_ms;                 // Heart rate variability, lnRMSSD metric, rounded to 0.1 ms
  std::optional<double> stress_index;                   // Cardiac Stress, rounded to 0.1
  std::optional<double> parasympathetic_activity;       // Parasympathetic activity, rounded to 1%
  std::optional<double> breathing_rate_bpm;             // Breathing rate, rounded to 1 BPM
  std::optional<double> systolic_blood_pressure_mmhg;   // Systolic blood pressure, rounded to 1 mmHg
  std::optional<double> diastolic_blood_pressure_mmhg;  // Diastolic blood pressure, rounded to 1 mmHg
  std::optional<double> cardiac_workload_mmhg_per_sec;  // Cardiac workload, rounded to 1 mmHg/s
  std::optional<double> age_years;                      // Age, rounded to 1 year
  std::optional<double> bmi_kg_per_m2;                  // BMI, rounded to 0.01 kg/m^2
  std::optional<mx::BmiCategory> bmi_category;          // BMI category
  std::optional<double> weight_kg;                      // Weight, rounded to 1 kg
  std::optional<double> height_cm;                      // Height, rounded to 1 cm
  std::optional<measurement_quality_metrics> quality_metrics;  // Measurement quality/error metrics
  std::vector<heartbeat> heartbeats;                           // Heartbeat locations
  double average_signal_quality;  // Displayed signal quality metric [0,1], matching live quality
};

struct measurement_results_with_metadata {
  measurement_results measurement_results;
  int epoch_timestamp;
  bool is_calibration;
};

struct measurement_results_history {
  std::vector<measurement_results_with_metadata> history;
};

struct vector3d {
  float x, y, z;
};
struct euler_angles {
  float yaw, pitch, roll;
};
struct face_pose {
  vector3d position;
  euler_angles rotation;
};

/**
 * Gets the realtime heartbeat metrics based on the last `period_sec` seconds of signal
 * @param period_sec The duration in seconds of the period of interest
 * @return The realtime heartbeat metrics based on the last `period_sec` seconds of signal
 */
SHEN_PUBLIC_API std::optional<measurement_results> GetRealtimeMetrics(float period_sec);

/**
 * Gets the result of the latest measurement.
 * @return The current measurement results.
 */
SHEN_PUBLIC_API std::optional<measurement_results> GetMeasurementResults();

SHEN_PUBLIC_API std::optional<measurement_results_history> GetMeasurementResultsHistory();

/**
 * Gets the health risks factors, provided by the user in the embedded UI.
 * @return The health risks factors.
 */
SHEN_PUBLIC_API std::optional<mx::health_risks::RisksFactors> GetHealthRisksFactors();

/**
 * Clears the health risks factors saved in the SDK.
 */
SHEN_PUBLIC_API void clearHealthRisksFactors();

/**
 * Gets the health risks, computed in the embedded UI, based on the factors provided by the user.
 * @return The health risks.
 */
SHEN_PUBLIC_API std::optional<mx::health_risks::HealthRisks> GetHealthRisks();

/**
 * Computes all the health risks available from the provided risk factors.
 * @return The health risks.
 */
SHEN_PUBLIC_API mx::health_risks::HealthRisks ComputeHealthRisks(const mx::health_risks::RisksFactors& risk_factors);

/**
 * Computes the maximal risks available for the provided factors (gender and base - cholesterol or BMI).
 * @return The health risks.
 */
SHEN_PUBLIC_API mx::health_risks::HealthRisks GetMaximalRisks(const mx::health_risks::RisksFactors& risk_factors);

/**
 * Computes the minimal risks available for the provided factors (gender and base - cholesterol or BMI).
 * @return The health risks.
 */
SHEN_PUBLIC_API mx::health_risks::HealthRisks GetMinimalRisks(const mx::health_risks::RisksFactors& risk_factors);

/**
 * Computes the reference risks (based on the reference risks factors).
 * @return The health risks.
 */
SHEN_PUBLIC_API mx::health_risks::HealthRisks GetReferenceRisks(const mx::health_risks::RisksFactors& risk_factors);

struct momentary_hr_value {
  double timestamp_sec;  // exact timestamp in seconds
  int hr_bpm;            // Heart rate, rounded to 1 BPM
};

/**
 * Gets heartbeats detected in realtime.
 * @param max_time The maximum time to return values for. If not specified, all values are returned.
 * @return The heartbeats detected in realtime.
 */
SHEN_PUBLIC_API std::vector<heartbeat> GetRealtimeHeartbeats(std::optional<float> period_sec = std::nullopt);

/**
 * Gets the latest pose of the subject's face (position and rotation).
 * @return The latest pose of the subject's face.
 */
SHEN_PUBLIC_API std::optional<face_pose> GetFacePose();

/**
 * Sets whether the SDK should record the measurement and send it to MX Labs.
 * @param enabled True if the SDK should record the measurement, false otherwise.
 */
SHEN_PUBLIC_API void SetRecordingEnabled(bool enabled);

/**
 * Gets whether the SDK is recording the measurement and sending it to MX Labs.
 * @return True if the SDK is recording the measurement, false otherwise.
 */
SHEN_PUBLIC_API bool GetRecordingEnabled();

SHEN_PUBLIC_API void SetExternalExerciseTargetBreathingRate(std::optional<double> breathing_rate_bpm);

/**
 * Gets the total number of seconds of bad signal since tracking started.
 * @return The total number of seconds of bad signal since tracking started.
 */
SHEN_PUBLIC_API float GetTotalBadSignalSeconds();

/**
 * Gets the current value of the signal quality metric.
 * Higher values indicate better signal quality.
 * The returned metric follows the same logic as the on-screen stars.
 */
SHEN_PUBLIC_API float GetCurrentSignalQualityMetric();

/**
 * Gets a small PNG image representing the map of signal quality across the face.
 * @return A small PNG image representing the map of signal quality across the face
 * @note Will return an empty vector if the measurement hasn't finished yet
 */
SHEN_PUBLIC_API std::vector<uint8_t> GetSignalQualityMapPng();

/**
 * Gets a small PNG image representing the average analyzed texture of the face.
 * @return A small PNG image representing the average analyzed texture of the face
 * @note Will return an empty vector if the measurement hasn't finished yet
 */
SHEN_PUBLIC_API std::vector<uint8_t> GetFaceTexturePng();

/**
 * Gets a small PNG image representing the source of metadata such as Age and BMI.
 * @return A small PNG image representing the source of metadata such as Age and BMI.
 * @note Will return an empty vector if the measurement hasn't finished yet
 */
SHEN_PUBLIC_API std::vector<uint8_t> GetMetaPredictionImagePng();

/**
 * Gets the full PPG signal computed as part of the measurement.
 * @return The full PPG signal computed as part of the measurement
 * @note Will return an empty vector if the measurement hasn't finished yet
 */
SHEN_PUBLIC_API std::vector<float> GetFullPPGSignal();

/**
 * Gets the Shen Trace ID of the current SDK session.
 * @return The Trace ID of the current SDK session.
 * @note Will return an empty string if the SDK hasn't been initialized yet
 */
SHEN_PUBLIC_API std::string GetTraceID();

/**
 * Gets the Measurement ID of the latest ongoing or finished SDK measurement.
 * @return Measurement ID of the current SDK measurement.
 * @note Will return an empty string if no measurement has started yet.
 */
SHEN_PUBLIC_API std::string GetMeasurementID();

/**
 * Sets the language of the SDK.
 * @param language The language to set.
 */
SHEN_PUBLIC_API void SetLanguage(std::string language);

/**
 * Gets the language of the SDK.
 * @return The language of the SDK.
 */
SHEN_PUBLIC_API std::string GetSelectedLanguage();

/**
 * Gets the pricing plan of the current license used to initialize the SDK.
 * @return The name of the current pricing plan.
 * @note Will return an empty string if the SDK hasn't been initialized yet
 */
SHEN_PUBLIC_API std::string GetPricingPlan();

/**
 * Gets whether this is the General Wellness SDK.
 * @return True if the active license is for the General Wellness SDK.
 * @note Will return false if the SDK hasn't been initialized yet
 */
SHEN_PUBLIC_API bool IsGeneralWellnessSdk();

/**
 * Gets the current color theme of the SDK.
 * @return The current color theme of the SDK.
 */
SHEN_PUBLIC_API void SetOnboardingMode(OnboardingMode mode);

/**
 * Gets the onboarding mode of the SDK.
 * @return The onboarding mode of the SDK.
 */
SHEN_PUBLIC_API OnboardingMode GetOnboardingMode();

/**
 * Sets the color theme of the SDK.
 * @param theme The color theme to set.
 */
SHEN_PUBLIC_API void SetEnableSummaryScreen(bool enable);

/**
 * Gets whether the summary screen should be enabled.
 * @return True if the summary screen should be enabled, false otherwise.
 */
SHEN_PUBLIC_API bool GetEnableSummaryScreen();

/**
 * Sets whether the finish button should be shown on the results screen.
 * @param show True if the finish button should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowResultsFinishButton(bool show);

/**
 * Gets whether the finish button should be shown on the results screen.
 * @return True if the finish button is shown on the results screen.
 */
SHEN_PUBLIC_API bool GetShowResultsFinishButton();

/**
 * Sets whether the health risks should be enabled.
 * @param enable True if the health risks should be enabled, false otherwise.
 */
SHEN_PUBLIC_API void SetEnableHealthRisks(bool enable);

/**
 * Gets whether the health risks should be enabled.
 * @return True if the health risks should be enabled, false otherwise.
 */
SHEN_PUBLIC_API bool GetEnableHealthRisks();

/**
 * Sets whether the finish button should be shown in the health indices view.
 * @param show True if the finish button should be shown, false otherwise.
 */
SHEN_PUBLIC_API void SetShowHealthIndicesFinishButton(bool show);

/**
 * Gets whether the finish button should be shown in the health indices view.
 * @return True if the finish button is shown in the health indices view.
 */
SHEN_PUBLIC_API bool GetShowHealthIndicesFinishButton();

/**
 * Sets whether the full frame processing should be enabled.
 * @param enable True if the full frame processing should be enabled, false otherwise.
 */
SHEN_PUBLIC_API void SetEnableFullFrameProcessing(bool enable);

/**
 * Gets whether the full frame processing should be enabled.
 * @return True if the full frame processing should be enabled, false otherwise.
 */
SHEN_PUBLIC_API bool GetEnableFullFrameProcessing();

/**
 * Sets the aspect ratio of camera.
 * @param aspect_ratio The desired aspect ratio (frame width / height). Should be a positive number or 0 for the default
 * setting. Common values: 1.0 (square), 4./3. (4:3), 16./9. (16:9), 480./720. (2:3, default in most cases).
 * Currently available on Web only.
 */
SHEN_PUBLIC_API void SetCameraAspectRatio(double aspect_ratio);

/**
 * Gets the current aspect ratio of camera.
 * @return The current aspect ratio value (frame width / height).
 */
SHEN_PUBLIC_API double GetCameraAspectRatio();

/**
 * Retrieves the current calibration state of the system.
 * This indicates if calibration is completed, not calibrated, or out of date.
 * @return The current CalibrationState.
 */
SHEN_PUBLIC_API CalibrationState GetCalibrationState();

/**
 * Retrieves the calibration data including blood pressure arrays,
 * pulse arrays, and trace identifiers.
 * @return A calibration_data struct with all collected calibration information.
 */
SHEN_PUBLIC_API calibration_data GetCalibrationData();

/**
 * Retrieves the current systolic blood pressure (SBP) calibration offset, if any.
 * The offset adjusts measured SBP values to account for calibration.
 * @return An optional double containing the SBP offset if calibration is set,
 *         or std::nullopt otherwise.
 */
SHEN_PUBLIC_API double GetSbpCalibrationOffset();

/**
 * Retrieves the current diastolic blood pressure (DBP) calibration offset, if any.
 * The offset adjusts measured DBP values to account for calibration.
 * @return An optional double containing the DBP offset if calibration is set,
 *         or std::nullopt otherwise.
 */
SHEN_PUBLIC_API double GetDbpCalibrationOffset();

/**
 * @brief Opens a *print-ready* browser view of the measurement results.
 *
 * The SDK constructs a content-embedded URL to a web app which renders a pdf-like
 * preview and launches the user's default browser.
 *
 * The browser immediately shows its native **Print** dialog, enabling the
 * user to save or send a PDF *client-side*.  No server-side PDF rendering
 * or round-trip is involved.
 *
 * @note If no finished measurement exists, the call is a no-op.
 */
SHEN_PUBLIC_API void OpenMeasurementResultsPdfInBrowser();

/**
 * @brief Sends the measurement-results PDF to a specified e-mail address.
 *
 * The SDK enqueues a server-side e-mail job. The callback will be invoked
 * once the email job has been successfully scheduled.
 *
 * @param email     Destination e-mail address (must be RFC-valid).
 * @param callback  `void(bool success)`—true if the message was accepted by
 *                  the server, false otherwise (invalid address, quota
 *                  exceeded, etc.).
 */
SHEN_PUBLIC_API void SendMeasurementResultsPdfToEmail(std::string email,
                                                      std::function<void(bool /*success*/)> callback);

/**
 * @brief Retrieves the URL of the rendered measurement-results PDF.
 *
 * The SDK starts a render job if needed; once complete, the callback receives
 * a pre-signed HTTPS link valid for at least 24 h.
 *
 * @param callback  `void(const std::string& url)`—called with the URL on
 *                  success.  On failure the URL parameter is an empty string.
 */
SHEN_PUBLIC_API void GetMeasurementResultsPdfUrl(std::function<void(std::string /*url*/)> callback);

// polling version
SHEN_PUBLIC_API void RequestMeasurementResultsPdfUrl();
SHEN_PUBLIC_API std::string GetMeasurementResultsPdfUrl();

/**
 * @brief Downloads the raw bytes of the rendered measurement-results PDF.
 *
 * Suitable for in-app previews or custom storage workflows. The callback
 * is invoked with the complete document when available.
 *
 * @param callback  `void(const std::vector<uint8_t>& bytes)`—called with the
 *                  full PDF buffer.  On failure the vector is empty.
 */
SHEN_PUBLIC_API void GetMeasurementResultsPdfBytes(std::function<void(std::vector<uint8_t> /*bytes*/)> callback);

// polling version
SHEN_PUBLIC_API void RequestMeasurementResultsPdfBytes();
SHEN_PUBLIC_API std::vector<uint8_t> GetMeasurementResultsPdfBytes();

/**
 * @brief Retrieves the latest finished measurement as a FHIR Observation JSON document.
 *
 * Returns an empty string when no presentable measurement is available.
 */
SHEN_PUBLIC_API std::string GetResultAsFhirObservation();

/**
 * @brief Sends the latest finished measurement as a FHIR Observation to the specified endpoint.
 *
 * @param url       Destination endpoint accepting `application/fhir+json` payloads.
 * @param callback  Invoked with the HTTP response body on success, or an empty string on failure.
 */
SHEN_PUBLIC_API void SendResultFhirObservation(std::string url, std::function<void(std::string /*response*/)> callback);

}  // namespace shen

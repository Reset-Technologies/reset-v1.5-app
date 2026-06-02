package ai.mxlabs.shenai_sdk_react_native;

// ShenaiSdkModule.java
import ai.mxlabs.shenai_sdk.ShenAIAndroidSDK;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.app.Activity;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import android.util.Base64;
import java.util.Optional;
import java.util.List;
import java.util.ArrayList;

public class ShenaiSdkModule extends ReactContextBaseJavaModule {
    private static final ShenAIAndroidSDK shenai_sdk = new ShenAIAndroidSDK();

    public static ShenAIAndroidSDK getSdkInstance() {
        return shenai_sdk;
    }

    ShenaiSdkModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "ShenaiSdkNativeModule";
    }

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    private void emitShenaiEvent(String jsEvent) {
        final ReactApplicationContext reactContext = getReactApplicationContext();
        if (!reactContext.hasActiveCatalystInstance()) {
            return;
        }

        reactContext.runOnJSQueueThread(() -> {
            if (!reactContext.hasActiveCatalystInstance()) {
                return;
            }
            WritableMap params = Arguments.createMap();
            params.putString("EventName", jsEvent);
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("ShenAIEvent", params);
        });
    }

    @ReactMethod
    public void initialize(String apiKey, String userId, ReadableMap settings, Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist");
            return;
        }

        ShenAIAndroidSDK.InitializationSettings shenaiSettings = shenai_sdk.getDefaultInitializationSettings();

        if (settings != null) {
            if (settings.hasKey("showUserInterface")) {
                shenaiSettings.showUserInterface = settings.getBoolean("showUserInterface");
            }
            if (settings.hasKey("precisionMode")) {
                shenaiSettings.precisionMode = ShenAIAndroidSDK.PrecisionMode.values()[settings.getInt("precisionMode")];
            }
            if (settings.hasKey("operatingMode")) {
                shenaiSettings.operatingMode = ShenAIAndroidSDK.OperatingMode.values()[settings.getInt("operatingMode")];
            }
            if (settings.hasKey("measurementPreset")) {
                shenaiSettings.measurementPreset = ShenAIAndroidSDK.MeasurementPreset.values()[settings.getInt("measurementPreset")];
            }
            if (settings.hasKey("cameraMode")) {
                shenaiSettings.cameraMode = ShenAIAndroidSDK.CameraMode.values()[settings.getInt("cameraMode")];
            }
            if (settings.hasKey("onboardingMode")) {
                shenaiSettings.onboardingMode = ShenAIAndroidSDK.OnboardingMode.values()[settings.getInt("onboardingMode")];
            }
            if (settings.hasKey("initializationMode")) {
                shenaiSettings.initializationMode = ShenAIAndroidSDK.InitializationMode.values()[settings.getInt("initializationMode")];
            }
            if (settings.hasKey("offlineProcessing")) {
                shenaiSettings.offlineProcessing = settings.getBoolean("offlineProcessing");
            }
            if (settings.hasKey("showFacePositioningOverlay")) {
                shenaiSettings.showFacePositioningOverlay = settings.getBoolean("showFacePositioningOverlay");
            }
            if (settings.hasKey("showVisualWarnings")) {
                shenaiSettings.showVisualWarnings = settings.getBoolean("showVisualWarnings");
            }
            if (settings.hasKey("enableCameraSwap")) {
                shenaiSettings.enableCameraSwap = settings.getBoolean("enableCameraSwap");
            }
            if (settings.hasKey("showFaceMask")) {
                shenaiSettings.showFaceMask = settings.getBoolean("showFaceMask");
            }
            if (settings.hasKey("showBloodFlow")) {
                shenaiSettings.showBloodFlow = settings.getBoolean("showBloodFlow");
            }
            if (settings.hasKey("hideShenaiLogo")) {
                shenaiSettings.hideShenaiLogo = settings.getBoolean("hideShenaiLogo");
            }
            if (settings.hasKey("includeTimestampInPdf")) {
                shenaiSettings.includeTimestampInPdf = settings.getBoolean("includeTimestampInPdf");
            }
            if (settings.hasKey("enableStartAfterSuccess")) {
                shenaiSettings.enableStartAfterSuccess = settings.getBoolean("enableStartAfterSuccess");
            }
            if (settings.hasKey("enableSummaryScreen")) {
                shenaiSettings.enableSummaryScreen = settings.getBoolean("enableSummaryScreen");
            }
            if (settings.hasKey("showResultsFinishButton")) {
                shenaiSettings.showResultsFinishButton = settings.getBoolean("showResultsFinishButton");
            }
            if (settings.hasKey("enableHealthRisks")) {
                shenaiSettings.enableHealthRisks = settings.getBoolean("enableHealthRisks");
            }
            if (settings.hasKey("showHealthIndicesFinishButton")) {
                shenaiSettings.showHealthIndicesFinishButton =
                        settings.getBoolean("showHealthIndicesFinishButton");
            }
            if (settings.hasKey("saveHealthRisksFactors")) {
                shenaiSettings.saveHealthRisksFactors = settings.getBoolean("saveHealthRisksFactors");
            }
            if (settings.hasKey("showOutOfRangeResultIndicators")) {
                shenaiSettings.showOutOfRangeResultIndicators = settings.getBoolean("showOutOfRangeResultIndicators");
            }
            if (settings.hasKey("showSignalQualityIndicator")) {
                shenaiSettings.showSignalQualityIndicator = settings.getBoolean("showSignalQualityIndicator");
            }
            if (settings.hasKey("showSignalTile")) {
                shenaiSettings.showSignalTile = settings.getBoolean("showSignalTile");
            }
            if (settings.hasKey("showStartStopButton")) {
                shenaiSettings.showStartStopButton = settings.getBoolean("showStartStopButton");
            }
            if (settings.hasKey("showInfoButton")) {
                shenaiSettings.showInfoButton = settings.getBoolean("showInfoButton");
            }
            if (settings.hasKey("showDisclaimer")) {
                shenaiSettings.showDisclaimer = settings.getBoolean("showDisclaimer");
            }
            if (settings.hasKey("enableMeasurementsDashboard")) {
                shenaiSettings.enableMeasurementsDashboard = settings.getBoolean("enableMeasurementsDashboard");
            }
            if (settings.hasKey("uiVersion")) {
                int rawVersion = settings.getInt("uiVersion");
                shenaiSettings.uiVersion = ShenAIAndroidSDK.UiVersion.values()[rawVersion];
            }
            if (settings.hasKey("showTrialMetricLabels")) {
                shenaiSettings.showTrialMetricLabels = settings.getBoolean("showTrialMetricLabels");
            }
            if (settings.hasKey("applyPrecisionModeToBloodPressure")) {
                shenaiSettings.applyPrecisionModeToBloodPressure =
                        settings.getBoolean("applyPrecisionModeToBloodPressure");
            }
            if (settings.hasKey("blockingMeasurementConditions")) {
                ReadableArray array = settings.getArray("blockingMeasurementConditions");
                shenaiSettings.blockingMeasurementConditions.clear();
                for (int i = 0; i < array.size(); i++) {
                    shenaiSettings.blockingMeasurementConditions.add(
                            ShenAIAndroidSDK.MeasurementEnvironmentCondition.values()[array.getInt(i)]);
                }
            }
            if (settings.hasKey("warningMeasurementConditions")) {
                ReadableArray array = settings.getArray("warningMeasurementConditions");
                shenaiSettings.warningMeasurementConditions.clear();
                for (int i = 0; i < array.size(); i++) {
                    shenaiSettings.warningMeasurementConditions.add(
                            ShenAIAndroidSDK.MeasurementEnvironmentCondition.values()[array.getInt(i)]);
                }
            }
            if (settings.hasKey("uiFlowScreens")) {
                ReadableArray array = settings.getArray("uiFlowScreens");
                shenaiSettings.uiFlowScreens.clear();
                for (int i = 0; i < array.size(); i++) {
                    shenaiSettings.uiFlowScreens.add(ShenAIAndroidSDK.Screen.values()[array.getInt(i)]);
                }
            }
            if (settings.hasKey("frameWidth")) {
                shenaiSettings.frameWidth = settings.getInt("frameWidth");
            }
            if (settings.hasKey("frameHeight")) {
                shenaiSettings.frameHeight = settings.getInt("frameHeight");
            }
            if (settings.hasKey("rotation")) {
                shenaiSettings.rotation = settings.getInt("rotation");
            }
            if (settings.hasKey("risksFactors")) {
                ReadableMap factorsMap = settings.getMap("risksFactors");
                shenaiSettings.risksFactors = risksFactorsFromReadableMap(factorsMap);
            }
            shenaiSettings.eventCallback = new ShenAIAndroidSDK.EventCallback() {
                @Override
                public void onEvent(ShenAIAndroidSDK.Event event) {
                    String jsEvent;
                    switch (event) {
                        case START_BUTTON_CLICKED:
                            jsEvent = "START_BUTTON_CLICKED";
                            break;
                        case STOP_BUTTON_CLICKED:
                            jsEvent = "STOP_BUTTON_CLICKED";
                            break;
                        case MEASUREMENT_FINISHED:
                            jsEvent = "MEASUREMENT_FINISHED";
                            break;
                        case USER_FLOW_FINISHED:
                            jsEvent = "USER_FLOW_FINISHED";
                            break;
                        case SCREEN_CHANGED:
                            jsEvent = "SCREEN_CHANGED";
                            break;
                        default:
                            jsEvent = "UNKNOWN";
                    }
                    emitShenaiEvent(jsEvent);
                }
            };
            // Add mappings for other settings as needed
        }

        ShenAIAndroidSDK.InitializationResult result = shenai_sdk.initialize(currentActivity, apiKey, userId, shenaiSettings);
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void setCustomMeasurementConfig(ReadableMap config, Promise promise) {
        ShenAIAndroidSDK.CustomMeasurementConfig shenaiConfig = shenai_sdk.new CustomMeasurementConfig();

        if (config.hasKey("durationSeconds")) {
            shenaiConfig.durationSeconds = Optional.of((float) config.getDouble("durationSeconds"));
        }
        if (config.hasKey("infiniteMeasurement")) {
            shenaiConfig.infiniteMeasurement = Optional.of(config.getBoolean("infiniteMeasurement"));
        }
        if (config.hasKey("instantMetrics")) {
            ReadableArray array = config.getArray("instantMetrics");
            List<ShenAIAndroidSDK.Metric> metricsList = new ArrayList<>();
            for (int i = 0; i < array.size(); i++) {
                String metricStr = array.getString(i);
                try {
                    ShenAIAndroidSDK.Metric metric = ShenAIAndroidSDK.Metric.valueOf(metricStr);
                    metricsList.add(metric);
                } catch (IllegalArgumentException e) {
                    // Handle the case where the enum value is not found
                    promise.reject("Invalid metric value: " + metricStr);
                    return;
                }
            }
            shenaiConfig.instantMetrics = Optional.of(metricsList);
        }
        if (config.hasKey("summaryMetrics")) {
            ReadableArray array = config.getArray("summaryMetrics");
            List<ShenAIAndroidSDK.Metric> metricsList = new ArrayList<>();
            for (int i = 0; i < array.size(); i++) {
                String metricStr = array.getString(i);
                try {
                    ShenAIAndroidSDK.Metric metric = ShenAIAndroidSDK.Metric.valueOf(metricStr);
                    metricsList.add(metric);
                } catch (IllegalArgumentException e) {
                    // Handle the case where the enum value is not found
                    promise.reject("Invalid metric value: " + metricStr);
                    return;
                }
            }
            shenaiConfig.summaryMetrics = Optional.of(metricsList);
        }
        if (config.hasKey("healthIndices")) {
            ReadableArray array = config.getArray("healthIndices");
            List<ShenAIAndroidSDK.HealthIndex> healthIndicesList = new ArrayList<>();
            for (int i = 0; i < array.size(); i++) {
                String healthIndexStr = array.getString(i);
                try {
                    ShenAIAndroidSDK.HealthIndex healthIndex = ShenAIAndroidSDK.HealthIndex.valueOf(healthIndexStr);
                    healthIndicesList.add(healthIndex);
                } catch (IllegalArgumentException e) {
                    // Handle the case where the enum value is not found
                    promise.reject("Invalid health index value: " + healthIndexStr);
                    return;
                }
            }
            shenaiConfig.healthIndices = Optional.of(healthIndicesList);
        }
        if (config.hasKey("realtimeHrPeriodSeconds")) {
            shenaiConfig.realtimeHrPeriodSeconds = Optional.of((float) config.getDouble("realtimeHrPeriodSeconds"));
        }
        if (config.hasKey("realtimeHrvPeriodSeconds")) {
            shenaiConfig.realtimeHrvPeriodSeconds = Optional.of((float) config.getDouble("realtimeHrvPeriodSeconds"));
        }
        if (config.hasKey("realtimeCardiacStressPeriodSeconds")) {
            shenaiConfig.realtimeCardiacStressPeriodSeconds = Optional.of((float) config.getDouble("realtimeCardiacStressPeriodSeconds"));
        }
        shenai_sdk.setCustomMeasurementConfig(shenaiConfig);
        promise.resolve(null);
    }

    @ReactMethod
    public void setCustomColorTheme(ReadableMap theme, Promise promise) {
        ShenAIAndroidSDK.CustomColorTheme shenaiTheme = shenai_sdk.new CustomColorTheme();

        if (theme.hasKey("themeColor")) {
            shenaiTheme.themeColor = theme.getString("themeColor");
        }
        if (theme.hasKey("textColor")) {
            shenaiTheme.textColor = theme.getString("textColor");
        }
        if (theme.hasKey("backgroundColor")) {
            shenaiTheme.backgroundColor = theme.getString("backgroundColor");
        }
        if (theme.hasKey("tileColor")) {
            shenaiTheme.tileColor = theme.getString("tileColor");
        }
        if (theme.hasKey("buttonMainColor")) {
            shenaiTheme.buttonMainColor = theme.getString("buttonMainColor");
        }
        if (theme.hasKey("buttonSecondaryColor")) {
            shenaiTheme.buttonSecondaryColor = theme.getString("buttonSecondaryColor");
        }
        shenai_sdk.setCustomColorTheme(shenaiTheme);
        promise.resolve(null);
    }

    @ReactMethod
    public void isInitialized(Promise promise) {
        boolean result = shenai_sdk.isInitialized();
        promise.resolve(result);
    }

    @ReactMethod
    public void deinitialize(Promise promise) {
        shenai_sdk.deinitialize();
        promise.resolve(null);
    }

    @ReactMethod
    public void setOperatingMode(int operatingMode, Promise promise) {
        shenai_sdk.setOperatingMode(ShenAIAndroidSDK.OperatingMode.values()[operatingMode]);
        promise.resolve(null);
    }

    @ReactMethod
    public void startMeasurement(Promise promise) {
        shenai_sdk.startMeasurement();
        promise.resolve(null);
    }

    @ReactMethod
    public void stopMeasurement(Promise promise) {
        shenai_sdk.stopMeasurement();
        promise.resolve(null);
    }

    @ReactMethod
    public void resetMeasurementSession(Promise promise) {
        shenai_sdk.resetMeasurementSession();
        promise.resolve(null);
    }

    @ReactMethod
    public void getOperatingMode(Promise promise) {
        ShenAIAndroidSDK.OperatingMode result = shenai_sdk.getOperatingMode();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void getCalibrationState(Promise promise) {
        ShenAIAndroidSDK.CalibrationState result = shenai_sdk.getCalibrationState();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void setPrecisionMode(int precisionMode, Promise promise) {
        shenai_sdk.setPrecisionMode(ShenAIAndroidSDK.PrecisionMode.values()[precisionMode]);
        promise.resolve(null);
    }

    @ReactMethod
    public void getPrecisionMode(Promise promise) {
        ShenAIAndroidSDK.PrecisionMode result = shenai_sdk.getPrecisionMode();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void setApplyPrecisionModeToBloodPressure(boolean apply, Promise promise) {
        shenai_sdk.setApplyPrecisionModeToBloodPressure(apply);
        promise.resolve(null);
    }

    @ReactMethod
    public void getApplyPrecisionModeToBloodPressure(Promise promise) {
        promise.resolve(shenai_sdk.getApplyPrecisionModeToBloodPressure());
    }

    @ReactMethod
    public void setBlockingMeasurementConditions(ReadableArray conditions, Promise promise) {
        ShenAIAndroidSDK.MeasurementEnvironmentCondition[] values =
                new ShenAIAndroidSDK.MeasurementEnvironmentCondition[conditions == null ? 0 : conditions.size()];
        if (conditions != null) {
            for (int i = 0; i < conditions.size(); i++) {
                values[i] = ShenAIAndroidSDK.MeasurementEnvironmentCondition.values()[conditions.getInt(i)];
            }
        }
        shenai_sdk.setBlockingMeasurementConditions(values);
        promise.resolve(null);
    }

    @ReactMethod
    public void getBlockingMeasurementConditions(Promise promise) {
        ShenAIAndroidSDK.MeasurementEnvironmentCondition[] values = shenai_sdk.getBlockingMeasurementConditions();
        WritableArray array = Arguments.createArray();
        for (ShenAIAndroidSDK.MeasurementEnvironmentCondition value : values) {
            array.pushInt(value.ordinal());
        }
        promise.resolve(array);
    }

    @ReactMethod
    public void setWarningMeasurementConditions(ReadableArray conditions, Promise promise) {
        ShenAIAndroidSDK.MeasurementEnvironmentCondition[] values =
                new ShenAIAndroidSDK.MeasurementEnvironmentCondition[conditions == null ? 0 : conditions.size()];
        if (conditions != null) {
            for (int i = 0; i < conditions.size(); i++) {
                values[i] = ShenAIAndroidSDK.MeasurementEnvironmentCondition.values()[conditions.getInt(i)];
            }
        }
        shenai_sdk.setWarningMeasurementConditions(values);
        promise.resolve(null);
    }

    @ReactMethod
    public void getWarningMeasurementConditions(Promise promise) {
        ShenAIAndroidSDK.MeasurementEnvironmentCondition[] values = shenai_sdk.getWarningMeasurementConditions();
        WritableArray array = Arguments.createArray();
        for (ShenAIAndroidSDK.MeasurementEnvironmentCondition value : values) {
            array.pushInt(value.ordinal());
        }
        promise.resolve(array);
    }

    @ReactMethod
    public void getCurrentViolatedMeasurementEnvironmentCondition(Promise promise) {
        ShenAIAndroidSDK.MeasurementEnvironmentCondition value =
            shenai_sdk.getCurrentViolatedMeasurementEnvironmentCondition();
        promise.resolve(value == null ? null : value.ordinal());
    }

    @ReactMethod
    public void setMeasurementPreset(int measurementPreset, Promise promise) {
        shenai_sdk.setMeasurementPreset(ShenAIAndroidSDK.MeasurementPreset.values()[measurementPreset]);
        promise.resolve(null);
    }

    @ReactMethod
    public void getMeasurementPreset(Promise promise) {
        ShenAIAndroidSDK.MeasurementPreset result = shenai_sdk.getMeasurementPreset();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void setCameraMode(int cameraMode, Promise promise) {
        shenai_sdk.setCameraMode(ShenAIAndroidSDK.CameraMode.values()[cameraMode]);
        promise.resolve(null);
    }

    @ReactMethod
    public void getCameraMode(Promise promise) {
        ShenAIAndroidSDK.CameraMode result = shenai_sdk.getCameraMode();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void getLastCameraError(Promise promise) {
        ShenAIAndroidSDK.CameraError result = shenai_sdk.getLastCameraError();
        promise.resolve(result == null ? null : result.ordinal());
    }

    @ReactMethod
    public void setScreen(int screen, Promise promise) {
        shenai_sdk.setScreen(ShenAIAndroidSDK.Screen.values()[screen]);
        promise.resolve(null);
    }

    @ReactMethod
    public void getScreen(Promise promise) {
        ShenAIAndroidSDK.Screen result = shenai_sdk.getScreen();
        promise.resolve(result.ordinal());
    }


    @ReactMethod
    public void setShowUserInterface(boolean showUserInterface, Promise promise) {
        shenai_sdk.setShowUserInterface(showUserInterface);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowUserInterface(Promise promise) {
        boolean result = shenai_sdk.getShowUserInterface();
        promise.resolve(result);
    }

    @ReactMethod
    public void setShowFacePositioningOverlay(boolean showFacePositioningOverlay, Promise promise) {
        shenai_sdk.setShowFacePositioningOverlay(showFacePositioningOverlay);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowFacePositioningOverlay(Promise promise) {
        boolean result = shenai_sdk.getShowFacePositioningOverlay();
        promise.resolve(result);
    }

    @ReactMethod
    public void setShowVisualWarnings(boolean showVisualWarnings, Promise promise) {
        shenai_sdk.setShowVisualWarnings(showVisualWarnings);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowVisualWarnings(Promise promise) {
        boolean result = shenai_sdk.getShowVisualWarnings();
        promise.resolve(result);
    }

    @ReactMethod
    public void setEnableCameraSwap(boolean enableCameraSwap, Promise promise) {
        shenai_sdk.setEnableCameraSwap(enableCameraSwap);
        promise.resolve(null);
    }

    @ReactMethod
    public void getEnableCameraSwap(Promise promise) {
        boolean result = shenai_sdk.getEnableCameraSwap();
        promise.resolve(result);
    }

    @ReactMethod
    public void setShowFaceMask(boolean showFaceMask, Promise promise) {
        shenai_sdk.setShowFaceMask(showFaceMask);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowFaceMask(Promise promise) {
        boolean result = shenai_sdk.getShowFaceMask();
        promise.resolve(result);
    }

    @ReactMethod
    public void setShowBloodFlow(boolean showBloodFlow, Promise promise) {
        shenai_sdk.setShowBloodFlow(showBloodFlow);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowBloodFlow(Promise promise) {
        boolean result = shenai_sdk.getShowBloodFlow();
        promise.resolve(result);
    }

    @ReactMethod
    public void setIncludeTimestampInPdf(boolean include, Promise promise) {
        shenai_sdk.setIncludeTimestampInPdf(include);
        promise.resolve(null);
    }

    @ReactMethod
    public void getIncludeTimestampInPdf(Promise promise) {
        boolean result = shenai_sdk.getIncludeTimestampInPdf();
        promise.resolve(result);
    }

    @ReactMethod
    public void setShowStartStopButton(boolean showStartStopButton, Promise promise) {
        shenai_sdk.setShowStartStopButton(showStartStopButton);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowStartStopButton(Promise promise) {
        boolean result = shenai_sdk.getShowStartStopButton();
        promise.resolve(result);
    }

    @ReactMethod
    public void setEnableMeasurementsDashboard(boolean enableMeasurementsDashboard, Promise promise) {
        shenai_sdk.setEnableMeasurementsDashboard(enableMeasurementsDashboard);
        promise.resolve(null);
    }

    @ReactMethod
    public void getEnableMeasurementsDashboard(Promise promise) {
        boolean result = shenai_sdk.getEnableMeasurementsDashboard();
        promise.resolve(result);
    }

    @ReactMethod
    public void setShowInfoButton(boolean showInfoButton, Promise promise) {
        shenai_sdk.setShowInfoButton(showInfoButton);
        promise.resolve(null);
    }

    @ReactMethod
    public void getShowInfoButton(Promise promise) {
        boolean result = shenai_sdk.getShowInfoButton();
        promise.resolve(result);
    }

    @ReactMethod
    public void getShowDisclaimer(Promise promise) {
        boolean result = shenai_sdk.getShowDisclaimer();
        promise.resolve(result);
    }

    @ReactMethod
    public void setEnableStartAfterSuccess(boolean enableStartAfterSuccess, Promise promise) {
        shenai_sdk.setEnableStartAfterSuccess(enableStartAfterSuccess);
        promise.resolve(null);
    }

    @ReactMethod
    public void getEnableStartAfterSuccess(Promise promise) {
        boolean result = shenai_sdk.getEnableStartAfterSuccess();
        promise.resolve(result);
    }


    @ReactMethod
    public void getFaceState(Promise promise) {
        ShenAIAndroidSDK.FaceState result = shenai_sdk.getFaceState();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void getNormalizedFaceBbox(Promise promise) {
        ShenAIAndroidSDK.NormalizedFaceBbox bbox = shenai_sdk.getNormalizedFaceBbox();
        if (bbox != null) {
            WritableMap bboxMap = Arguments.createMap();
            bboxMap.putDouble("x", bbox.x);
            bboxMap.putDouble("y", bbox.y);
            bboxMap.putDouble("width", bbox.width);
            bboxMap.putDouble("height", bbox.height);
            promise.resolve(bboxMap);
        } else {
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void getMeasurementState(Promise promise) {
        ShenAIAndroidSDK.MeasurementState result = shenai_sdk.getMeasurementState();
        promise.resolve(result.ordinal());
    }

    @ReactMethod
    public void isReadyToStartMeasurement(Promise promise) {
        promise.resolve(shenai_sdk.isReadyToStartMeasurement());
    }

    @ReactMethod
    public void areRequiredModelsDownloaded(Promise promise) {
        promise.resolve(shenai_sdk.areRequiredModelsDownloaded());
    }

    @ReactMethod
    public void getMeasurementProgressPercentage(Promise promise) {
        float result = shenai_sdk.getMeasurementProgressPercentage();
        promise.resolve((double) result);
    }


    @ReactMethod
    public void getHeartRate10s(Promise promise) {
        int result = shenai_sdk.getHeartRate10s();
        if (result < 0) {
            promise.resolve(null); // Assuming negative values indicate no data
        } else {
            promise.resolve(result);
        }
    }

    @ReactMethod
    public void getHeartRate4s(Promise promise) {
        int result = shenai_sdk.getHeartRate4s();
        if (result < 0) {
            promise.resolve(null); // Assuming negative values indicate no data
        } else {
            promise.resolve(result);
        }
    }

    private void resolveMeasurementResults(Promise promise, ShenAIAndroidSDK.MeasurementResults results) {
        try {
            if (results != null) {
                WritableMap resultMap = convertMeasurementResultsToMap(results);
                promise.resolve(resultMap);
            } else {
                promise.resolve(null);
            }
        } catch (RuntimeException e) {
            promise.reject("ERROR_MEASUREMENT_RESULTS", "Failed to convert measurement results", e);
        }
    }

    private WritableMap convertMeasurementResultsWithMetadataToMap(ShenAIAndroidSDK.MeasurementResultsWithMetadata nativeObj) {
    if (nativeObj == null) {
        return null;
    }

    WritableMap mdMap = Arguments.createMap();

    WritableMap resultsMap = convertMeasurementResultsToMap(nativeObj.measurementResults);
    if (resultsMap != null) {
        mdMap.putMap("measurementResults", resultsMap);
    } else {
        mdMap.putNull("measurementResults");
    }
    mdMap.putDouble("epochTimestamp", nativeObj.epochTimestamp);
    mdMap.putBoolean("isCalibration", nativeObj.isCalibration);

    return mdMap;
}

    private WritableMap convertMeasurementQualityMetricsToMap(ShenAIAndroidSDK.MeasurementQualityMetrics metrics) {
        if (metrics == null) {
            return null;
        }
        WritableMap map = Arguments.createMap();
        if (metrics.ppgQualityIndex != null && metrics.ppgQualityIndex.isPresent()) {
            map.putDouble("ppgQualityIndex", metrics.ppgQualityIndex.get());
        } else {
            map.putNull("ppgQualityIndex");
        }
        if (metrics.bcgQualityIndex != null && metrics.bcgQualityIndex.isPresent()) {
            map.putDouble("bcgQualityIndex", metrics.bcgQualityIndex.get());
        } else {
            map.putNull("bcgQualityIndex");
        }
        if (metrics.bloodPressureQualityIndex != null && metrics.bloodPressureQualityIndex.isPresent()) {
            map.putDouble("bloodPressureQualityIndex", metrics.bloodPressureQualityIndex.get());
        } else {
            map.putNull("bloodPressureQualityIndex");
        }
        if (metrics.expectedSbpMedianAbsErrorMmhg != null && metrics.expectedSbpMedianAbsErrorMmhg.isPresent()) {
            map.putDouble("expectedSbpMedianAbsErrorMmhg", metrics.expectedSbpMedianAbsErrorMmhg.get());
        } else {
            map.putNull("expectedSbpMedianAbsErrorMmhg");
        }
        if (metrics.expectedSbpP80AbsErrorMmhg != null && metrics.expectedSbpP80AbsErrorMmhg.isPresent()) {
            map.putDouble("expectedSbpP80AbsErrorMmhg", metrics.expectedSbpP80AbsErrorMmhg.get());
        } else {
            map.putNull("expectedSbpP80AbsErrorMmhg");
        }
        if (metrics.expectedSbpMeanAbsErrorMmhg != null && metrics.expectedSbpMeanAbsErrorMmhg.isPresent()) {
            map.putDouble("expectedSbpMeanAbsErrorMmhg", metrics.expectedSbpMeanAbsErrorMmhg.get());
        } else {
            map.putNull("expectedSbpMeanAbsErrorMmhg");
        }
        if (metrics.expectedSbpBalancedMaeMmhg != null && metrics.expectedSbpBalancedMaeMmhg.isPresent()) {
            map.putDouble("expectedSbpBalancedMaeMmhg", metrics.expectedSbpBalancedMaeMmhg.get());
        } else {
            map.putNull("expectedSbpBalancedMaeMmhg");
        }
        if (metrics.expectedDbpMedianAbsErrorMmhg != null && metrics.expectedDbpMedianAbsErrorMmhg.isPresent()) {
            map.putDouble("expectedDbpMedianAbsErrorMmhg", metrics.expectedDbpMedianAbsErrorMmhg.get());
        } else {
            map.putNull("expectedDbpMedianAbsErrorMmhg");
        }
        if (metrics.expectedDbpP80AbsErrorMmhg != null && metrics.expectedDbpP80AbsErrorMmhg.isPresent()) {
            map.putDouble("expectedDbpP80AbsErrorMmhg", metrics.expectedDbpP80AbsErrorMmhg.get());
        } else {
            map.putNull("expectedDbpP80AbsErrorMmhg");
        }
        if (metrics.expectedDbpMeanAbsErrorMmhg != null && metrics.expectedDbpMeanAbsErrorMmhg.isPresent()) {
            map.putDouble("expectedDbpMeanAbsErrorMmhg", metrics.expectedDbpMeanAbsErrorMmhg.get());
        } else {
            map.putNull("expectedDbpMeanAbsErrorMmhg");
        }
        if (metrics.expectedDbpBalancedMaeMmhg != null && metrics.expectedDbpBalancedMaeMmhg.isPresent()) {
            map.putDouble("expectedDbpBalancedMaeMmhg", metrics.expectedDbpBalancedMaeMmhg.get());
        } else {
            map.putNull("expectedDbpBalancedMaeMmhg");
        }
        return map;
    }

    private WritableMap convertMeasurementResultsToMap(ShenAIAndroidSDK.MeasurementResults results) {
        if (results == null) {
            return null;
        }

        WritableMap resultMap = Arguments.createMap();

        resultMap.putDouble("heartRateBpm", results.hrBpm);
        resultMap.putDouble("averageSignalQuality", results.averageSignalQuality);

        resultMap.putArray("heartbeats", convertHeartbeatsToArray(results.heartbeats));

        if (results.brBpm.isPresent()) {
            resultMap.putDouble("breathingRateBpm", results.brBpm.get());
        } else {
            resultMap.putNull("breathingRateBpm");
        }

        if (results.hrvLnrmssdMs.isPresent()) {
            resultMap.putDouble("hrvLnrmssdMs", results.hrvLnrmssdMs.get());
        } else {
            resultMap.putNull("hrvLnrmssdMs");
        }

        if (results.hrvSdnnMs.isPresent()) {
            resultMap.putDouble("hrvSdnnMs", results.hrvSdnnMs.get());
        } else {
            resultMap.putNull("hrvSdnnMs");
        }

        if (results.stressIndex.isPresent()) {
            resultMap.putDouble("stressIndex", results.stressIndex.get());
        } else {
            resultMap.putNull("stressIndex");
        }

        if (results.parasympatheticActivity.isPresent()) {
            resultMap.putDouble("parasympatheticActivity", results.parasympatheticActivity.get());
        } else {
            resultMap.putNull("parasympatheticActivity");
        }

        if (results.systolicBloodPressureMmhg.isPresent()) {
            resultMap.putDouble("systolicBloodPressureMmhg", results.systolicBloodPressureMmhg.get());
        } else {
            resultMap.putNull("systolicBloodPressureMmhg");
        }

        if (results.diastolicBloodPressureMmhg.isPresent()) {
            resultMap.putDouble("diastolicBloodPressureMmhg", results.diastolicBloodPressureMmhg.get());
        } else {
            resultMap.putNull("diastolicBloodPressureMmhg");
        }

        if (results.cardiacWorkloadMmhgPerSec.isPresent()) {
            resultMap.putDouble("cardiacWorkloadMmhgPerSec", results.cardiacWorkloadMmhgPerSec.get());
        } else {
            resultMap.putNull("cardiacWorkloadMmhgPerSec");
        }

        if (results.ageYears.isPresent()) {
            resultMap.putDouble("ageYears", results.ageYears.get());
        } else {
            resultMap.putNull("ageYears");
        }

        if (results.bmiKgPerM2.isPresent()) {
            resultMap.putDouble("bmiKgPerM2", results.bmiKgPerM2.get());
        } else {
            resultMap.putNull("bmiKgPerM2");
        }

        if (results.bmiCategory.isPresent()) {
            results.bmiCategory.ifPresent(bmiCategory -> resultMap.putInt("bmiCategory", bmiCategory.ordinal()));
        } else {
            resultMap.putNull("bmiCategory");
        }

        if (results.weightKg.isPresent()) {
            resultMap.putDouble("weightKg", results.weightKg.get());
        } else {
            resultMap.putNull("weightKg");
        }

        if (results.heightCm.isPresent()) {
            resultMap.putDouble("heightCm", results.heightCm.get());
        } else {
            resultMap.putNull("heightCm");
        }

        WritableMap qualityMetricsMap = convertMeasurementQualityMetricsToMap(results.qualityMetrics);
        if (qualityMetricsMap != null) {
            resultMap.putMap("qualityMetrics", qualityMetricsMap);
        } else {
            resultMap.putNull("qualityMetrics");
        }

        return resultMap;
    }

    private void resolveMeasurementResultsHistory(Promise promise, ShenAIAndroidSDK.MeasurementResultsHistory history) {
        if (history == null) {
            promise.resolve(null);
            return;
        }

        WritableMap topLevelMap = Arguments.createMap();
        WritableArray itemsArray = Arguments.createArray();

        if (history.history != null) {
            for (ShenAIAndroidSDK.MeasurementResultsWithMetadata item : history.history) {
                WritableMap itemMap = convertMeasurementResultsWithMetadataToMap(item);
                itemsArray.pushMap(itemMap);
            }
        }

        topLevelMap.putArray("history", itemsArray);
        promise.resolve(topLevelMap);
    }

    @ReactMethod
    public void getRealtimeMetrics(float periodSec, Promise promise) {
        resolveMeasurementResults(promise, shenai_sdk.getRealtimeMetrics(periodSec));
    }

    @ReactMethod
    public void getMeasurementResults(Promise promise) {
        resolveMeasurementResults(promise, shenai_sdk.getMeasurementResults());
    }

    @ReactMethod
    public void getMeasurementResultsHistory(Promise promise) {
        resolveMeasurementResultsHistory(promise, shenai_sdk.getMeasurementResultsHistory());
    }

    @ReactMethod
    public void getRealtimeHeartbeats(@Nullable Float periodSec, Promise promise) {
        ShenAIAndroidSDK.Heartbeat[] heartbeats = shenai_sdk.getRealtimeHeartbeats(periodSec);
        promise.resolve(convertHeartbeatsToArray(heartbeats));
    }

    private WritableArray convertHeartbeatsToArray(ShenAIAndroidSDK.Heartbeat[] heartbeats) {
        WritableArray array = Arguments.createArray();
        if (heartbeats == null) {
            return array;
        }
        for (ShenAIAndroidSDK.Heartbeat hb : heartbeats) {
            WritableMap hbMap = Arguments.createMap();
            hbMap.putDouble("startLocationSec", hb.startLocationSec);
            hbMap.putDouble("endLocationSec", hb.endLocationSec);
            hbMap.putDouble("durationMs", hb.durationMs);
            array.pushMap(hbMap);
        }
        return array;
    }

    @ReactMethod
    public void getFullPpgSignal(Promise promise) {
        double[] ppgSignal = shenai_sdk.getFullPpgSignal();
        WritableArray array = Arguments.createArray();
        for (double value : ppgSignal) {
            array.pushDouble(value);
        }
        promise.resolve(array);
    }

    @ReactMethod
    public void setRecordingEnabled(boolean recordingEnabled, Promise promise) {
        shenai_sdk.setRecordingEnabled(recordingEnabled);
        promise.resolve(null);
    }

    @ReactMethod
    public void getRecordingEnabled(Promise promise) {
        boolean isEnabled = shenai_sdk.getRecordingEnabled();
        promise.resolve(isEnabled);
    }

    @ReactMethod
    public void getTotalBadSignalSeconds(Promise promise) {
        float totalSeconds = shenai_sdk.getTotalBadSignalSeconds();
        promise.resolve((double) totalSeconds);
    }

    @ReactMethod
    public void getCurrentSignalQualityMetric(Promise promise) {
        float qualityMetric = shenai_sdk.getCurrentSignalQualityMetric();
        promise.resolve((double) qualityMetric);
    }

    @ReactMethod
    public void getSignalQualityMapPng(Promise promise) {
        byte[] signalQualityMap = shenai_sdk.getSignalQualityMapPng();
        WritableArray array = Arguments.createArray();
        for (byte b : signalQualityMap) {
            array.pushInt(b & 0xFF); // Converting byte to unsigned int
        }
        promise.resolve(array);
    }

    @ReactMethod
    public void getFaceTexturePng(Promise promise) {
        byte[] faceTexture = shenai_sdk.getFaceTexturePng();
        WritableArray array = Arguments.createArray();
        for (byte b : faceTexture) {
            array.pushInt(b & 0xFF); // Converting byte to unsigned int
        }
        promise.resolve(array);
    }

    @ReactMethod
    public void setLanguage(String language, Promise promise) {
        shenai_sdk.setLanguage(language);
        promise.resolve(null);
    }

    private ShenAIAndroidSDK.RisksFactors risksFactorsFromReadableMap(ReadableMap map) {
        ShenAIAndroidSDK.RisksFactors factors = shenai_sdk.new RisksFactors();
        if (map.hasKey("age")) factors.age = Optional.of(map.getInt("age"));
        if (map.hasKey("cholesterol")) factors.cholesterol = Optional.of((float) map.getDouble("cholesterol"));
        if (map.hasKey("cholesterolHdl")) factors.cholesterolHdl = Optional.of((float) map.getDouble("cholesterolHdl"));
        if (map.hasKey("sbp")) factors.sbp = Optional.of((float) map.getDouble("sbp"));
        if (map.hasKey("dbp")) factors.dbp = Optional.of((float) map.getDouble("dbp"));
        if (map.hasKey("isSmoker")) factors.isSmoker = Optional.of(map.getBoolean("isSmoker"));
        if (map.hasKey("hasDiabetes")) factors.hasDiabetes = Optional.of(map.getBoolean("hasDiabetes"));
        if (map.hasKey("bodyHeight")) factors.bodyHeight = Optional.of((float) map.getDouble("bodyHeight"));
        if (map.hasKey("bodyWeight")) factors.bodyWeight = Optional.of((float) map.getDouble("bodyWeight"));
        if (map.hasKey("waistCircumference")) factors.waistCircumference = Optional.of((float) map.getDouble("waistCircumference"));
        if (map.hasKey("neckCircumference")) factors.neckCircumference = Optional.of((float) map.getDouble("neckCircumference"));
        if (map.hasKey("hipCircumference")) factors.hipCircumference = Optional.of((float) map.getDouble("hipCircumference"));
        if (map.hasKey("gender")) {
            int genderIndex = map.getInt("gender");
            ShenAIAndroidSDK.Gender gender = ShenAIAndroidSDK.Gender.values()[genderIndex];
            factors.gender = Optional.of(gender);
        }
        if (map.hasKey("physicalActivity")) {
            int activityIndex = map.getInt("physicalActivity");
            ShenAIAndroidSDK.PhysicalActivity physicalActivity = ShenAIAndroidSDK.PhysicalActivity.values()[activityIndex];
            factors.physicalActivity = Optional.of(physicalActivity);
        }
        if (map.hasKey("country")) factors.country = map.getString("country");
        if (map.hasKey("race")) {
            int raceIndex = map.getInt("race");
            ShenAIAndroidSDK.Race race = ShenAIAndroidSDK.Race.values()[raceIndex];
            factors.race = Optional.of(race);
        }
        if (map.hasKey("historyOfHighGlucose")) factors.historyOfHighGlucose = Optional.of(map.getBoolean("historyOfHighGlucose"));
        if (map.hasKey("historyOfHypertension")) factors.historyOfHypertension = Optional.of(map.getBoolean("historyOfHypertension"));
        if (map.hasKey("vegetableFruitDiet")) factors.vegetableFruitDiet = Optional.of(map.getBoolean("vegetableFruitDiet"));
        if (map.hasKey("fastingGlucose")) factors.fastingGlucose = Optional.of((float) map.getDouble("fastingGlucose"));
        if (map.hasKey("triglyceride")) factors.triglyceride = Optional.of((float) map.getDouble("triglyceride"));
        if (map.hasKey("familyDiabetes")) {
            int familyDiabetesIndex = map.getInt("familyDiabetes");
            ShenAIAndroidSDK.FamilyHistory familyDiabetes = ShenAIAndroidSDK.FamilyHistory.values()[familyDiabetesIndex];
            factors.familyDiabetes = Optional.of(familyDiabetes);
        }
        if (map.hasKey("parentalHypertension")) {
            int parentalHypertensionIndex = map.getInt("parentalHypertension");
            ShenAIAndroidSDK.ParentalHistory parentalHypertension = ShenAIAndroidSDK.ParentalHistory.values()[parentalHypertensionIndex];
            factors.parentalHypertension = Optional.of(parentalHypertension);
        }
         if (map.hasKey("hypertensionTreatment")) {
            int hypertensionTreatmentIndex = map.getInt("hypertensionTreatment");
            ShenAIAndroidSDK.HypertensionTreatment hypertensionTreatment = ShenAIAndroidSDK.HypertensionTreatment.values()[hypertensionTreatmentIndex];
            factors.hypertensionTreatment = Optional.of(hypertensionTreatment);
        }
        return factors;
    }

    private WritableMap writableMapFromRisksFactors(ShenAIAndroidSDK.RisksFactors factors) {
        WritableMap map = Arguments.createMap();
        
        factors.age.ifPresent(value -> map.putInt("age", value));
        factors.cholesterol.ifPresent(value -> map.putDouble("cholesterol", value));
        factors.cholesterolHdl.ifPresent(value -> map.putDouble("cholesterolHdl", value));
        factors.sbp.ifPresent(value -> map.putDouble("sbp", value));
        factors.dbp.ifPresent(value -> map.putDouble("dbp", value));
        factors.isSmoker.ifPresent(value -> map.putBoolean("isSmoker", value));
        factors.hypertensionTreatment.ifPresent(hypertensionTreatment -> map.putInt("hypertensionTreatment", hypertensionTreatment.ordinal()));
        factors.hasDiabetes.ifPresent(value -> map.putBoolean("hasDiabetes", value));
        factors.bodyHeight.ifPresent(value -> map.putDouble("bodyHeight", value));
        factors.bodyWeight.ifPresent(value -> map.putDouble("bodyWeight", value));
        factors.waistCircumference.ifPresent(value -> map.putDouble("waistCircumference", value));
        factors.neckCircumference.ifPresent(value -> map.putDouble("neckCircumference", value));
        factors.hipCircumference.ifPresent(value -> map.putDouble("hipCircumference", value));
        factors.gender.ifPresent(gender -> map.putInt("gender", gender.ordinal()));
        factors.physicalActivity.ifPresent(physicalActivity -> map.putInt("physicalActivity", physicalActivity.ordinal()));
        map.putString("country", factors.country);
        factors.race.ifPresent(race -> map.putInt("race", race.ordinal()));
        factors.fastingGlucose.ifPresent(value -> map.putDouble("fastingGlucose", value));
        factors.triglyceride.ifPresent(value -> map.putDouble("triglyceride", value));
        factors.historyOfHighGlucose.ifPresent(value -> map.putBoolean("historyOfHighGlucose", value));
        factors.historyOfHypertension.ifPresent(value -> map.putBoolean("historyOfHypertension", value));
        factors.vegetableFruitDiet.ifPresent(value -> map.putBoolean("vegetableFruitDiet", value));
        factors.familyDiabetes.ifPresent(familyDiabetes -> map.putInt("familyDiabetes", familyDiabetes.ordinal()));
        factors.parentalHypertension.ifPresent(parentalHypertension -> map.putInt("parentalHypertension", parentalHypertension.ordinal()));
        return map;
    }

    private WritableMap writableMapFromHealthRisks(ShenAIAndroidSDK.HealthRisks risks) {
        WritableMap map = Arguments.createMap();
    
        // HardAndFatalEventsRisks
        WritableMap hardAndFatalEventsMap = Arguments.createMap();
        risks.hardAndFatalEvents.coronaryDeathEventRisk.ifPresent(value -> hardAndFatalEventsMap.putDouble("coronaryDeathEventRisk", value));
        risks.hardAndFatalEvents.fatalStrokeEventRisk.ifPresent(value -> hardAndFatalEventsMap.putDouble("fatalStrokeEventRisk", value));
        risks.hardAndFatalEvents.totalCVMortalityRisk.ifPresent(value -> hardAndFatalEventsMap.putDouble("totalCVMortalityRisk", value));
        risks.hardAndFatalEvents.hardCVEventRisk.ifPresent(value -> hardAndFatalEventsMap.putDouble("hardCVEventRisk", value));
        map.putMap("hardAndFatalEvents", hardAndFatalEventsMap);
    
        // CVDiseasesRisks
        WritableMap cvDiseasesMap = Arguments.createMap();
        risks.cvDiseases.overallRisk.ifPresent(value -> cvDiseasesMap.putDouble("overallRisk", value));
        risks.cvDiseases.coronaryHeartDiseaseRisk.ifPresent(value -> cvDiseasesMap.putDouble("coronaryHeartDiseaseRisk", value));
        risks.cvDiseases.strokeRisk.ifPresent(value -> cvDiseasesMap.putDouble("strokeRisk", value));
        risks.cvDiseases.heartFailureRisk.ifPresent(value -> cvDiseasesMap.putDouble("heartFailureRisk", value));
        risks.cvDiseases.peripheralVascularDiseaseRisk.ifPresent(value -> cvDiseasesMap.putDouble("peripheralVascularDiseaseRisk", value));
        map.putMap("cvDiseases", cvDiseasesMap);
    
        // RisksFactorsScores
        WritableMap scoresMap = Arguments.createMap();
        risks.scores.ageScore.ifPresent(value -> scoresMap.putInt("ageScore", value));
        risks.scores.sbpScore.ifPresent(value -> scoresMap.putInt("sbpScore", value));
        risks.scores.smokingScore.ifPresent(value -> scoresMap.putInt("smokingScore", value));
        risks.scores.diabetesScore.ifPresent(value -> scoresMap.putInt("diabetesScore", value));
        risks.scores.bmiScore.ifPresent(value -> scoresMap.putInt("bmiScore", value));
        risks.scores.cholesterolScore.ifPresent(value -> scoresMap.putInt("cholesterolScore", value));
        risks.scores.cholesterolHdlScore.ifPresent(value -> scoresMap.putInt("cholesterolHdlScore", value));
        risks.scores.totalScore.ifPresent(value -> scoresMap.putInt("totalScore", value));
        map.putMap("scores", scoresMap);

        // Vascular Age
        risks.vascularAge.ifPresent(value -> map.putInt("vascularAge", value));

        // Wellness Score
        risks.wellnessScore.ifPresent(value -> map.putDouble("wellnessScore", value));

        // WHtR, BFP, BMR
        risks.waistToHeightRatio.ifPresent(value -> map.putDouble("waistToHeightRatio", value));
        risks.bodyFatPercentage.ifPresent(value -> map.putDouble("bodyFatPercentage", value));
        risks.basalMetabolicRate.ifPresent(value -> map.putDouble("basalMetabolicRate", value));
        
        // BRI, CI, TDEE, ABSI
        risks.bodyRoundnessIndex.ifPresent(value -> map.putDouble("bodyRoundnessIndex", value));
        risks.conicityIndex.ifPresent(value -> map.putDouble("conicityIndex", value));
        risks.aBodyShapeIndex.ifPresent(value -> map.putDouble("aBodyShapeIndex", value));
        risks.totalDailyEnergyExpenditure.ifPresent(value -> map.putDouble("totalDailyEnergyExpenditure", value));

        // HR, DR, NAFLDR
        risks.hypertensionRisk.ifPresent(value -> map.putDouble("hypertensionRisk", value));
        risks.diabetesRisk.ifPresent(value -> map.putDouble("diabetesRisk", value));
        risks.nonAlcoholicFattyLiverDiseaseRisk.ifPresent(value -> map.putInt("nonAlcoholicFattyLiverDiseaseRisk", value.ordinal()));

        return map;
    }

    @ReactMethod
    public void getHealthRisksFactors(Promise promise) {
        try {
            ShenAIAndroidSDK.RisksFactors factors = shenai_sdk.getHealthRisksFactors();
            WritableMap result = writableMapFromRisksFactors(factors);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR_GET_RISKS_FACTORS", e.getMessage());
        }
    }

    @ReactMethod
    public void clearHealthRisksFactors(Promise promise) {
        try {
            shenai_sdk.clearHealthRisksFactors();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("ERROR_CLEAR_RISKS_FACTORS", e.getMessage());
        }
    }

    @ReactMethod
    public void getHealthRisks(Promise promise) {
        try {
            ShenAIAndroidSDK.HealthRisks risks = shenai_sdk.getHealthRisks();
            WritableMap result = writableMapFromHealthRisks(risks);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR_GET_RISKS", e.getMessage());
        }
    }

    @ReactMethod
    public void computeHealthRisks(ReadableMap factorsMap, Promise promise) {
        ShenAIAndroidSDK.RisksFactors factors = risksFactorsFromReadableMap(factorsMap);
        try {
            ShenAIAndroidSDK.HealthRisks risks = shenai_sdk.computeHealthRisks(factors);
            WritableMap result = writableMapFromHealthRisks(risks);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR_COMPUTE_RISKS", e.getMessage());
        }
    }

    @ReactMethod
    public void getMaximalRisks(ReadableMap factorsMap, Promise promise) {
        ShenAIAndroidSDK.RisksFactors factors = risksFactorsFromReadableMap(factorsMap);
        try {
            ShenAIAndroidSDK.HealthRisks risks = shenai_sdk.getMaximalHealthRisks(factors);
            WritableMap result = writableMapFromHealthRisks(risks);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR_MAXIMAL_RISKS", e.getMessage());
        }
    }

    @ReactMethod
    public void getMinimalRisks(ReadableMap factorsMap, Promise promise) {
        ShenAIAndroidSDK.RisksFactors factors = risksFactorsFromReadableMap(factorsMap);
        try {
            ShenAIAndroidSDK.HealthRisks risks = shenai_sdk.getMinimalHealthRisks(factors);
            WritableMap result = writableMapFromHealthRisks(risks);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR_MINIMAL_RISKS", e.getMessage());
        }
    }

    @ReactMethod
    public void getReferenceRisks(ReadableMap factorsMap, Promise promise) {
        ShenAIAndroidSDK.RisksFactors factors = risksFactorsFromReadableMap(factorsMap);
        try {
            ShenAIAndroidSDK.HealthRisks risks = shenai_sdk.getReferenceHealthRisks(factors);
            WritableMap result = writableMapFromHealthRisks(risks);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR_REFERENCE_RISKS", e.getMessage());
        }
    }


    @ReactMethod
    public void openMeasurementResultsPdfInBrowser(Promise promise) {
        shenai_sdk.openMeasurementResultsPdfInBrowser();
        promise.resolve(null);
    }

    @ReactMethod
    public void sendMeasurementResultsPdfToEmail(String email, Promise promise) {
        shenai_sdk.sendMeasurementResultsPdfToEmail(email);
        promise.resolve(null);
    }

    @ReactMethod
    public void requestMeasurementResultsPdfUrl(Promise promise) {
        shenai_sdk.requestMeasurementResultsPdfUrl();
        promise.resolve(null);
    }

    @ReactMethod
    public void getMeasurementResultsPdfUrl(Promise promise) {
        String url = shenai_sdk.getMeasurementResultsPdfUrl();
        if (url == null || url.isEmpty()) {
            promise.resolve(null);
        } else {
            promise.resolve(url);
        }
    }

    @ReactMethod
    public void requestMeasurementResultsPdfBytes(Promise promise) {
        shenai_sdk.requestMeasurementResultsPdfBytes();
        promise.resolve(null);
    }

    @ReactMethod
    public void getMeasurementResultsPdfBytes(Promise promise) {
        byte[] bytes = shenai_sdk.getMeasurementResultsPdfBytes();
        if (bytes == null) {
            promise.resolve(null);
            return;
        }
        promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP));
    }

    @ReactMethod
    public void getResultAsFhirObservation(Promise promise) {
        String observation = shenai_sdk.getResultAsFhirObservation();
        if (observation == null || observation.isEmpty()) {
            promise.resolve(null);
        } else {
            promise.resolve(observation);
        }
    }

    @ReactMethod
    public void sendResultFhirObservation(String url, Promise promise) {
        shenai_sdk.sendResultFhirObservation(url, response -> {
            final String result = (response == null || response.isEmpty()) ? null : response;
            UiThreadUtil.runOnUiThread(() -> promise.resolve(result));
        });
    }
}

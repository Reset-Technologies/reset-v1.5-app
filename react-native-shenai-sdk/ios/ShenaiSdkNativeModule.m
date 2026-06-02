#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <ShenaiSDK/ShenaiHealthRisks.h>
#import <ShenaiSDK/ShenaiSDK.h>

static id ShenaiMeasurementQualityMetricsToDictionary(MeasurementQualityMetrics *metrics) {
  if (metrics == nil) {
    return (NSDictionary *)[NSNull null];
  }
  return @{
    @"ppgQualityIndex" : metrics.ppgQualityIndex ?: [NSNull null],
    @"bcgQualityIndex" : metrics.bcgQualityIndex ?: [NSNull null],
    @"bloodPressureQualityIndex" : metrics.bloodPressureQualityIndex ?: [NSNull null],
    @"expectedSbpMedianAbsErrorMmhg" : metrics.expectedSbpMedianAbsErrorMmhg ?: [NSNull null],
    @"expectedSbpP80AbsErrorMmhg" : metrics.expectedSbpP80AbsErrorMmhg ?: [NSNull null],
    @"expectedSbpMeanAbsErrorMmhg" : metrics.expectedSbpMeanAbsErrorMmhg ?: [NSNull null],
    @"expectedSbpBalancedMaeMmhg" : metrics.expectedSbpBalancedMaeMmhg ?: [NSNull null],
    @"expectedDbpMedianAbsErrorMmhg" : metrics.expectedDbpMedianAbsErrorMmhg ?: [NSNull null],
    @"expectedDbpP80AbsErrorMmhg" : metrics.expectedDbpP80AbsErrorMmhg ?: [NSNull null],
    @"expectedDbpMeanAbsErrorMmhg" : metrics.expectedDbpMeanAbsErrorMmhg ?: [NSNull null],
    @"expectedDbpBalancedMaeMmhg" : metrics.expectedDbpBalancedMaeMmhg ?: [NSNull null],
  };
}

@interface ShenaiSdkNativeModule : RCTEventEmitter <RCTBridgeModule>

@end

@implementation ShenaiSdkNativeModule {
  BOOL hasListeners;
}

RCT_EXPORT_MODULE();  // This macro exports the module to React Native

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"ShenAIEvent" ];
}

- (void)startObserving {
  hasListeners = YES;
}

- (void)stopObserving {
  hasListeners = NO;
}

- (void)sendShenaiEvent:(NSString *)name {
  [self sendEventWithName:@"ShenAIEvent" body:@{@"EventName" : name}];
}

RCT_EXPORT_METHOD(initialize
                  : (NSString *)apiKey userId
                  : (NSString *)userId settings
                  : (NSDictionary *)settings resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  InitializationSettings *initSettings = [[InitializationSettings alloc] init];

  // Set settings if they are provided
  if (settings[@"precisionMode"]) {
    initSettings.precisionMode = [settings[@"precisionMode"] integerValue];
  }
  if (settings[@"operatingMode"]) {
    initSettings.operatingMode = [settings[@"operatingMode"] integerValue];
  }
  if (settings[@"measurementPreset"]) {
    NSNumber *presetValue = settings[@"measurementPreset"];
    NSLog(@"Received preset: %@", presetValue);
    initSettings.measurementPreset = presetValue.integerValue;
  } else {
    NSLog(@"No preset received");
  }
  if (settings[@"cameraMode"]) {
    initSettings.cameraMode = [settings[@"cameraMode"] integerValue];
  }
  if (settings[@"onboardingMode"]) {
    initSettings.onboardingMode = [settings[@"onboardingMode"] integerValue];
  }
  if (settings[@"initializationMode"]) {
    initSettings.initializationMode = [settings[@"initializationMode"] integerValue];
  }
  if (settings[@"offlineProcessing"]) {
    initSettings.offlineProcessing = [settings[@"offlineProcessing"] boolValue];
  }
  if (settings[@"showUserInterface"]) {
    initSettings.showUserInterface = [settings[@"showUserInterface"] boolValue];
  }
  if (settings[@"showFacePositioningOverlay"]) {
    initSettings.showFacePositioningOverlay = [settings[@"showFacePositioningOverlay"] boolValue];
  }
  if (settings[@"showVisualWarnings"]) {
    initSettings.showVisualWarnings = [settings[@"showVisualWarnings"] boolValue];
  }
  if (settings[@"enableCameraSwap"]) {
    initSettings.enableCameraSwap = [settings[@"enableCameraSwap"] boolValue];
  }
  if (settings[@"showFaceMask"]) {
    initSettings.showFaceMask = [settings[@"showFaceMask"] boolValue];
  }
  if (settings[@"showBloodFlow"]) {
    initSettings.showBloodFlow = [settings[@"showBloodFlow"] boolValue];
  }
  if (settings[@"hideShenaiLogo"]) {
    initSettings.hideShenaiLogo = [settings[@"hideShenaiLogo"] boolValue];
  }
  if (settings[@"includeTimestampInPdf"]) {
    initSettings.includeTimestampInPdf = [settings[@"includeTimestampInPdf"] boolValue];
  }
  if (settings[@"enableStartAfterSuccess"]) {
    initSettings.enableStartAfterSuccess = [settings[@"enableStartAfterSuccess"] boolValue];
  }
  if (settings[@"enableSummaryScreen"]) {
    initSettings.enableSummaryScreen = [settings[@"enableSummaryScreen"] boolValue];
  }
  if (settings[@"showResultsFinishButton"]) {
    initSettings.showResultsFinishButton = [settings[@"showResultsFinishButton"] boolValue];
  }
  if (settings[@"enableHealthRisks"]) {
    initSettings.enableHealthRisks = [settings[@"enableHealthRisks"] boolValue];
  }
  if (settings[@"showHealthIndicesFinishButton"]) {
    initSettings.showHealthIndicesFinishButton = [settings[@"showHealthIndicesFinishButton"] boolValue];
  }
  if (settings[@"saveHealthRisksFactors"]) {
    initSettings.saveHealthRisksFactors = [settings[@"saveHealthRisksFactors"] boolValue];
  }
  if (settings[@"showOutOfRangeResultIndicators"]) {
    initSettings.showOutOfRangeResultIndicators = [settings[@"showOutOfRangeResultIndicators"] boolValue];
  }
  if (settings[@"showSignalQualityIndicator"]) {
    initSettings.showSignalQualityIndicator = [settings[@"showSignalQualityIndicator"] boolValue];
  }
  if (settings[@"showSignalTile"]) {
    initSettings.showSignalTile = [settings[@"showSignalTile"] boolValue];
  }
  if (settings[@"showStartStopButton"]) {
    initSettings.showStartStopButton = [settings[@"showStartStopButton"] boolValue];
  }
  if (settings[@"showInfoButton"]) {
    initSettings.showInfoButton = [settings[@"showInfoButton"] boolValue];
  }
  if (settings[@"showDisclaimer"]) {
    initSettings.showDisclaimer = [settings[@"showDisclaimer"] boolValue];
  }
  if (settings[@"enableMeasurementsDashboard"]) {
    initSettings.enableMeasurementsDashboard = [settings[@"enableMeasurementsDashboard"] boolValue];
  }
  if (settings[@"uiVersion"]) {
    initSettings.uiVersion = (UiVersion)[settings[@"uiVersion"] integerValue];
  }
  if (settings[@"showTrialMetricLabels"]) {
    initSettings.showTrialMetricLabels = [settings[@"showTrialMetricLabels"] boolValue];
  }
  if (settings[@"applyPrecisionModeToBloodPressure"]) {
    initSettings.applyPrecisionModeToBloodPressure = [settings[@"applyPrecisionModeToBloodPressure"] boolValue];
  }
  if (settings[@"blockingMeasurementConditions"]) {
    NSArray *conditions = settings[@"blockingMeasurementConditions"];
    NSMutableArray<NSNumber *> *values = [NSMutableArray arrayWithCapacity:conditions.count];
    for (NSNumber *condition in conditions) {
      [values addObject:@(condition.integerValue)];
    }
    initSettings.blockingMeasurementConditions = values;
  }
  if (settings[@"warningMeasurementConditions"]) {
    NSArray *conditions = settings[@"warningMeasurementConditions"];
    NSMutableArray<NSNumber *> *values = [NSMutableArray arrayWithCapacity:conditions.count];
    for (NSNumber *condition in conditions) {
      [values addObject:@(condition.integerValue)];
    }
    initSettings.warningMeasurementConditions = values;
  }
  if (settings[@"uiFlowScreens"]) {
    NSArray *screens = settings[@"uiFlowScreens"];
    NSMutableArray<NSNumber *> *values = [NSMutableArray arrayWithCapacity:screens.count];
    for (NSNumber *screen in screens) {
      [values addObject:@(screen.integerValue)];
    }
    initSettings.uiFlowScreens = values;
  }
  if (settings[@"frameWidth"]) {
    initSettings.frameWidth = [settings[@"frameWidth"] intValue];
  }
  if (settings[@"frameHeight"]) {
    initSettings.frameHeight = [settings[@"frameHeight"] intValue];
  }
  if (settings[@"rotation"]) {
    initSettings.rotation = [settings[@"rotation"] intValue];
  }
  if (settings[@"risksFactors"]) {
    initSettings.risksFactors = [self risksFactorsFromDictionary:settings[@"risksFactors"]];
  }

  initSettings.eventCallback = ^(Event event) {
    NSString *jsEvent = @"UNKNOWN";

    switch (event) {
      case EventStartButtonClicked:
        jsEvent = @"START_BUTTON_CLICKED";
        break;
      case EventStopButtonClicked:
        jsEvent = @"STOP_BUTTON_CLICKED";
        break;
      case EventMeasurementFinished:
        jsEvent = @"MEASUREMENT_FINISHED";
        break;
      case EventUserFlowFinished:
        jsEvent = @"USER_FLOW_FINISHED";
        break;
      case EventScreenChanged:
        jsEvent = @"SCREEN_CHANGED";
        break;
    }
    if (hasListeners) {
      [self sendEventWithName:@"ShenAIEvent" body:@{@"EventName" : jsEvent}];
    }
  };
  InitializationResult result = [ShenaiSDK initialize:apiKey userID:userId settings:initSettings];

  resolve(@(result));
}

RCT_EXPORT_METHOD(getRealtimeMetrics
                  : (float)periodSec resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  MeasurementResults *results = [ShenaiSDK getRealtimeMetrics:periodSec];
  if (results) {
    NSMutableArray *heartbeatsArray = [NSMutableArray arrayWithCapacity:results.heartbeats.count];
    for (Heartbeat *heartbeat in results.heartbeats) {
      [heartbeatsArray addObject:@{
        @"startLocationSec" : @(heartbeat.startLocationSec),
        @"endLocationSec" : @(heartbeat.endLocationSec),
        @"durationMs" : @(heartbeat.durationMs)
      }];
    }

    NSDictionary *resultsDict = @{
      @"heartRateBpm" : @(results.heartRateBpm),
      @"hrvSdnnMs" : results.hrvSdnnMs ?: [NSNull null],
      @"hrvLnrmssdMs" : results.hrvLnrmssdMs ?: [NSNull null],
      @"stressIndex" : results.stressIndex ?: [NSNull null],
      @"parasympatheticActivity" : results.parasympatheticActivity ?: [NSNull null],
      @"breathingRateBpm" : results.breathingRateBpm ?: [NSNull null],
      @"systolicBloodPressureMmhg" : results.systolicBloodPressureMmhg ?: [NSNull null],
      @"diastolicBloodPressureMmhg" : results.diastolicBloodPressureMmhg ?: [NSNull null],
      @"cardiacWorkloadMmhgPerSec" : results.cardiacWorkloadMmhgPerSec ?: [NSNull null],
      @"ageYears" : results.ageYears ?: [NSNull null],
      @"bmiKgPerM2" : results.bmiKgPerM2 ?: [NSNull null],
      @"bmiCategory" : @(results.bmiCategory),
      @"weightKg" : results.weightKg ?: [NSNull null],
      @"heightCm" : results.heightCm ?: [NSNull null],
      @"qualityMetrics" : ShenaiMeasurementQualityMetricsToDictionary(results.qualityMetrics),
      @"heartbeats" : heartbeatsArray,
      @"averageSignalQuality" : @(results.averageSignalQuality)
    };
    resolve(resultsDict);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(setCustomMeasurementConfig
                  : (NSDictionary *)config resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  if (!config) {
    reject(@"E_CONFIG_NULL", @"Configuration is null", nil);
    return;
  }

  CustomMeasurementConfig *measurementConfig = [[CustomMeasurementConfig alloc] init];

  // Assuming your SDK has a method to apply this config
  measurementConfig.durationSeconds = config[@"durationSeconds"];
  measurementConfig.infiniteMeasurement = [config[@"infiniteMeasurement"] boolValue];

  {
    NSArray *metricsArray = config[@"instantMetrics"];
    if (metricsArray != nil) {
      NSMutableArray<NSNumber *> *metricsEnumArray = [NSMutableArray arrayWithCapacity:[metricsArray count]];
      for (NSNumber *metricNumber in metricsArray) {
        [metricsEnumArray addObject:@([metricNumber integerValue])];
      }
      measurementConfig.instantMetrics = metricsEnumArray;
    }
  }
  {
    NSArray *metricsArray = config[@"summaryMetrics"];
    if (metricsArray != nil) {
      NSMutableArray<NSNumber *> *metricsEnumArray = [NSMutableArray arrayWithCapacity:[metricsArray count]];
      for (NSNumber *metricNumber in metricsArray) {
        [metricsEnumArray addObject:@([metricNumber integerValue])];
      }
      measurementConfig.summaryMetrics = metricsEnumArray;
    }
  }
  {
    NSArray *healthIndicesArray = config[@"healthIndices"];
    if (healthIndicesArray != nil) {
      NSMutableArray<NSNumber *> *healthIndicesEnumArray =
          [NSMutableArray arrayWithCapacity:[healthIndicesArray count]];
      for (NSNumber *healthIndexNumber in healthIndicesArray) {
        [healthIndicesEnumArray addObject:@([healthIndexNumber integerValue])];
      }
      measurementConfig.healthIndices = healthIndicesEnumArray;
    }
  }

  measurementConfig.realtimeHrPeriodSeconds = config[@"realtimeHrPeriodSeconds"];
  measurementConfig.realtimeHrvPeriodSeconds = config[@"realtimeHrvPeriodSeconds"];
  measurementConfig.realtimeCardiacStressPeriodSeconds = config[@"realtimeCardiacStressPeriodSeconds"];

  // Apply the configuration to your SDK
  [ShenaiSDK setCustomMeasurementConfig:measurementConfig];

  resolve(@(YES));
}

RCT_EXPORT_METHOD(setCustomColorTheme
                  : (NSDictionary *)theme resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  if (!theme) {
    reject(@"E_THEME_NULL", @"Theme is null", nil);
    return;
  }

  CustomColorTheme *colorTheme = [[CustomColorTheme alloc] init];

  // Assuming your SDK has a method to apply this theme
  colorTheme.themeColor = theme[@"themeColor"];
  colorTheme.textColor = theme[@"textColor"];
  colorTheme.backgroundColor = theme[@"backgroundColor"];
  colorTheme.tileColor = theme[@"tileColor"];
  colorTheme.buttonMainColor = theme[@"buttonMainColor"];
  colorTheme.buttonSecondaryColor = theme[@"buttonSecondaryColor"];

  // Apply the theme to your SDK
  [ShenaiSDK setCustomColorTheme:colorTheme];

  resolve(@(YES));
}

RCT_EXPORT_METHOD(getMeasurementResults : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  MeasurementResults *results = [ShenaiSDK getMeasurementResults];
  if (results) {
    NSMutableArray *heartbeatsArray = [NSMutableArray arrayWithCapacity:results.heartbeats.count];
    for (Heartbeat *heartbeat in results.heartbeats) {
      [heartbeatsArray addObject:@{
        @"startLocationSec" : @(heartbeat.startLocationSec),
        @"endLocationSec" : @(heartbeat.endLocationSec),
        @"durationMs" : @(heartbeat.durationMs)
      }];
    }

    NSDictionary *resultsDict = @{
      @"heartRateBpm" : @(results.heartRateBpm),
      @"hrvSdnnMs" : results.hrvSdnnMs ?: [NSNull null],
      @"hrvLnrmssdMs" : results.hrvLnrmssdMs ?: [NSNull null],
      @"stressIndex" : results.stressIndex ?: [NSNull null],
      @"parasympatheticActivity" : results.parasympatheticActivity ?: [NSNull null],
      @"breathingRateBpm" : results.breathingRateBpm ?: [NSNull null],
      @"systolicBloodPressureMmhg" : results.systolicBloodPressureMmhg ?: [NSNull null],
      @"diastolicBloodPressureMmhg" : results.diastolicBloodPressureMmhg ?: [NSNull null],
      @"cardiacWorkloadMmhgPerSec" : results.cardiacWorkloadMmhgPerSec ?: [NSNull null],
      @"ageYears" : results.ageYears ?: [NSNull null],
      @"bmiKgPerM2" : results.bmiKgPerM2 ?: [NSNull null],
      @"bmiCategory" : @(results.bmiCategory),
      @"weightKg" : results.weightKg ?: [NSNull null],
      @"heightCm" : results.heightCm ?: [NSNull null],
      @"qualityMetrics" : ShenaiMeasurementQualityMetricsToDictionary(results.qualityMetrics),
      @"heartbeats" : heartbeatsArray,
      @"averageSignalQuality" : @(results.averageSignalQuality)
    };
    resolve(resultsDict);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(getMeasurementResultsHistory
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  MeasurementResultsHistory *history = [ShenaiSDK getMeasurementResultsHistory];

  if (!history) {
    resolve([NSNull null]);
    return;
  }

  NSMutableArray *outerArray = [NSMutableArray arrayWithCapacity:history.history.count];
  for (MeasurementResultsWithMetadata *item in history.history) {
    MeasurementResults *res = item.measurementResults;
    NSMutableArray *heartbeatsArray = [NSMutableArray arrayWithCapacity:res.heartbeats.count];
    for (Heartbeat *hb in res.heartbeats) {
      [heartbeatsArray addObject:@{
        @"startLocationSec" : @(hb.startLocationSec),
        @"endLocationSec" : @(hb.endLocationSec),
        @"durationMs" : @(hb.durationMs)
      }];
    }

    NSDictionary *resultsDict = @{
      @"heartRateBpm" : @(res.heartRateBpm),
      @"hrvSdnnMs" : res.hrvSdnnMs ?: [NSNull null],
      @"hrvLnrmssdMs" : res.hrvLnrmssdMs ?: [NSNull null],
      @"stressIndex" : res.stressIndex ?: [NSNull null],
      @"parasympatheticActivity" : res.parasympatheticActivity ?: [NSNull null],
      @"breathingRateBpm" : res.breathingRateBpm ?: [NSNull null],
      @"systolicBloodPressureMmhg" : res.systolicBloodPressureMmhg ?: [NSNull null],
      @"diastolicBloodPressureMmhg" : res.diastolicBloodPressureMmhg ?: [NSNull null],
      @"cardiacWorkloadMmhgPerSec" : res.cardiacWorkloadMmhgPerSec ?: [NSNull null],
      @"ageYears" : res.ageYears ?: [NSNull null],
      @"bmiKgPerM2" : res.bmiKgPerM2 ?: [NSNull null],
      @"bmiCategory" : @(res.bmiCategory),
      @"weightKg" : res.weightKg ?: [NSNull null],
      @"heightCm" : res.heightCm ?: [NSNull null],
      @"qualityMetrics" : ShenaiMeasurementQualityMetricsToDictionary(res.qualityMetrics),
      @"heartbeats" : heartbeatsArray,
      @"averageSignalQuality" : @(res.averageSignalQuality)
    };

    NSDictionary *itemDict = @{
      @"measurementResults" : resultsDict,
      @"epochTimestamp" : item.epochTimestamp,
      @"isCalibration" : @(item.isCalibration)
    };

    [outerArray addObject:itemDict];
  }

  NSDictionary *finalDict = @{@"history" : outerArray};
  resolve(finalDict);
}

RCT_EXPORT_METHOD(isInitialized : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL isInitialized = [ShenaiSDK isInitialized];
  resolve(@(isInitialized));
}

RCT_EXPORT_METHOD(deinitialize) { [ShenaiSDK deinitialize]; }

RCT_EXPORT_METHOD(setOperatingMode : (NSInteger)mode) { [ShenaiSDK setOperatingMode:mode]; }

RCT_EXPORT_METHOD(startMeasurement) { [ShenaiSDK startMeasurement]; }

RCT_EXPORT_METHOD(stopMeasurement) { [ShenaiSDK stopMeasurement]; }

RCT_EXPORT_METHOD(resetMeasurementSession) { [ShenaiSDK resetMeasurementSession]; }

RCT_EXPORT_METHOD(getOperatingMode : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  OperatingMode mode = [ShenaiSDK getOperatingMode];
  resolve(@(mode));
}

RCT_EXPORT_METHOD(getCalibrationState : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  CalibrationState mode = [ShenaiSDK getCalibrationState];
  resolve(@(mode));
}

RCT_EXPORT_METHOD(setPrecisionMode : (NSInteger)mode) { [ShenaiSDK setPrecisionMode:mode]; }

RCT_EXPORT_METHOD(getPrecisionMode : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  PrecisionMode mode = [ShenaiSDK getPrecisionMode];
  resolve(@(mode));
}

RCT_EXPORT_METHOD(setApplyPrecisionModeToBloodPressure : (BOOL)apply) {
  [ShenaiSDK setApplyPrecisionModeToBloodPressure:apply];
}

RCT_EXPORT_METHOD(getApplyPrecisionModeToBloodPressure
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve(@([ShenaiSDK getApplyPrecisionModeToBloodPressure]));
}

RCT_EXPORT_METHOD(setBlockingMeasurementConditions : (NSArray<NSNumber *> *)conditions) {
  [ShenaiSDK setBlockingMeasurementConditions:conditions ?: @[]];
}

RCT_EXPORT_METHOD(getBlockingMeasurementConditions
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([ShenaiSDK getBlockingMeasurementConditions]);
}

RCT_EXPORT_METHOD(setWarningMeasurementConditions : (NSArray<NSNumber *> *)conditions) {
  [ShenaiSDK setWarningMeasurementConditions:conditions ?: @[]];
}

RCT_EXPORT_METHOD(getWarningMeasurementConditions
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([ShenaiSDK getWarningMeasurementConditions]);
}

RCT_EXPORT_METHOD(getCurrentViolatedMeasurementEnvironmentCondition
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve([ShenaiSDK getCurrentViolatedMeasurementEnvironmentCondition]);
}

RCT_EXPORT_METHOD(setMeasurementPreset : (NSInteger)preset) { [ShenaiSDK setMeasurementPreset:preset]; }

RCT_EXPORT_METHOD(getMeasurementPreset : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  MeasurementPreset preset = [ShenaiSDK getMeasurementPreset];
  resolve(@(preset));
}

RCT_EXPORT_METHOD(setCameraMode : (NSInteger)mode) { [ShenaiSDK setCameraMode:mode]; }

RCT_EXPORT_METHOD(getCameraMode : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  CameraMode mode = [ShenaiSDK getCameraMode];
  resolve(@(mode));
}

RCT_EXPORT_METHOD(getLastCameraError : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  resolve([ShenaiSDK getLastCameraError]);
}

RCT_EXPORT_METHOD(setScreen : (NSInteger)screen) { [ShenaiSDK setScreen:screen]; }

RCT_EXPORT_METHOD(getScreen : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  Screen screen = [ShenaiSDK getScreen];
  resolve(@(screen));
}

// SDK Interface Elements

// User Interface
RCT_EXPORT_METHOD(setShowUserInterface : (BOOL)show) { [ShenaiSDK setShowUserInterface:show]; }

RCT_EXPORT_METHOD(getShowUserInterface : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowUserInterface];
  resolve(@(show));
}

// Face Positioning Overlay
RCT_EXPORT_METHOD(setShowFacePositioningOverlay : (BOOL)show) { [ShenaiSDK setShowFacePositioningOverlay:show]; }

RCT_EXPORT_METHOD(getShowFacePositioningOverlay
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowFacePositioningOverlay];
  resolve(@(show));
}

// Visual Warnings
RCT_EXPORT_METHOD(setShowVisualWarnings : (BOOL)show) { [ShenaiSDK setShowVisualWarnings:show]; }

RCT_EXPORT_METHOD(getShowVisualWarnings : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowVisualWarnings];
  resolve(@(show));
}

// Camera Swap
RCT_EXPORT_METHOD(setEnableCameraSwap : (BOOL)enable) { [ShenaiSDK setEnableCameraSwap:enable]; }

RCT_EXPORT_METHOD(getEnableCameraSwap : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL enable = [ShenaiSDK getEnableCameraSwap];
  resolve(@(enable));
}

// Face Mask
RCT_EXPORT_METHOD(setShowFaceMask : (BOOL)show) { [ShenaiSDK setShowFaceMask:show]; }

RCT_EXPORT_METHOD(getShowFaceMask : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowFaceMask];
  resolve(@(show));
}

// Blood Flow
RCT_EXPORT_METHOD(setShowBloodFlow : (BOOL)show) { [ShenaiSDK setShowBloodFlow:show]; }

RCT_EXPORT_METHOD(getShowBloodFlow : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowBloodFlow];
  resolve(@(show));
}

RCT_EXPORT_METHOD(setIncludeTimestampInPdf : (BOOL)include) { [ShenaiSDK setIncludeTimestampInPdf:include]; }

RCT_EXPORT_METHOD(getIncludeTimestampInPdf : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL include = [ShenaiSDK getIncludeTimestampInPdf];
  resolve(@(include));
}

RCT_EXPORT_METHOD(setShowStartStopButton : (BOOL)show) { [ShenaiSDK setShowStartStopButton:show]; }

RCT_EXPORT_METHOD(getShowStartStopButton : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowStartStopButton];
  resolve(@(show));
}

RCT_EXPORT_METHOD(setEnableMeasurementsDashboard : (BOOL)enable) { [ShenaiSDK setEnableMeasurementsDashboard:enable]; }

RCT_EXPORT_METHOD(getEnableMeasurementsDashboard
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  BOOL enabled = [ShenaiSDK getEnableMeasurementsDashboard];
  resolve(@(enabled));
}

RCT_EXPORT_METHOD(setShowInfoButton : (BOOL)show) { [ShenaiSDK setShowInfoButton:show]; }

RCT_EXPORT_METHOD(getShowInfoButton : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowInfoButton];
  resolve(@(show));
}

RCT_EXPORT_METHOD(getShowDisclaimer : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL show = [ShenaiSDK getShowDisclaimer];
  resolve(@(show));
}

// Start After Success
RCT_EXPORT_METHOD(setEnableStartAfterSuccess : (BOOL)enable) { [ShenaiSDK setEnableStartAfterSuccess:enable]; }

RCT_EXPORT_METHOD(getEnableStartAfterSuccess
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  BOOL enable = [ShenaiSDK getEnableStartAfterSuccess];
  resolve(@(enable));
}

// SDK Face Positioning

RCT_EXPORT_METHOD(getFaceState : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  FaceState faceState = [ShenaiSDK getFaceState];
  resolve(@(faceState));
}

RCT_EXPORT_METHOD(getNormalizedFaceBbox : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NormalizedFaceBbox *faceBbox = [ShenaiSDK getNormalizedFaceBbox];
  if (faceBbox) {
    NSDictionary *bboxDict =
        @{@"x" : @(faceBbox.x),
          @"y" : @(faceBbox.y),
          @"width" : @(faceBbox.width),
          @"height" : @(faceBbox.height)};
    resolve(bboxDict);
  } else {
    resolve([NSNull null]);
  }
}

// SDK Measurement State

RCT_EXPORT_METHOD(getMeasurementState : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  MeasurementState measurementState = [ShenaiSDK getMeasurementState];
  resolve(@(measurementState));
}

RCT_EXPORT_METHOD(isReadyToStartMeasurement
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve(@([ShenaiSDK isReadyToStartMeasurement]));
}

RCT_EXPORT_METHOD(areRequiredModelsDownloaded
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  resolve(@([ShenaiSDK areRequiredModelsDownloaded]));
}

RCT_EXPORT_METHOD(getMeasurementProgressPercentage
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  float progressPercentage = [ShenaiSDK getMeasurementProgressPercentage];
  resolve(@(progressPercentage));
}

// SDK Measurement Results

RCT_EXPORT_METHOD(getHeartRate10s : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NSNumber *heartRate10s = [ShenaiSDK getHeartRate10s];
  if (heartRate10s) {
    resolve(heartRate10s);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(getHeartRate4s : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NSNumber *heartRate4s = [ShenaiSDK getHeartRate4s];
  if (heartRate4s) {
    resolve(heartRate4s);
  } else {
    resolve([NSNull null]);
  }
}

// SDK Signals

// The JS API exposes these methods on iOS as well. The underlying iOS SDK currently doesn't provide
// a native HR time-series, so return an empty array instead of crashing with "undefined is not a function".
RCT_EXPORT_METHOD(getHeartRateHistory10s
                  : (nullable NSNumber *)maxTimeSec resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  (void)maxTimeSec;
  resolve(@[]);
}

RCT_EXPORT_METHOD(getHeartRateHistory4s
                  : (nullable NSNumber *)maxTimeSec resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  (void)maxTimeSec;
  resolve(@[]);
}

RCT_EXPORT_METHOD(getRealtimeHeartbeats
                  : (nullable NSNumber *)periodSec resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  NSArray<Heartbeat *> *heartbeats = [ShenaiSDK getRealtimeHeartbeats:periodSec];
  NSMutableArray *resultArray = [NSMutableArray array];
  for (Heartbeat *heartbeat in heartbeats) {
    [resultArray addObject:@{
      @"startLocationSec" : @(heartbeat.startLocationSec),
      @"endLocationSec" : @(heartbeat.endLocationSec),
      @"durationMs" : @(heartbeat.durationMs)
    }];
  }
  resolve(resultArray);
}

RCT_EXPORT_METHOD(getFullPpgSignal : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NSArray<NSNumber *> *ppgSignal = [ShenaiSDK getFullPPGSignal];
  resolve(ppgSignal);
}

// SDK Recording

RCT_EXPORT_METHOD(setRecordingEnabled : (BOOL)enabled) { [ShenaiSDK setRecordingEnabled:enabled]; }

RCT_EXPORT_METHOD(getRecordingEnabled : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  BOOL isEnabled = [ShenaiSDK isRecordingEnabled];
  resolve(@(isEnabled));
}

// SDK Quality Control

RCT_EXPORT_METHOD(getTotalBadSignalSeconds : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  float totalBadSeconds = [ShenaiSDK getTotalBadSignalSeconds];
  resolve(@(totalBadSeconds));
}

RCT_EXPORT_METHOD(getCurrentSignalQualityMetric
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  float signalQuality = [ShenaiSDK getCurrentSignalQualityMetric];
  resolve(@(signalQuality));
}

// SDK Visualizations

RCT_EXPORT_METHOD(getSignalQualityMapPng : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NSData *data = [ShenaiSDK getSignalQualityMapPng];
  if (!data || data.length == 0) {
    resolve([NSNull null]);
    return;
  }

  const UInt8 *buffer = (const UInt8 *)data.bytes;
  NSUInteger length = data.length;
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:length];
  for (NSUInteger i = 0; i < length; i++) {
    [array addObject:@(buffer[i])];
  }
  resolve(array);
}

RCT_EXPORT_METHOD(getFaceTexturePng : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  NSData *data = [ShenaiSDK getFaceTexturePng];
  if (!data || data.length == 0) {
    resolve([NSNull null]);
    return;
  }

  const UInt8 *buffer = (const UInt8 *)data.bytes;
  NSUInteger length = data.length;
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:length];
  for (NSUInteger i = 0; i < length; i++) {
    [array addObject:@(buffer[i])];
  }
  resolve(array);
}

RCT_EXPORT_METHOD(setLanguage : (NSString *)language) { [ShenaiSDK setLanguage:language]; }

// Utility method to convert RisksFactors JS object to RisksFactors Objective-C object
- (RisksFactors *)risksFactorsFromDictionary:(NSDictionary *)dict {
  RisksFactors *factors = [[RisksFactors alloc] initWithAge:dict[@"age"]
                                                cholesterol:dict[@"cholesterol"]
                                             cholesterolHDL:dict[@"cholesterolHdl"]
                                                        sbp:dict[@"sbp"]
                                                        dbp:dict[@"dbp"]
                                                   isSmoker:dict[@"isSmoker"]
                                      hypertensionTreatment:[dict[@"hypertensionTreatment"] integerValue]
                                                hasDiabetes:dict[@"hasDiabetes"]
                                                 bodyHeight:dict[@"bodyHeight"]
                                                 bodyWeight:dict[@"bodyWeight"]
                                         waistCircumference:dict[@"waistCircumference"]
                                          neckCircumference:dict[@"neckCircumference"]
                                           hipCircumference:dict[@"hipCircumference"]
                                                     gender:[dict[@"gender"] integerValue]
                                           physicalActivity:[dict[@"physicalActivity"] integerValue]
                                                    country:dict[@"country"]
                                                       race:[dict[@"race"] integerValue]
                                         vegetableFruitDiet:dict[@"vegetableFruitDiet"]
                                       historyOfHighGlucose:dict[@"historyOfHighGlucose"]
                                      historyOfHypertension:dict[@"historyOfHypertension"]
                                               triglyceride:dict[@"triglyceride"]
                                             fastingGlucose:dict[@"fastingGlucose"]
                                             familyDiabetes:[dict[@"familyDiabetes"] integerValue]
                                       parentalHypertension:[dict[@"parentalHypertension"] integerValue]];
  return factors;
}

- (NSDictionary *)dictionaryFromRisksFactors:(RisksFactors *)factors {
  NSMutableDictionary *dict = [NSMutableDictionary dictionary];

  if (factors.age != nil) dict[@"age"] = factors.age;
  if (factors.cholesterol != nil) dict[@"cholesterol"] = factors.cholesterol;
  if (factors.cholesterolHDL != nil) dict[@"cholesterolHdl"] = factors.cholesterolHDL;
  if (factors.sbp != nil) dict[@"sbp"] = factors.sbp;
  if (factors.dbp != nil) dict[@"dbp"] = factors.dbp;
  if (factors.isSmoker != nil) dict[@"isSmoker"] = factors.isSmoker;
  if (factors.hypertensionTreatment != nil) dict[@"hypertensionTreatment"] = @(factors.hypertensionTreatment);
  if (factors.hasDiabetes != nil) dict[@"hasDiabetes"] = factors.hasDiabetes;
  if (factors.bodyHeight != nil) dict[@"bodyHeight"] = factors.bodyHeight;
  if (factors.bodyWeight != nil) dict[@"bodyWeight"] = factors.bodyWeight;
  if (factors.waistCircumference != nil) dict[@"waistCircumference"] = factors.waistCircumference;
  if (factors.neckCircumference != nil) dict[@"neckCircumference"] = factors.neckCircumference;
  if (factors.hipCircumference != nil) dict[@"hipCircumference"] = factors.hipCircumference;
  if (factors.gender != nil) dict[@"gender"] = @(factors.gender);
  if (factors.physicalActivity != nil) dict[@"physicalActivity"] = @(factors.physicalActivity);
  if (factors.country != nil) dict[@"country"] = factors.country;
  if (factors.race != nil) dict[@"race"] = @(factors.race);
  if (factors.vegetableFruitDiet != nil) dict[@"vegetableFruitDiet"] = factors.vegetableFruitDiet;
  if (factors.historyOfHighGlucose != nil) dict[@"historyOfHighGlucose"] = factors.historyOfHighGlucose;
  if (factors.historyOfHypertension != nil) dict[@"historyOfHypertension"] = factors.historyOfHypertension;
  if (factors.fastingGlucose != nil) dict[@"fastingGlucose"] = factors.fastingGlucose;
  if (factors.triglyceride != nil) dict[@"triglyceride"] = factors.triglyceride;
  if (factors.parentalHypertension != nil) dict[@"parentalHypertension"] = @(factors.parentalHypertension);
  if (factors.familyDiabetes != nil) dict[@"familyDiabetes"] = @(factors.familyDiabetes);

  return [dict copy];
}

// Convert HealthRisks object to NSDictionary for JS
- (NSDictionary *)dictionaryFromHealthRisks:(HealthRisks *)risks {
  NSMutableDictionary *dict = [NSMutableDictionary dictionary];

  // HardAndFatalEventsRisks conversion
  NSMutableDictionary *hardAndFatalEventsDict = [NSMutableDictionary dictionary];
  if (risks.hardAndFatalEvents.coronaryDeathEventRisk != nil) {
    hardAndFatalEventsDict[@"coronaryDeathEventRisk"] = risks.hardAndFatalEvents.coronaryDeathEventRisk;
  }
  if (risks.hardAndFatalEvents.fatalStrokeEventRisk != nil) {
    hardAndFatalEventsDict[@"fatalStrokeEventRisk"] = risks.hardAndFatalEvents.fatalStrokeEventRisk;
  }
  if (risks.hardAndFatalEvents.totalCvMortalityRisk != nil) {
    hardAndFatalEventsDict[@"totalCvMortalityRisk"] = risks.hardAndFatalEvents.totalCvMortalityRisk;
  }
  if (risks.hardAndFatalEvents.hardCvEventRisk != nil) {
    hardAndFatalEventsDict[@"hardCvEventRisk"] = risks.hardAndFatalEvents.hardCvEventRisk;
  }
  dict[@"hardAndFatalEvents"] = [hardAndFatalEventsDict copy];

  // CVDiseasesRisks conversion
  NSMutableDictionary *cvDiseasesDict = [NSMutableDictionary dictionary];
  if (risks.cvDiseases.overallRisk != nil) {
    cvDiseasesDict[@"overallRisk"] = risks.cvDiseases.overallRisk;
  }
  if (risks.cvDiseases.coronaryHeartDiseaseRisk != nil) {
    cvDiseasesDict[@"coronaryHeartDiseaseRisk"] = risks.cvDiseases.coronaryHeartDiseaseRisk;
  }
  if (risks.cvDiseases.strokeRisk != nil) {
    cvDiseasesDict[@"strokeRisk"] = risks.cvDiseases.strokeRisk;
  }
  if (risks.cvDiseases.heartFailureRisk != nil) {
    cvDiseasesDict[@"heartFailureRisk"] = risks.cvDiseases.heartFailureRisk;
  }
  if (risks.cvDiseases.peripheralVascularDiseaseRisk != nil) {
    cvDiseasesDict[@"peripheralVascularDiseaseRisk"] = risks.cvDiseases.peripheralVascularDiseaseRisk;
  }
  dict[@"cvDiseases"] = [cvDiseasesDict copy];

  // RisksFactorsScores conversion
  NSMutableDictionary *risksFactorsScoresDict = [NSMutableDictionary dictionary];
  if (risks.scores.ageScore != nil) {
    risksFactorsScoresDict[@"ageScore"] = risks.scores.ageScore;
  }
  if (risks.scores.sbpScore != nil) {
    risksFactorsScoresDict[@"sbpScore"] = risks.scores.sbpScore;
  }
  if (risks.scores.smokingScore != nil) {
    risksFactorsScoresDict[@"smokingScore"] = risks.scores.smokingScore;
  }
  if (risks.scores.diabetesScore != nil) {
    risksFactorsScoresDict[@"diabetesScore"] = risks.scores.diabetesScore;
  }
  if (risks.scores.bmiScore != nil) {
    risksFactorsScoresDict[@"bmiScore"] = risks.scores.bmiScore;
  }
  if (risks.scores.cholesterolScore != nil) {
    risksFactorsScoresDict[@"cholesterolScore"] = risks.scores.cholesterolScore;
  }
  if (risks.scores.cholesterolHdlScore != nil) {
    risksFactorsScoresDict[@"cholesterolHdlScore"] = risks.scores.cholesterolHdlScore;
  }
  if (risks.scores.totalScore != nil) {
    risksFactorsScoresDict[@"totalScore"] = risks.scores.totalScore;
  }
  dict[@"scores"] = [risksFactorsScoresDict copy];

  // Vascular Age
  if (risks.vascularAge != nil) {
    dict[@"vascularAge"] = risks.vascularAge;
  }

  // Wellness Score
  if (risks.wellnessScore != nil) {
    dict[@"wellnessScore"] = risks.wellnessScore;
  }

  // WHtR, BFP, BMR
  if (risks.waistToHeightRatio != nil) {
    dict[@"waistToHeightRatio"] = risks.waistToHeightRatio;
  }
  if (risks.bodyFatPercentage != nil) {
    dict[@"bodyFatPercentage"] = risks.bodyFatPercentage;
  }
  if (risks.basalMetabolicRate != nil) {
    dict[@"basalMetabolicRate"] = risks.basalMetabolicRate;
  }

  // ABSI, BRI, CI, TDEE
  if (risks.aBodyShapeIndex != nil) {
    dict[@"aBodyShapeIndex"] = risks.aBodyShapeIndex;
  }
  if (risks.bodyRoundnessIndex != nil) {
    dict[@"bodyRoundnessIndex"] = risks.bodyRoundnessIndex;
  }
  if (risks.conicityIndex != nil) {
    dict[@"conicityIndex"] = risks.conicityIndex;
  }
  if (risks.totalDailyEnergyExpenditure != nil) {
    dict[@"totalDailyEnergyExpenditure"] = risks.totalDailyEnergyExpenditure;
  }

  // HR, DR, NAFLDR
  if (risks.hypertensionRisk != nil) {
    dict[@"hypertensionRisk"] = risks.hypertensionRisk;
  }
  if (risks.diabetesRisk != nil) {
    dict[@"diabetesRisk"] = risks.diabetesRisk;
  }
  if (risks.nonAlcoholicFattyLiverDiseaseRisk != nil) {
    dict[@"nonAlcoholicFattyLiverDiseaseRisk"] = @(risks.nonAlcoholicFattyLiverDiseaseRisk);
  }
  return [dict copy];
}

RCT_EXPORT_METHOD(getHealthRisksFactors : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  RisksFactors *factors = [ShenaiHealthRisks getHealthRisksFactors];
  NSDictionary *resultsDict = [self dictionaryFromRisksFactors:factors];
  resolve(resultsDict);
}

RCT_EXPORT_METHOD(clearHealthRisksFactors : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [ShenaiHealthRisks clearHealthRisksFactors];
  resolve(nil);
}

RCT_EXPORT_METHOD(getHealthRisks : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  HealthRisks *risks = [ShenaiHealthRisks getHealthRisks];
  NSDictionary *resultsDict = [self dictionaryFromHealthRisks:risks];
  resolve(resultsDict);
}

RCT_EXPORT_METHOD(computeHealthRisks
                  : (NSDictionary *)factorsDict resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  RisksFactors *factors = [self risksFactorsFromDictionary:factorsDict];
  HealthRisks *risks = [ShenaiHealthRisks computeHealthRisks:factors];
  NSDictionary *resultsDict = [self dictionaryFromHealthRisks:risks];
  resolve(resultsDict);
}

RCT_EXPORT_METHOD(getMaximalRisks
                  : (NSDictionary *)factorsDict resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  RisksFactors *factors = [self risksFactorsFromDictionary:factorsDict];
  HealthRisks *risks = [ShenaiHealthRisks getMaximalRisks:factors];
  NSDictionary *resultsDict = [self dictionaryFromHealthRisks:risks];
  resolve(resultsDict);
}

RCT_EXPORT_METHOD(getMinimalRisks
                  : (NSDictionary *)factorsDict resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  RisksFactors *factors = [self risksFactorsFromDictionary:factorsDict];
  HealthRisks *risks = [ShenaiHealthRisks getMinimalRisks:factors];
  NSDictionary *resultsDict = [self dictionaryFromHealthRisks:risks];
  resolve(resultsDict);
}

RCT_EXPORT_METHOD(getReferenceRisks
                  : (NSDictionary *)factorsDict resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  RisksFactors *factors = [self risksFactorsFromDictionary:factorsDict];
  HealthRisks *risks = [ShenaiHealthRisks getReferenceRisks:factors];
  NSDictionary *resultsDict = [self dictionaryFromHealthRisks:risks];
  resolve(resultsDict);
}

RCT_EXPORT_METHOD(openMeasurementResultsPdfInBrowser
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [ShenaiSDK openMeasurementResultsPdfInBrowser];
  resolve(@(YES));
}

RCT_EXPORT_METHOD(sendMeasurementResultsPdfToEmail
                  : (NSString *)email resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [ShenaiSDK sendMeasurementResultsPdfToEmail:email];
  resolve(@(YES));
}

RCT_EXPORT_METHOD(requestMeasurementResultsPdfUrl
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [ShenaiSDK requestMeasurementResultsPdfUrl];
  resolve(@(YES));
}

RCT_EXPORT_METHOD(getMeasurementResultsPdfUrl
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  NSString *url = [ShenaiSDK getMeasurementResultsPdfUrl];
  if (url && url.length > 0) {
    resolve(url);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(requestMeasurementResultsPdfBytes
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [ShenaiSDK requestMeasurementResultsPdfBytes];
  resolve(@(YES));
}

RCT_EXPORT_METHOD(getMeasurementResultsPdfBytes
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  NSData *data = [ShenaiSDK getMeasurementResultsPdfBytes];
  if (!data) {
    resolve([NSNull null]);
    return;
  }

  const UInt8 *buffer = (const UInt8 *)data.bytes;
  NSUInteger length = data.length;
  NSMutableArray *array = [NSMutableArray arrayWithCapacity:length];
  for (NSUInteger i = 0; i < length; i++) {
    [array addObject:@(buffer[i])];  // wrap each byte as NSNumber
  }
  resolve(array);
}

RCT_EXPORT_METHOD(getResultAsFhirObservation
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  NSString *observation = [ShenaiSDK getResultAsFhirObservation];
  if (observation && observation.length > 0) {
    resolve(observation);
  } else {
    resolve([NSNull null]);
  }
}

RCT_EXPORT_METHOD(sendResultFhirObservation
                  : (NSString *)url resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
  [ShenaiSDK sendResultFhirObservation:url
                            completion:^(NSString *_Nullable response) {
                              if (response && response.length > 0) {
                                resolve(response);
                              } else {
                                resolve([NSNull null]);
                              }
                            }];
}

@end

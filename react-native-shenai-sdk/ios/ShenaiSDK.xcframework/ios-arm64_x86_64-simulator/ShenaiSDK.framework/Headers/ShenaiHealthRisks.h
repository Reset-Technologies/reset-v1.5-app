#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, Gender) { GenderMale, GenderFemale, GenderOther, GenderUnspecified };

typedef NS_ENUM(NSInteger, Race) { RaceWhite, RaceAfricanAmerican, RaceOther, RaceUnspecified };

typedef NS_ENUM(NSInteger, PhysicalActivity) {
  Sedentary,
  LightlyActive,
  Moderately,
  VeryActive,
  ExtraActive,
  ActivityUnspecified
};

typedef NS_ENUM(NSInteger, ParentalHistory) {
  ParentalHistoryNone,
  ParentalHistoryOne,
  ParentalHistoryBoth,
  ParentalHistoryUnspecified
};

typedef NS_ENUM(NSInteger, HypertensionTreatment) {
  HypertensionTreatmentNotNeeded,
  HypertensionTreatmentNo,
  HypertensionTreatmentYes,
  HypertensionTreatmentUnspecified
};

typedef NS_ENUM(NSInteger, FamilyHistory) {
  FamilyHistoryNone,
  FamilyHistoryNoneFirstDegree,
  FamilyHistoryFirstDegree,
  FamilyHistoryUnspecified
};

typedef NS_ENUM(NSInteger, NAFLDRisk) { NAFLDRiskLow, NAFLDRiskModerate, NAFLDRiskHigh, NAFLDRiskUnspecified };

__attribute__((visibility("default")))
@interface RisksFactors : NSObject

@property(nonatomic, strong, nullable) NSNumber *age;
@property(nonatomic, strong, nullable) NSNumber *cholesterol;
@property(nonatomic, strong, nullable) NSNumber *cholesterolHDL;
@property(nonatomic, strong, nullable) NSNumber *sbp;
@property(nonatomic, strong, nullable) NSNumber *dbp;
@property(nonatomic, strong, nullable) NSNumber *isSmoker;
@property(nonatomic) HypertensionTreatment hypertensionTreatment;
@property(nonatomic, strong, nullable) NSNumber *hasDiabetes;
@property(nonatomic, strong, nullable) NSNumber *bodyHeight;
@property(nonatomic, strong, nullable) NSNumber *bodyWeight;
@property(nonatomic, strong, nullable) NSNumber *waistCircumference;
@property(nonatomic, strong, nullable) NSNumber *neckCircumference;
@property(nonatomic, strong, nullable) NSNumber *hipCircumference;
@property(nonatomic) Gender gender;
@property(nonatomic) PhysicalActivity physicalActivity;
@property(nonatomic, strong, nullable) NSString *country;
@property(nonatomic) Race race;
@property(nonatomic, strong, nullable) NSNumber *vegetableFruitDiet;
@property(nonatomic, strong, nullable) NSNumber *historyOfHighGlucose;
@property(nonatomic, strong, nullable) NSNumber *historyOfHypertension;
@property(nonatomic, strong, nullable) NSNumber *triglyceride;
@property(nonatomic, strong, nullable) NSNumber *fastingGlucose;
@property(nonatomic) FamilyHistory familyDiabetes;
@property(nonatomic) ParentalHistory parentalHypertension;

- (nonnull instancetype)init;

- (nonnull instancetype)initWithAge:(nullable NSNumber *)age
                        cholesterol:(nullable NSNumber *)cholesterol
                     cholesterolHDL:(nullable NSNumber *)cholesterolHDL
                                sbp:(nullable NSNumber *)sbp
                                dbp:(nullable NSNumber *)dbp
                           isSmoker:(nullable NSNumber *)isSmoker
              hypertensionTreatment:(HypertensionTreatment)hypertensionTreatment
                        hasDiabetes:(nullable NSNumber *)hasDiabetes
                         bodyHeight:(nullable NSNumber *)bodyHeight
                         bodyWeight:(nullable NSNumber *)bodyWeight
                 waistCircumference:(nullable NSNumber *)waistCircumference
                  neckCircumference:(nullable NSNumber *)neckCircumference
                   hipCircumference:(nullable NSNumber *)hipCircumference
                             gender:(Gender)gender
                   physicalActivity:(PhysicalActivity)physicalActivity
                            country:(nullable NSString *)country
                               race:(Race)race
                 vegetableFruitDiet:(nullable NSNumber *)vegetableFruitDiet
               historyOfHighGlucose:(nullable NSNumber *)historyOfHighGlucose
              historyOfHypertension:(nullable NSNumber *)historyOfHypertension
                       triglyceride:(nullable NSNumber *)triglyceride
                     fastingGlucose:(nullable NSNumber *)fastingGlucose
                     familyDiabetes:(FamilyHistory)familyDiabetes
               parentalHypertension:(ParentalHistory)parentalHypertension;

@end

__attribute__((visibility("default")))
@interface HardAndFatalEventsRisks : NSObject
@property(nonatomic, strong, nullable) NSNumber *coronaryDeathEventRisk;
@property(nonatomic, strong, nullable) NSNumber *fatalStrokeEventRisk;
@property(nonatomic, strong, nullable) NSNumber *totalCvMortalityRisk;
@property(nonatomic, strong, nullable) NSNumber *hardCvEventRisk;
@end

__attribute__((visibility("default")))
@interface CVDiseasesRisks : NSObject
@property(nonatomic, strong, nullable) NSNumber *overallRisk;
@property(nonatomic, strong, nullable) NSNumber *coronaryHeartDiseaseRisk;
@property(nonatomic, strong, nullable) NSNumber *strokeRisk;
@property(nonatomic, strong, nullable) NSNumber *heartFailureRisk;
@property(nonatomic, strong, nullable) NSNumber *peripheralVascularDiseaseRisk;
@end

__attribute__((visibility("default")))
@interface RisksFactorsScores : NSObject
@property(nonatomic, strong, nullable) NSNumber *ageScore;
@property(nonatomic, strong, nullable) NSNumber *sbpScore;
@property(nonatomic, strong, nullable) NSNumber *smokingScore;
@property(nonatomic, strong, nullable) NSNumber *diabetesScore;
@property(nonatomic, strong, nullable) NSNumber *bmiScore;
@property(nonatomic, strong, nullable) NSNumber *cholesterolScore;
@property(nonatomic, strong, nullable) NSNumber *cholesterolHdlScore;
@property(nonatomic, strong, nullable) NSNumber *totalScore;
@end

__attribute__((visibility("default")))
@interface HealthRisks : NSObject
@property(nonatomic, strong, nullable) NSNumber *wellnessScore;
@property(nonatomic, strong, nonnull) HardAndFatalEventsRisks *hardAndFatalEvents;
@property(nonatomic, strong, nonnull) CVDiseasesRisks *cvDiseases;
@property(nonatomic, strong, nullable) NSNumber *vascularAge;
@property(nonatomic, strong, nonnull) RisksFactorsScores *scores;

@property(nonatomic, strong, nullable) NSNumber *bodyFatPercentage;
@property(nonatomic, strong, nullable) NSNumber *basalMetabolicRate;
@property(nonatomic, strong, nullable) NSNumber *waistToHeightRatio;
@property(nonatomic, strong, nullable) NSNumber *bodyRoundnessIndex;
@property(nonatomic, strong, nullable) NSNumber *conicityIndex;
@property(nonatomic, strong, nullable) NSNumber *aBodyShapeIndex;
@property(nonatomic, strong, nullable) NSNumber *totalDailyEnergyExpenditure;
@property(nonatomic, strong, nullable) NSNumber *hypertensionRisk;
@property(nonatomic, strong, nullable) NSNumber *diabetesRisk;
@property(nonatomic) NAFLDRisk nonAlcoholicFattyLiverDiseaseRisk;
@end

__attribute__((visibility("default")))
@interface ShenaiHealthRisks : NSObject

+ (nonnull RisksFactors *)getHealthRisksFactors;

+ (void)clearHealthRisksFactors;

+ (nonnull HealthRisks *)getHealthRisks;
+ (nonnull HealthRisks *)computeHealthRisks:(nonnull RisksFactors *)risksFactors;
+ (nonnull HealthRisks *)getMaximalRisks:(nonnull RisksFactors *)risksFactors;
+ (nonnull HealthRisks *)getMinimalRisks:(nonnull RisksFactors *)risksFactors;
+ (nonnull HealthRisks *)getReferenceRisks:(nonnull RisksFactors *)risksFactors;

@end

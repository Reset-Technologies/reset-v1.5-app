#pragma once

#include <optional>
#include <string>

namespace mx::health_risks {
enum class WellnessScoreParameter {
  heart_rate,
  heart_rate_variability,
  breathing_rate,
  cardiac_workload,
  systolic_bp,
  diastolic_bp,
  cardiac_stress,
  bmi,
  age,
  total_cholesterol,
  gender,
  smoking,
  diabetes,
  hypertension_treatment
};

enum class HypertensionTreatment { not_needed, no, yes };
enum class Gender { male, female, other };
enum class Race { white, african_american, other };
enum class PhysicalActivity { sedentary, lightly_active, moderately, very_active, extra_active };
enum class ParentalHistory { none, one, both };
enum class FamilyHistory { none, none_first_degree, first_degree };

struct RisksFactors {
  std::optional<int> age;
  std::optional<float> cholesterol;
  std::optional<float> cholesterol_hdl;
  std::optional<float> sbp;
  std::optional<float> dbp;
  std::optional<bool> is_smoker;
  std::optional<HypertensionTreatment> hypertension_treatment;
  std::optional<bool> has_diabetes;
  std::optional<float> body_height;          // centimeters
  std::optional<float> body_weight;          // kilograms
  std::optional<float> waist_circumference;  // centimeters
  std::optional<float> neck_circumference;   // centimeters
  std::optional<float> hip_circumference;    // centimeters
  std::optional<PhysicalActivity> physical_activity;
  std::optional<Gender> gender;
  std::string country;  // country name ISO code: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
  std::optional<Race> race;
  std::optional<ParentalHistory> parental_hypertension;
  std::optional<FamilyHistory> family_diabetes;
  std::optional<float> triglyceride;
  std::optional<float> fasting_glucose;
  std::optional<bool> vegetable_fruit_diet;
  std::optional<bool> history_of_high_glucose;
  std::optional<bool> history_of_hypertension;
};

struct WellnessScoreRisksFactors {
  std::optional<int> age;
  std::optional<float> cholesterol;
  std::optional<float> hr;
  std::optional<float> hrv;
  std::optional<float> br;
  std::optional<float> sbp;
  std::optional<float> dbp;
  std::optional<bool> is_smoker;
  std::optional<HypertensionTreatment> hypertension_treatment;
  std::optional<bool> has_diabetes;
  std::optional<Gender> gender;
  std::optional<float> cardiac_workload;
  std::optional<float> cardiac_stress;
  std::optional<float> bmi;
  std::optional<int> last_measurement_epoch;
};

inline bool operator==(RisksFactors const& a, RisksFactors const& b) {
  return a.age == b.age && a.cholesterol == b.cholesterol && a.cholesterol_hdl == b.cholesterol_hdl && a.sbp == b.sbp &&
         a.is_smoker == b.is_smoker && a.hypertension_treatment == b.hypertension_treatment &&
         a.has_diabetes == b.has_diabetes && a.body_height == b.body_height && a.body_weight == b.body_weight &&
         a.gender == b.gender && a.country == b.country && a.race == b.race &&
         a.waist_circumference == b.waist_circumference && a.hip_circumference == b.hip_circumference &&
         a.physical_activity == b.physical_activity && a.neck_circumference == b.neck_circumference &&
         a.parental_hypertension == b.parental_hypertension && a.family_diabetes == b.family_diabetes &&
         a.triglyceride == b.triglyceride && a.fasting_glucose == b.fasting_glucose &&
         a.vegetable_fruit_diet == b.vegetable_fruit_diet && a.history_of_high_glucose == b.history_of_high_glucose &&
         a.history_of_hypertension == b.history_of_hypertension;
}

inline bool operator==(WellnessScoreRisksFactors const& a, WellnessScoreRisksFactors const& b) {
  return a.age == b.age && a.cholesterol == b.cholesterol && a.hr == b.hr && a.hrv == b.hrv && a.br == b.br &&
         a.sbp == b.sbp && a.dbp == b.dbp && a.is_smoker == b.is_smoker &&
         a.hypertension_treatment == b.hypertension_treatment && a.has_diabetes == b.has_diabetes &&
         a.gender == b.gender && a.cardiac_workload == b.cardiac_workload && a.cardiac_stress == b.cardiac_stress &&
         a.bmi == b.bmi && a.last_measurement_epoch == b.last_measurement_epoch;
}
}  // namespace mx::health_risks
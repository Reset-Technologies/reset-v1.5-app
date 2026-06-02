#pragma once

#include <optional>

#include "health_risks_factors.h"

namespace mx::health_risks {

//////////////////////////////////////////////////////////////////////////////////////////////////
/// 10-year risk of hard or fatal cardiovascular events
struct HardAndFatalEventsRisks {
  // Risk of fatal cardiovascular event: coronary death based on Euro SCORE
  std::optional<float> coronary_death_event_risk;
  // Risk of fatal cardiovascular event: stroke based on Euro SCORE
  std::optional<float> fatal_stroke_event_risk;
  // Total risk of cardiovascular mortality (coronary + stroke) based on Euro SCORE
  std::optional<float> total_cv_mortality_risk;
  // Risk of hard cardiovascular event (coronary death, myocardial infarction, or stroke)
  // based on Pooled Cohort Equations (USA)
  std::optional<float> hard_cv_event_risk;
};

////////////////////////////////////////////////////////////////////////////////////////////////
/// 10-year risk of atherosclerotic cardiovascular disease (CVD) based on Framingham Heart Study
struct CVDiseasesRisks {
  // Risk of atherosclerotic cardiovascular disease (CVD) – overall risk
  std::optional<float> overall_risk;
  // Risk of coronary heart disease (myocardial infarction, coronary death, coronary insufficiency, angina)
  std::optional<float> coronary_heart_disease_risk;
  // Risk of stroke (ischemic stroke, hemorrhagic stroke, transient ischemic attack)
  std::optional<float> stroke_risk;
  // Risk of heart failure
  std::optional<float> heart_failure_risk;
  // Risk of peripheral vascular disease (intermittent claudication)
  std::optional<float> peripheral_vascular_disease_risk;
};

enum class NAFLDRisk { low, moderate, high };

////////////////////////////////////////////////////////////////////////////////////////////////
/// Risk factors scores
struct RisksFactorsScores {
  std::optional<int> age_score;
  std::optional<int> sbp_score;
  std::optional<int> smoking_score;
  std::optional<int> diabetes_score;
  std::optional<int> bmi_score;
  std::optional<int> cholesterol_score;
  std::optional<int> cholesterol_hdl_score;
  std::optional<int> total_score;
};

////////////////////////////////////////////////////////////////////////////////////////////////
// All the health risks results
struct HealthRisks {
  std::optional<double> wellness_score;
  HardAndFatalEventsRisks hard_and_fatal_events;
  CVDiseasesRisks cv_diseases;
  std::optional<int> vascular_age;
  RisksFactorsScores scores;
  std::optional<double> waist_to_height_ratio;
  std::optional<double> body_fat_percentage;
  std::optional<double> basal_metabolic_rate;
  std::optional<double> body_roundness_index;
  std::optional<double> conicity_index;
  std::optional<double> a_body_shape_index;
  std::optional<double> total_daily_energy_expenditure;
  std::optional<double> hypertension_risk;
  std::optional<double> diabetes_risk;
  std::optional<NAFLDRisk> non_alcoholic_fatty_liver_disease_risk;
  std::optional<int> oldest_measurement_days;
};

}  // namespace mx::health_risks

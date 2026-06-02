#pragma once
#include <limits>
#include <map>
#include <optional>
#include <tuple>

namespace mx {

enum class BmiCategory {
  UnderweightSevere,
  UnderweightModerate,
  UnderweightMild,
  Normal,
  Overweight,
  ObeseClassI,
  ObeseClassII,
  ObeseClassIII
};

static const std::map<BmiCategory, std::pair<double, double>> kBmiRanges = {
    {BmiCategory::UnderweightSevere, {0.0, 16.0}},
    {BmiCategory::UnderweightModerate, {16.0, 17.0}},
    {BmiCategory::UnderweightMild, {17.0, 18.5}},
    {BmiCategory::Normal, {18.5, 25.0}},
    {BmiCategory::Overweight, {25.0, 30.0}},
    {BmiCategory::ObeseClassI, {30.0, 35.0}},
    {BmiCategory::ObeseClassII, {35.0, 40.0}},
    {BmiCategory::ObeseClassIII, {40.0, std::numeric_limits<double>::infinity()}}};

// Computes BMI
// weight [kg]
// height [cm]
inline double computeBmi(double weight, double height) { return weight / (height * height * 1e-4); }

// Adjusts BMI, weight and height to satisfy the relationship BMI = weight / (height/100)^2
// BMI [kg/m^2]
// weight [kg]
// height [cm]
// optionally rounds weight and height and recalculates BMI accordingly
void adjustBmiWeightHeight(double &bmi, double &weight, double &height, bool round_weight_height = false);

std::optional<BmiCategory> classifyBmi(std::optional<double> bmi);

std::pair<double, double> rangeForCategory(BmiCategory cat);

}  // namespace mx

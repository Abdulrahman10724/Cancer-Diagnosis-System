#include "../headers/DataPreprocessor.h"
#include <cmath>
#include <stdexcept>

DataPreprocessor::DataPreprocessor() : isFitted(false) {}

void DataPreprocessor::fit(const std::vector<std::vector<double>>& X) {
    if (X.empty() || X[0].empty()) {
        throw std::runtime_error("Cannot fit preprocessor on empty data");
    }
    size_t f = X[0].size();
    means.assign(f, 0.0);
    stds.assign(f, 0.0);
    mins.assign(f, X[0][0]);
    maxs.assign(f, X[0][0]);
    for (size_t j = 0; j < f; ++j) {
        mins[j] = X[0][j];
        maxs[j] = X[0][j];
    }
    for (const auto& row : X) {
        if (row.size() != f) throw std::runtime_error("All rows must have the same number of features");
        for (size_t j = 0; j < f; ++j) {
            means[j] += row[j];
            if (row[j] < mins[j]) mins[j] = row[j];
            if (row[j] > maxs[j]) maxs[j] = row[j];
        }
    }
    for (size_t j = 0; j < f; ++j) means[j] /= X.size();
    for (const auto& row : X) {
        for (size_t j = 0; j < f; ++j) {
            double d = row[j] - means[j];
            stds[j] += d * d;
        }
    }
    for (size_t j = 0; j < f; ++j) {
        stds[j] = std::sqrt(stds[j] / X.size());
        // Constant feature: use 1 to avoid dividing by zero (scaled value becomes 0)
        if (stds[j] < 1e-12) stds[j] = 1.0;
    }
    isFitted = true;
}

std::vector<double> DataPreprocessor::transform(const std::vector<double>& row) const {
    if (!isFitted) throw std::runtime_error("Preprocessor not fitted. Call fit() first.");
    std::vector<double> out(row.size());
    for (size_t j = 0; j < row.size() && j < means.size(); ++j) {
        out[j] = (row[j] - means[j]) / stds[j];
    }
    return out;
}

std::vector<std::vector<double>> DataPreprocessor::transform(const std::vector<std::vector<double>>& X) const {
    std::vector<std::vector<double>> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(transform(row));
    return out;
}

std::vector<double> DataPreprocessor::inverseTransform(const std::vector<double>& row) const {
    if (!isFitted) throw std::runtime_error("Preprocessor not fitted. Call fit() first.");
    std::vector<double> out(row.size());
    for (size_t j = 0; j < row.size() && j < means.size(); ++j) {
        out[j] = row[j] * stds[j] + means[j];
    }
    return out;
}

double DataPreprocessor::inverseValue(size_t feature, double scaled) const {
    if (feature >= means.size()) return scaled;
    return scaled * stds[feature] + means[feature];
}

const std::vector<double>& DataPreprocessor::getMeans() const { return means; }
const std::vector<double>& DataPreprocessor::getStds() const { return stds; }
const std::vector<double>& DataPreprocessor::getMins() const { return mins; }
const std::vector<double>& DataPreprocessor::getMaxs() const { return maxs; }
bool DataPreprocessor::getIsFitted() const { return isFitted; }

void DataPreprocessor::reset() {
    means.clear();
    stds.clear();
    mins.clear();
    maxs.clear();
    isFitted = false;
}

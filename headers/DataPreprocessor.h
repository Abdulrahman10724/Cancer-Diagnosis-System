#ifndef DATA_PREPROCESSOR_H
#define DATA_PREPROCESSOR_H

#include <vector>

/**
 * @class DataPreprocessor
 * @brief Per-feature standardization (z-score), the scaling used by all models
 *
 * fit stores mean, standard deviation, min and max of every feature column.
 * transform: z = (x - mean) / std. A constant feature (std 0) uses std = 1 so
 * there is no division by zero; its scaled value is then always 0.
 * Complexity: fit O(n f), transform O(f) per row.
 */
class DataPreprocessor {
private:
    std::vector<double> means;
    std::vector<double> stds;
    std::vector<double> mins;
    std::vector<double> maxs;
    bool isFitted;

public:
    DataPreprocessor();

    void fit(const std::vector<std::vector<double>>& X);
    std::vector<double> transform(const std::vector<double>& row) const;
    std::vector<std::vector<double>> transform(const std::vector<std::vector<double>>& X) const;
    std::vector<double> inverseTransform(const std::vector<double>& row) const;
    // Convert one scaled value of one feature back to raw units
    double inverseValue(size_t feature, double scaled) const;

    const std::vector<double>& getMeans() const;
    const std::vector<double>& getStds() const;
    const std::vector<double>& getMins() const;
    const std::vector<double>& getMaxs() const;
    bool getIsFitted() const;
    void reset();
};

#endif // DATA_PREPROCESSOR_H

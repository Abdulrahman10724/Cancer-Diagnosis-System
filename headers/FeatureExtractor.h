#ifndef FEATURE_EXTRACTOR_H
#define FEATURE_EXTRACTOR_H

#include <string>
#include <vector>
#include "Patient.h"
#include "HashMapper.h"

/**
 * @class FeatureExtractor
 * @brief The single place where the 4 patient features are defined
 *
 * For a patient with gene scores s_1 ... s_m (looked up in the gene hash table,
 * O(1) average each):
 *   0 avgMutation   = mean of s_i
 *   1 maxMutation   = max of s_i
 *   2 highRiskGenes = count of s_i >= HIGH_RISK_CUTOFF
 *   3 age           = patient age in years
 * Complexity: O(m) per patient.
 */
class FeatureExtractor {
public:
    static const int NUM_FEATURES = 4;
    static constexpr double HIGH_RISK_CUTOFF = 0.7;

    enum Index { AVG_MUTATION = 0, MAX_MUTATION = 1, HIGH_RISK_GENES = 2, AGE = 3 };

    static const std::vector<std::string>& featureNames();

    // Features from a patient's gene IDs (unknown gene IDs are skipped)
    static std::vector<double> extract(const Patient& patient, const HashMapper& genes);

    // Features from gene scores directly (used by tests and the data generator)
    static std::vector<double> fromScores(const std::vector<double>& scores, int age);
};

#endif // FEATURE_EXTRACTOR_H

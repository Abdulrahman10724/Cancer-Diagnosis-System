#include "../headers/FeatureExtractor.h"

const std::vector<std::string>& FeatureExtractor::featureNames() {
    static const std::vector<std::string> names = {"avgMutation", "maxMutation", "highRiskGenes", "age"};
    return names;
}

std::vector<double> FeatureExtractor::fromScores(const std::vector<double>& scores, int age) {
    std::vector<double> f(NUM_FEATURES, 0.0);
    if (!scores.empty()) {
        double sum = 0.0;
        double mx = scores[0];
        int high = 0;
        for (double s : scores) {
            sum += s;
            if (s > mx) mx = s;
            if (s >= HIGH_RISK_CUTOFF) high++;
        }
        f[AVG_MUTATION] = sum / scores.size();
        f[MAX_MUTATION] = mx;
        f[HIGH_RISK_GENES] = high;
    }
    f[AGE] = age;
    return f;
}

std::vector<double> FeatureExtractor::extract(const Patient& patient, const HashMapper& genes) {
    std::vector<double> scores;
    scores.reserve(patient.getGeneIds().size());
    for (const auto& id : patient.getGeneIds()) {
        double s = 0.0;
        if (genes.get(id, s)) scores.push_back(s);
    }
    return fromScores(scores, patient.getAge());
}

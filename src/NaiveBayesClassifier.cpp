#include "../headers/NaiveBayesClassifier.h"
#include <cmath>
#include <stdexcept>

NaiveBayesClassifier::NaiveBayesClassifier() : nFeatures(0), isTrained(false) {
    for (int c = 0; c < 2; ++c) {
        prior[c] = 0.0;
        hasClass[c] = false;
    }
}

void NaiveBayesClassifier::fit(const std::vector<std::vector<double>>& X,
                               const std::vector<int>& y) {
    if (X.empty() || y.empty()) {
        throw std::runtime_error("Training data is empty");
    }
    if (X.size() != y.size()) {
        throw std::runtime_error("X and y must have the same size");
    }
    nFeatures = X[0].size();
    size_t count[2] = {0, 0};
    for (int c = 0; c < 2; ++c) {
        mean[c].assign(nFeatures, 0.0);
        stdDev[c].assign(nFeatures, 1.0);
    }

    // Class counts and means
    for (size_t i = 0; i < X.size(); ++i) {
        int c = y[i] == 1 ? 1 : 0;
        count[c]++;
        for (size_t j = 0; j < nFeatures; ++j) {
            mean[c][j] += X[i][j];
        }
    }
    for (int c = 0; c < 2; ++c) {
        hasClass[c] = count[c] > 0;
        prior[c] = static_cast<double>(count[c]) / X.size();
        if (count[c] > 0) {
            for (size_t j = 0; j < nFeatures; ++j) mean[c][j] /= count[c];
        }
    }

    // Sample standard deviation per class and feature
    double variance[2][64] = {};
    if (nFeatures > 64) {
        throw std::runtime_error("Too many features for Naive Bayes");
    }
    for (size_t i = 0; i < X.size(); ++i) {
        int c = y[i] == 1 ? 1 : 0;
        for (size_t j = 0; j < nFeatures; ++j) {
            double d = X[i][j] - mean[c][j];
            variance[c][j] += d * d;
        }
    }
    for (int c = 0; c < 2; ++c) {
        if (count[c] <= 1) continue;
        for (size_t j = 0; j < nFeatures; ++j) {
            double s = std::sqrt(variance[c][j] / (count[c] - 1));
            // A constant feature would give a zero spread; use a small floor instead
            stdDev[c][j] = s < 1e-6 ? 1e-6 : s;
        }
    }
    isTrained = true;
}

double NaiveBayesClassifier::logGaussian(double x, double m, double s) const {
    const double PI = 3.14159265358979323846;
    double z = (x - m) / s;
    return -0.5 * z * z - std::log(s * std::sqrt(2.0 * PI));
}

double NaiveBayesClassifier::logPosterior(const std::vector<double>& features, int cls) const {
    double lp = std::log(prior[cls] + 1e-10);
    for (size_t j = 0; j < nFeatures && j < features.size(); ++j) {
        lp += logGaussian(features[j], mean[cls][j], stdDev[cls][j]);
    }
    return lp;
}

double NaiveBayesClassifier::predictProbabilitySingle(const std::vector<double>& features) const {
    if (!isTrained) {
        throw std::runtime_error("Model not trained. Call fit() first.");
    }
    if (!hasClass[1]) return 0.0;
    if (!hasClass[0]) return 1.0;
    // Softmax of the two log posteriors (subtract the max for stability)
    double l0 = logPosterior(features, 0);
    double l1 = logPosterior(features, 1);
    double mx = l0 > l1 ? l0 : l1;
    double e0 = std::exp(l0 - mx);
    double e1 = std::exp(l1 - mx);
    return e1 / (e0 + e1);
}

int NaiveBayesClassifier::predictSingle(const std::vector<double>& features) const {
    return predictProbabilitySingle(features) >= 0.5 ? 1 : 0;
}

std::vector<int> NaiveBayesClassifier::predict(const std::vector<std::vector<double>>& X) const {
    std::vector<int> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predictSingle(row));
    return out;
}

std::vector<double> NaiveBayesClassifier::predictProbability(const std::vector<std::vector<double>>& X) const {
    std::vector<double> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predictProbabilitySingle(row));
    return out;
}

bool NaiveBayesClassifier::getIsTrained() const {
    return isTrained;
}

double NaiveBayesClassifier::getPrior(int cls) const {
    return (cls == 0 || cls == 1) ? prior[cls] : 0.0;
}

const std::vector<double>& NaiveBayesClassifier::getMeans(int cls) const {
    return mean[cls == 1 ? 1 : 0];
}

const std::vector<double>& NaiveBayesClassifier::getStds(int cls) const {
    return stdDev[cls == 1 ? 1 : 0];
}

#ifndef NAIVE_BAYES_CLASSIFIER_H
#define NAIVE_BAYES_CLASSIFIER_H

#include <vector>
#include "FeatureExtractor.h"

/**
 * @class NaiveBayesClassifier
 * @brief Gaussian Naive Bayes for two classes (0 = no cancer, 1 = cancer)
 *
 * Statistics are kept in plain arrays indexed by class and feature:
 * prior[2], mean[2][NUM_FEATURES], stdDev[2][NUM_FEATURES].
 * Log-probabilities avoid underflow.
 *
 * Complexity (n samples, f features): fit O(n f), predict O(f) per sample.
 */
class NaiveBayesClassifier {
private:
    static const int F = FeatureExtractor::NUM_FEATURES;

    double prior[2];          // P(class)
    double mean[2][F];        // mean of each feature, per class
    double stdDev[2][F];      // standard deviation of each feature, per class
    bool hasClass[2];
    bool isTrained;

    double logGaussian(double x, double m, double s) const;
    double logPosterior(const std::vector<double>& features, int cls) const;

public:
    NaiveBayesClassifier();

    // Training and prediction
    void fit(const std::vector<std::vector<double>>& X, const std::vector<int>& y);
    std::vector<int> predict(const std::vector<std::vector<double>>& X) const;
    int predictSingle(const std::vector<double>& features) const;
    std::vector<double> predictProbability(const std::vector<std::vector<double>>& X) const;
    double predictProbabilitySingle(const std::vector<double>& features) const;

    // Utility
    bool getIsTrained() const;
    double getPrior(int cls) const;
    double getMean(int cls, int feature) const;
    double getStd(int cls, int feature) const;
};

#endif // NAIVE_BAYES_CLASSIFIER_H

#ifndef NAIVE_BAYES_CLASSIFIER_H
#define NAIVE_BAYES_CLASSIFIER_H

#include <vector>

/**
 * @class NaiveBayesClassifier
 * @brief Gaussian Naive Bayes for two classes (0 = no cancer, 1 = cancer)
 *
 * Statistics are kept in plain arrays indexed by class: prior[c],
 * mean[c][feature], stdDev[c][feature]. Log-probabilities avoid underflow.
 *
 * Complexity (n samples, f features): fit O(n f), predict O(f) per sample.
 */
class NaiveBayesClassifier {
private:
    double prior[2];                 // P(class)
    std::vector<double> mean[2];     // mean of each feature, per class
    std::vector<double> stdDev[2];   // standard deviation of each feature, per class
    bool hasClass[2];
    size_t nFeatures;
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
    const std::vector<double>& getMeans(int cls) const;
    const std::vector<double>& getStds(int cls) const;
};

#endif // NAIVE_BAYES_CLASSIFIER_H

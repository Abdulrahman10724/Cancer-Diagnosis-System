#ifndef EVALUATION_METRICS_H
#define EVALUATION_METRICS_H

#include <utility>
#include <vector>

/**
 * @struct ConfusionMatrix
 * @brief Stores confusion matrix values
 */
struct ConfusionMatrix {
    int truePositive;
    int trueNegative;
    int falsePositive;
    int falseNegative;
    
    ConfusionMatrix() : truePositive(0), trueNegative(0), 
                       falsePositive(0), falseNegative(0) {}
};

/**
 * @class EvaluationMetrics
 * @brief Calculates and displays evaluation metrics for classification
 */
class EvaluationMetrics {
private:
    ConfusionMatrix confusionMatrix;
    
    // Helper functions
    ConfusionMatrix calculateConfusionMatrix(const std::vector<int>& yTrue, 
                                           const std::vector<int>& yPred) const;
    
public:
    EvaluationMetrics();
    
    // Metrics calculation
    double accuracy(const std::vector<int>& yTrue, const std::vector<int>& yPred) const;
    double precision(const std::vector<int>& yTrue, const std::vector<int>& yPred) const;
    double recall(const std::vector<int>& yTrue, const std::vector<int>& yPred) const;
    double f1Score(const std::vector<int>& yTrue, const std::vector<int>& yPred) const;
    ConfusionMatrix getConfusionMatrix(const std::vector<int>& yTrue, 
                                      const std::vector<int>& yPred) const;
    
    // Display metrics
    void displayMetrics(const std::vector<int>& yTrue, const std::vector<int>& yPred) const;
    void displayConfusionMatrix(const ConfusionMatrix& cm) const;

    // ROC curve: (false positive rate, true positive rate) points from the highest
    // risk down; equal risks move together. AUC by the trapezoid rule.
    // Predictions are ordered with the hand-written merge sort: O(n log n).
    static std::vector<std::pair<double, double>> rocCurve(const std::vector<int>& yTrue,
                                                           const std::vector<double>& risk, double& auc);
};

#endif // EVALUATION_METRICS_H



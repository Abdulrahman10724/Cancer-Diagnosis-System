#ifndef MODEL_SET_H
#define MODEL_SET_H

#include <string>
#include <vector>
#include "DataPreprocessor.h"
#include "LogisticRegressionModel.h"
#include "KNNClassifier.h"
#include "DecisionTreeClassifier.h"
#include "NaiveBayesClassifier.h"

/**
 * @class ModelSet
 * @brief The scaler plus the four models, always trained together on one split
 *
 * Used for the live models (/diagnose) and for the fresh copies trained by
 * /evaluate and cross-validation, so every path uses the same settings.
 */
class ModelSet {
public:
    enum Model { LOGISTIC = 0, KNN = 1, DECISION_TREE = 2, NAIVE_BAYES = 3, NUM_MODELS = 4 };

    static const char* key(int model);   // "logistic", "knn", ...
    static const char* name(int model);  // "Logistic Regression", ...
    static int fromKey(const std::string& key); // -1 if unknown

    DataPreprocessor scaler;
    LogisticRegressionModel logistic;
    KNNClassifier knn;
    DecisionTreeClassifier tree;
    NaiveBayesClassifier bayes;
    bool trained;

    ModelSet();

    // Xraw: raw feature rows; the scaler is fitted on these rows only
    void train(const std::vector<std::vector<double>>& Xraw, const std::vector<int>& y);

    // Risk (probability of cancer) of one model for a raw feature row.
    // k > 0 overrides the KNN K for this call only.
    double risk(int model, const std::vector<double>& rawRow, int k = 0) const;
    double riskScaled(int model, const std::vector<double>& scaledRow, int k = 0) const;
};

#endif // MODEL_SET_H

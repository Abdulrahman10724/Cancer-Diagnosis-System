#include "../headers/ModelSet.h"

static const char* MODEL_KEYS[ModelSet::NUM_MODELS] = {"logistic", "knn", "decision_tree", "naive_bayes"};
static const char* MODEL_NAMES[ModelSet::NUM_MODELS] = {"Logistic Regression", "K-Nearest Neighbors", "Decision Tree", "Naive Bayes"};

const char* ModelSet::key(int model) {
    return (model >= 0 && model < NUM_MODELS) ? MODEL_KEYS[model] : "";
}

const char* ModelSet::name(int model) {
    return (model >= 0 && model < NUM_MODELS) ? MODEL_NAMES[model] : "";
}

int ModelSet::fromKey(const std::string& k) {
    for (int m = 0; m < NUM_MODELS; ++m) {
        if (k == MODEL_KEYS[m]) return m;
    }
    return -1;
}

// Logistic regression: learning rate 0.1, 2000 gradient-descent steps on standardized features.
// KNN: K = 5. Decision tree: depth 5, at least 4 samples to split.
ModelSet::ModelSet() : logistic(0.1, 2000), knn(5), tree(5, 4), trained(false) {}

void ModelSet::train(const std::vector<std::vector<double>>& Xraw, const std::vector<int>& y) {
    trained = false;
    scaler.fit(Xraw);
    std::vector<std::vector<double>> X = scaler.transform(Xraw);
    logistic.fit(X, y);
    knn.fit(X, y);
    tree.fit(X, y);
    bayes.fit(X, y);
    trained = true;
}

double ModelSet::risk(int model, const std::vector<double>& rawRow, int k) const {
    return riskScaled(model, scaler.transform(rawRow), k);
}

double ModelSet::riskScaled(int model, const std::vector<double>& row, int k) const {
    switch (model) {
        case LOGISTIC:
            return logistic.predictProbabilitySingle(row);
        case KNN: {
            auto neighbors = knn.findNeighbors(row, k);
            if (neighbors.empty()) return 0.0;
            int cancer = 0;
            for (const auto& n : neighbors) {
                if (knn.getTrainingLabel(n.second) == 1) cancer++;
            }
            return static_cast<double>(cancer) / neighbors.size();
        }
        case DECISION_TREE:
            return tree.predictProbabilitySingle(row);
        case NAIVE_BAYES:
            return bayes.predictProbabilitySingle(row);
        default:
            return 0.0;
    }
}

#ifndef KNN_CLASSIFIER_H
#define KNN_CLASSIFIER_H

#include <vector>
#include <utility>
#include <algorithm>

/**
 * @class KNNClassifier
 * @brief Implements K-Nearest Neighbors algorithm for classification
 */
class KNNClassifier {
private:
    std::vector<std::vector<double>> X_train;
    std::vector<int> y_train;
    int k;
    bool isTrained;
    
    // Helper functions
    double euclideanDistance(const std::vector<double>& a, 
                            const std::vector<double>& b) const;
    int majorityVote(const std::vector<std::pair<double, int>>& neighbors) const;
    std::vector<std::pair<double, int>> findKNearest(const std::vector<double>& sample) const;
    
public:
    KNNClassifier(int k = 5);
    
    // Training and prediction
    void fit(const std::vector<std::vector<double>>& X, const std::vector<int>& y);
    std::vector<int> predict(const std::vector<std::vector<double>>& X) const;
    int predictSingle(const std::vector<double>& sample) const;
    std::vector<double> predictProbability(const std::vector<std::vector<double>>& X) const;
    // Nearest training samples for one sample: (distance, training row index),
    // closest first; ties are broken by row index. kOverride > 0 uses that K
    // for this call only (the trained K is not changed).
    std::vector<std::pair<double, size_t>> findNeighbors(const std::vector<double>& sample,
                                                         int kOverride = 0) const;
    int getTrainingLabel(size_t index) const;
    
    // Parameters
    void setK(int k);
    int getK() const;
    bool getIsTrained() const;
};

#endif // KNN_CLASSIFIER_H



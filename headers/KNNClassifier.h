#ifndef KNN_CLASSIFIER_H
#define KNN_CLASSIFIER_H

#include <cstddef>
#include <utility>
#include <vector>
#include "KDTree.h"

/**
 * @class KNNClassifier
 * @brief K-nearest neighbours on standardized features (Euclidean distance)
 *
 * Search modes (all return the same neighbours; ties broken by row index):
 *   KD_TREE     k-d tree search with pruning             ~O(log n + K log K) per query
 *   BRUTE_HEAP  scan every row, keep the K best in a heap O(n log K)
 *   BRUTE_SORT  scan every row, merge-sort all distances  O(n log n)
 * Risk = share of the K neighbours that have cancer.
 */
class KNNClassifier {
public:
    enum SearchMode { KD_TREE, BRUTE_HEAP, BRUTE_SORT };

private:
    std::vector<std::vector<double>> X_train;
    std::vector<int> y_train;
    KDTree tree;
    int k;
    bool isTrained;

public:
    explicit KNNClassifier(int k = 5);

    // Training builds the k-d tree
    void fit(const std::vector<std::vector<double>>& X, const std::vector<int>& y);

    // Nearest training rows for one sample: (distance, row index), closest first.
    // kOverride > 0 uses that K for this call only. visited counts rows or nodes examined.
    std::vector<std::pair<double, size_t>> findNeighbors(const std::vector<double>& sample, int kOverride = 0,
                                                         SearchMode mode = KD_TREE, long* visited = nullptr) const;

    double predictProbabilitySingle(const std::vector<double>& sample, int kOverride = 0) const;
    int predictSingle(const std::vector<double>& sample) const;
    std::vector<int> predict(const std::vector<std::vector<double>>& X) const;
    std::vector<double> predictProbability(const std::vector<std::vector<double>>& X) const;

    int getTrainingLabel(size_t index) const;
    const KDTree& getTree() const;

    // Parameters
    void setK(int k);
    int getK() const;
    bool getIsTrained() const;
};

#endif // KNN_CLASSIFIER_H

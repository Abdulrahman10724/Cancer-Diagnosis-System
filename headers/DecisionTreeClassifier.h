#ifndef DECISION_TREE_CLASSIFIER_H
#define DECISION_TREE_CLASSIFIER_H

#include <cstddef>
#include <memory>
#include <vector>

/**
 * @struct TreeNode
 * @brief Node of the decision tree (a binary tree)
 *
 * Internal node: sample goes left when x[featureIndex] <= threshold.
 * Leaf: featureIndex == -1; positiveFraction is the cancer share of its training rows.
 */
struct TreeNode {
    int featureIndex;
    double threshold;
    int prediction;
    double positiveFraction; // share of training rows here with label 1
    int sampleCount;         // training rows that reached this node
    double giniDecrease;     // (rows here / all rows) * (gini here - weighted gini of children)
    std::shared_ptr<TreeNode> left;
    std::shared_ptr<TreeNode> right;

    TreeNode() : featureIndex(-1), threshold(0.0), prediction(0), positiveFraction(0.0),
                 sampleCount(0), giniDecrease(0.0), left(nullptr), right(nullptr) {}
};

/**
 * @class DecisionTreeClassifier
 * @brief CART-style tree with Gini impurity, built on index lists (no row copies)
 *
 * Split search (per node with n rows and f features):
 *   fast  : merge-sort the rows by each feature once, then sweep left to right with
 *           running label counts (prefix sums)               O(f n log n)
 *   naive : for every candidate threshold, copy the rows into left/right vectors and
 *           count again (the original method)                  O(f n^2)
 * Both visit thresholds in the same order with the same tie rule, so they pick the
 * same split. Prediction: O(depth).
 */
class DecisionTreeClassifier {
public:
    struct Split {
        bool found;
        int feature;
        double threshold;
        double gini; // weighted gini of the two children
    };

private:
    std::shared_ptr<TreeNode> root;
    int maxDepth;
    int minSamplesSplit;
    size_t nFeatures;
    size_t nTrain;
    bool naiveSplit;
    std::vector<double> importance;
    int nodeCount;
    long long fitWork; // split-search operations in the last fit

    std::shared_ptr<TreeNode> buildTree(const std::vector<std::vector<double>>& X, const std::vector<int>& y,
                                        const std::vector<size_t>& idx, int depth);
    std::shared_ptr<TreeNode> leaf(int positives, size_t n);

public:
    DecisionTreeClassifier(int maxDepth = 5, int minSamplesSplit = 4);

    static double gini(size_t n, size_t positives);
    static Split findBestSplitFast(const std::vector<std::vector<double>>& X, const std::vector<int>& y,
                                   const std::vector<size_t>& idx, long long* work = nullptr);
    static Split findBestSplitNaive(const std::vector<std::vector<double>>& X, const std::vector<int>& y,
                                    const std::vector<size_t>& idx, long long* work = nullptr);

    // Training and prediction
    void fit(const std::vector<std::vector<double>>& X, const std::vector<int>& y);
    std::vector<int> predict(const std::vector<std::vector<double>>& X) const;
    int predictSingle(const std::vector<double>& sample) const;
    double predictProbabilitySingle(const std::vector<double>& sample) const;
    // Nodes visited from the root to the leaf for one sample (leaf is last)
    std::vector<std::shared_ptr<TreeNode>> getDecisionPath(const std::vector<double>& sample) const;

    // Utility
    void setMaxDepth(int depth);
    void setMinSamplesSplit(int samples);
    void setNaiveSplit(bool naive); // benchmark only
    std::shared_ptr<TreeNode> getRoot() const;
    std::vector<double> featureImportance() const; // total Gini decrease per feature, sums to 1
    int getNodeCount() const;
    int getDepth() const;
    long long getFitWork() const;
};

#endif // DECISION_TREE_CLASSIFIER_H

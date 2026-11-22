#ifndef DECISION_TREE_CLASSIFIER_H
#define DECISION_TREE_CLASSIFIER_H

#include <vector>
#include <memory>

/**
 * @struct TreeNode
 * @brief Node structure for Decision Tree
 */
struct TreeNode {
    int featureIndex;
    double threshold;
    int prediction;
    double positiveFraction; // Fraction of training samples with label 1 at this node
    int sampleCount;         // Number of training samples that reached this node
    std::shared_ptr<TreeNode> left;
    std::shared_ptr<TreeNode> right;
    
    TreeNode() : featureIndex(-1), threshold(0.0), prediction(-1), 
                 positiveFraction(0.0), sampleCount(0), left(nullptr), right(nullptr) {}
};

/**
 * @class DecisionTreeClassifier
 * @brief Implements Decision Tree algorithm for classification
 */
class DecisionTreeClassifier {
private:
    std::shared_ptr<TreeNode> root;
    int maxDepth;
    int minSamplesSplit;
    
    // Helper functions
    double calculateGini(const std::vector<std::vector<double>>& X, 
                        const std::vector<int>& y) const;
    std::pair<int, double> findBestSplit(const std::vector<std::vector<double>>& X, 
                                        const std::vector<int>& y) const;
    int predictSample(const std::vector<double>& sample, 
                     std::shared_ptr<TreeNode> node) const;
    double predictSampleProbability(const std::vector<double>& sample, 
                                    std::shared_ptr<TreeNode> node) const;
    std::shared_ptr<TreeNode> buildTree(const std::vector<std::vector<double>>& X, 
                                       const std::vector<int>& y, 
                                       int depth) const;
    int getMajorityClass(const std::vector<int>& y) const;
    
public:
    DecisionTreeClassifier(int maxDepth = 10, int minSamplesSplit = 2);
    
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
    void displayTree(std::shared_ptr<TreeNode> node, int depth = 0) const;
    std::shared_ptr<TreeNode> getRoot() const;
};

#endif // DECISION_TREE_CLASSIFIER_H



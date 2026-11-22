#include "../headers/DecisionTreeClassifier.h"
#include "../headers/Sorting.h"
#include <stdexcept>

DecisionTreeClassifier::DecisionTreeClassifier(int maxDepth, int minSamplesSplit)
    : root(nullptr), maxDepth(maxDepth), minSamplesSplit(minSamplesSplit), nFeatures(0), nTrain(0),
      naiveSplit(false), nodeCount(0) {}

double DecisionTreeClassifier::gini(size_t n, size_t positives) {
    if (n == 0) return 0.0;
    double p = static_cast<double>(positives) / n;
    return 1.0 - p * p - (1.0 - p) * (1.0 - p);
}

DecisionTreeClassifier::Split DecisionTreeClassifier::findBestSplitFast(
    const std::vector<std::vector<double>>& X, const std::vector<int>& y,
    const std::vector<size_t>& idx, long long* work) {
    Split best{false, -1, 0.0, 0.0};
    size_t n = idx.size();
    if (n < 2) return best;
    size_t totalPos = 0;
    for (size_t i : idx) totalPos += y[i] == 1 ? 1 : 0;
    best.gini = gini(n, totalPos); // a split must lower the impurity
    size_t nFeat = X[idx[0]].size();

    for (size_t f = 0; f < nFeat; ++f) {
        // Rows ordered by this feature (stable merge sort on the index list)
        std::vector<size_t> order = idx;
        Sorting::mergeSortBy(order, [&X, f](size_t a, size_t b) { return X[a][f] < X[b][f]; }, work);
        // Sweep left to right; leftPos is the running (prefix) count of positives
        size_t leftPos = 0;
        for (size_t t = 0; t + 1 < n; ++t) {
            if (work) (*work)++;
            leftPos += y[order[t]] == 1 ? 1 : 0;
            double v = X[order[t]][f];
            double next = X[order[t + 1]][f];
            if (v == next) continue; // only split between distinct values
            size_t nl = t + 1;
            size_t nr = n - nl;
            double weighted = (nl * gini(nl, leftPos) + nr * gini(nr, totalPos - leftPos)) / n;
            if (weighted < best.gini) {
                best = Split{true, static_cast<int>(f), (v + next) / 2.0, weighted};
            }
        }
    }
    return best;
}

DecisionTreeClassifier::Split DecisionTreeClassifier::findBestSplitNaive(
    const std::vector<std::vector<double>>& X, const std::vector<int>& y,
    const std::vector<size_t>& idx, long long* work) {
    Split best{false, -1, 0.0, 0.0};
    size_t n = idx.size();
    if (n < 2) return best;
    size_t totalPos = 0;
    for (size_t i : idx) totalPos += y[i] == 1 ? 1 : 0;
    best.gini = gini(n, totalPos);
    size_t nFeat = X[idx[0]].size();

    for (size_t f = 0; f < nFeat; ++f) {
        std::vector<double> values;
        for (size_t i : idx) values.push_back(X[i][f]);
        values = Sorting::mergeSort(values, work);
        for (size_t t = 0; t + 1 < values.size(); ++t) {
            if (values[t] == values[t + 1]) continue;
            double threshold = (values[t] + values[t + 1]) / 2.0;
            // Copy the rows into two groups and count them again for every threshold
            std::vector<int> left;
            std::vector<int> right;
            for (size_t i : idx) {
                if (work) (*work)++;
                if (X[i][f] <= threshold) left.push_back(y[i]);
                else right.push_back(y[i]);
            }
            size_t leftPos = 0;
            for (int label : left) leftPos += label == 1 ? 1 : 0;
            size_t nl = left.size();
            size_t nr = right.size();
            double weighted = (nl * gini(nl, leftPos) + nr * gini(nr, totalPos - leftPos)) / n;
            if (weighted < best.gini) {
                best = Split{true, static_cast<int>(f), threshold, weighted};
            }
        }
    }
    return best;
}

std::shared_ptr<TreeNode> DecisionTreeClassifier::leaf(int positives, size_t n) {
    auto node = std::make_shared<TreeNode>();
    node->sampleCount = static_cast<int>(n);
    node->positiveFraction = n ? static_cast<double>(positives) / n : 0.0;
    node->prediction = node->positiveFraction >= 0.5 ? 1 : 0;
    nodeCount++;
    return node;
}

std::shared_ptr<TreeNode> DecisionTreeClassifier::buildTree(const std::vector<std::vector<double>>& X,
                                                            const std::vector<int>& y,
                                                            const std::vector<size_t>& idx, int depth) {
    int positives = 0;
    for (size_t i : idx) positives += y[i] == 1 ? 1 : 0;
    size_t n = idx.size();
    bool pure = positives == 0 || positives == static_cast<int>(n);
    if (depth >= maxDepth || static_cast<int>(n) < minSamplesSplit || pure) {
        return leaf(positives, n);
    }
    Split s = naiveSplit ? findBestSplitNaive(X, y, idx) : findBestSplitFast(X, y, idx);
    if (!s.found) return leaf(positives, n);

    std::vector<size_t> leftIdx;
    std::vector<size_t> rightIdx;
    for (size_t i : idx) {
        if (X[i][static_cast<size_t>(s.feature)] <= s.threshold) leftIdx.push_back(i);
        else rightIdx.push_back(i);
    }
    auto node = leaf(positives, n); // fills counts, then becomes an internal node
    node->featureIndex = s.feature;
    node->threshold = s.threshold;
    node->giniDecrease = (static_cast<double>(n) / nTrain) * (gini(n, static_cast<size_t>(positives)) - s.gini);
    importance[static_cast<size_t>(s.feature)] += node->giniDecrease;
    node->left = buildTree(X, y, leftIdx, depth + 1);
    node->right = buildTree(X, y, rightIdx, depth + 1);
    return node;
}

void DecisionTreeClassifier::fit(const std::vector<std::vector<double>>& X, const std::vector<int>& y) {
    if (X.empty() || y.empty()) {
        throw std::runtime_error("Training data is empty");
    }
    if (X.size() != y.size()) {
        throw std::runtime_error("X and y must have the same size");
    }
    nFeatures = X[0].size();
    nTrain = X.size();
    importance.assign(nFeatures, 0.0);
    nodeCount = 0;
    std::vector<size_t> idx(X.size());
    for (size_t i = 0; i < idx.size(); ++i) idx[i] = i;
    root = buildTree(X, y, idx, 0);
}

std::vector<std::shared_ptr<TreeNode>> DecisionTreeClassifier::getDecisionPath(const std::vector<double>& sample) const {
    if (!root) {
        throw std::runtime_error("Model not trained. Call fit() first.");
    }
    std::vector<std::shared_ptr<TreeNode>> path;
    std::shared_ptr<TreeNode> node = root;
    while (node) {
        path.push_back(node);
        if (node->featureIndex == -1) break;
        node = sample[static_cast<size_t>(node->featureIndex)] <= node->threshold ? node->left : node->right;
    }
    return path;
}

double DecisionTreeClassifier::predictProbabilitySingle(const std::vector<double>& sample) const {
    return getDecisionPath(sample).back()->positiveFraction;
}

int DecisionTreeClassifier::predictSingle(const std::vector<double>& sample) const {
    return predictProbabilitySingle(sample) >= 0.5 ? 1 : 0;
}

std::vector<int> DecisionTreeClassifier::predict(const std::vector<std::vector<double>>& X) const {
    std::vector<int> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predictSingle(row));
    return out;
}

void DecisionTreeClassifier::setMaxDepth(int depth) { maxDepth = depth; }
void DecisionTreeClassifier::setMinSamplesSplit(int samples) { minSamplesSplit = samples; }
void DecisionTreeClassifier::setNaiveSplit(bool naive) { naiveSplit = naive; }
std::shared_ptr<TreeNode> DecisionTreeClassifier::getRoot() const { return root; }
int DecisionTreeClassifier::getNodeCount() const { return nodeCount; }

std::vector<double> DecisionTreeClassifier::featureImportance() const {
    std::vector<double> out = importance;
    double total = 0.0;
    for (double v : out) total += v;
    if (total > 0.0) {
        for (double& v : out) v /= total;
    }
    return out;
}

static int depthOf(const std::shared_ptr<TreeNode>& node) {
    if (!node || node->featureIndex == -1) return 0;
    int l = depthOf(node->left);
    int r = depthOf(node->right);
    return 1 + (l > r ? l : r);
}

int DecisionTreeClassifier::getDepth() const { return depthOf(root); }

#include "../headers/KNNClassifier.h"
#include "../headers/BinaryHeap.h"
#include "../headers/Sorting.h"
#include <cmath>
#include <stdexcept>

namespace {

struct Candidate {
    double d2;
    size_t index;
};

// Larger distance (then larger row index) is "worse"
bool worse(const Candidate& a, const Candidate& b) {
    if (a.d2 != b.d2) return a.d2 > b.d2;
    return a.index > b.index;
}

struct WorseFirst {
    bool operator()(const Candidate& a, const Candidate& b) const { return worse(a, b); }
};

} // namespace

KNNClassifier::KNNClassifier(int k) : k(k), isTrained(false) {
    if (k <= 0) {
        throw std::runtime_error("K must be positive");
    }
}

void KNNClassifier::fit(const std::vector<std::vector<double>>& X, const std::vector<int>& y) {
    if (X.empty() || y.empty()) {
        throw std::runtime_error("Training data is empty");
    }
    if (X.size() != y.size()) {
        throw std::runtime_error("X and y must have the same size");
    }
    X_train = X;
    y_train = y;
    tree.build(X_train);
    isTrained = true;
}

std::vector<std::pair<double, size_t>> KNNClassifier::findNeighbors(const std::vector<double>& sample, int kOverride,
                                                                    SearchMode mode, long* visited) const {
    if (!isTrained) {
        throw std::runtime_error("Model not trained. Call fit() first.");
    }
    size_t kUsed = static_cast<size_t>(kOverride > 0 ? kOverride : k);
    if (kUsed > X_train.size()) kUsed = X_train.size();
    std::vector<std::pair<double, size_t>> out;

    if (mode == KD_TREE) {
        for (const auto& n : tree.kNearest(sample, kUsed, visited)) out.push_back(std::make_pair(n.distance, n.index));
        return out;
    }

    if (mode == BRUTE_HEAP) {
        // Max-heap of the K best so far: the worst of them is on top
        BinaryHeap<Candidate, WorseFirst> heap;
        heap.reserve(kUsed + 1);
        for (size_t i = 0; i < X_train.size(); ++i) {
            Candidate c{KDTree::distance2(sample, X_train[i]), i};
            if (heap.size() < kUsed) heap.push(c);
            else if (worse(heap.top(), c)) {
                heap.pop();
                heap.push(c);
            }
        }
        if (visited) *visited += static_cast<long>(X_train.size());
        out.resize(heap.size());
        for (size_t i = out.size(); i > 0; --i) {
            Candidate c = heap.pop();
            out[i - 1] = std::make_pair(std::sqrt(c.d2), c.index);
        }
        return out;
    }

    // BRUTE_SORT: every distance, merge-sorted
    std::vector<Candidate> all;
    all.reserve(X_train.size());
    for (size_t i = 0; i < X_train.size(); ++i) all.push_back(Candidate{KDTree::distance2(sample, X_train[i]), i});
    Sorting::mergeSortBy(all, [](const Candidate& a, const Candidate& b) { return worse(b, a); });
    if (visited) *visited += static_cast<long>(X_train.size());
    for (size_t i = 0; i < kUsed; ++i) out.push_back(std::make_pair(std::sqrt(all[i].d2), all[i].index));
    return out;
}

double KNNClassifier::predictProbabilitySingle(const std::vector<double>& sample, int kOverride) const {
    auto neighbors = findNeighbors(sample, kOverride);
    if (neighbors.empty()) return 0.0;
    int cancer = 0;
    for (const auto& n : neighbors) {
        if (y_train[n.second] == 1) cancer++;
    }
    return static_cast<double>(cancer) / neighbors.size();
}

int KNNClassifier::predictSingle(const std::vector<double>& sample) const {
    return predictProbabilitySingle(sample) >= 0.5 ? 1 : 0;
}

std::vector<int> KNNClassifier::predict(const std::vector<std::vector<double>>& X) const {
    std::vector<int> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predictSingle(row));
    return out;
}

std::vector<double> KNNClassifier::predictProbability(const std::vector<std::vector<double>>& X) const {
    std::vector<double> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predictProbabilitySingle(row));
    return out;
}

int KNNClassifier::getTrainingLabel(size_t index) const {
    return y_train.at(index);
}

const KDTree& KNNClassifier::getTree() const { return tree; }

void KNNClassifier::setK(int newK) {
    if (newK <= 0) {
        throw std::runtime_error("K must be positive");
    }
    k = newK;
}

int KNNClassifier::getK() const { return k; }
bool KNNClassifier::getIsTrained() const { return isTrained; }

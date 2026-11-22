#include "../headers/KDTree.h"
#include "../headers/BinaryHeap.h"
#include "../headers/Sorting.h"
#include <cmath>
#include <stdexcept>

namespace {

struct Candidate {
    double d2;
    size_t index;
};

// "Worse" candidates go on top of the max-heap: larger distance, then larger index
struct WorseFirst {
    bool operator()(const Candidate& a, const Candidate& b) const {
        if (a.d2 != b.d2) return a.d2 > b.d2;
        return a.index > b.index;
    }
};

typedef BinaryHeap<Candidate, WorseFirst> CandidateHeap;

void offer(CandidateHeap& heap, size_t k, const Candidate& c) {
    if (heap.size() < k) {
        heap.push(c);
    } else if (WorseFirst()(heap.top(), c)) {
        heap.pop();
        heap.push(c);
    }
}

void searchNode(const std::vector<KDTree::Node>& nodes, const std::vector<std::vector<double>>& points,
                int nodeIndex, const std::vector<double>& q, size_t k, CandidateHeap& heap, long& visited) {
    if (nodeIndex < 0) return;
    const KDTree::Node& node = nodes[static_cast<size_t>(nodeIndex)];
    visited++;
    offer(heap, k, Candidate{KDTree::distance2(q, points[node.point]), node.point});

    double diff = q[static_cast<size_t>(node.axis)] - node.split;
    int nearSide = diff <= 0.0 ? node.left : node.right;
    int farSide = diff <= 0.0 ? node.right : node.left;
    searchNode(nodes, points, nearSide, q, k, heap, visited);
    // The far side can only help if the splitting plane is within the K-th best distance
    if (heap.size() < k || diff * diff <= heap.top().d2) {
        searchNode(nodes, points, farSide, q, k, heap, visited);
    }
}

} // namespace

KDTree::KDTree() : root(-1), dims(0) {}

double KDTree::distance2(const std::vector<double>& a, const std::vector<double>& b) {
    double s = 0.0;
    size_t n = a.size() < b.size() ? a.size() : b.size();
    for (size_t i = 0; i < n; ++i) {
        double d = a[i] - b[i];
        s += d * d;
    }
    return s;
}

void KDTree::build(const std::vector<std::vector<double>>& pts) {
    points = pts;
    nodes.clear();
    root = -1;
    dims = points.empty() ? 0 : points[0].size();
    if (points.empty() || dims == 0) return;
    std::vector<size_t> idx(points.size());
    for (size_t i = 0; i < idx.size(); ++i) idx[i] = i;
    nodes.reserve(points.size());
    root = buildRange(idx, 0, idx.size(), 0);
}

int KDTree::buildRange(std::vector<size_t>& idx, size_t lo, size_t hi, int depth) {
    if (lo >= hi) return -1;
    int axis = depth % static_cast<int>(dims);

    // Sort this index range by (coordinate on axis, row index) and take the middle as median
    std::vector<size_t> range(idx.begin() + static_cast<long>(lo), idx.begin() + static_cast<long>(hi));
    const std::vector<std::vector<double>>& p = points;
    Sorting::mergeSortBy(range, [&p, axis](size_t a, size_t b) {
        double va = p[a][static_cast<size_t>(axis)];
        double vb = p[b][static_cast<size_t>(axis)];
        if (va != vb) return va < vb;
        return a < b;
    });
    for (size_t i = 0; i < range.size(); ++i) idx[lo + i] = range[i];

    size_t mid = lo + (hi - lo) / 2;
    int self = static_cast<int>(nodes.size());
    nodes.push_back(Node{idx[mid], axis, points[idx[mid]][static_cast<size_t>(axis)], -1, -1, hi - lo});
    int left = buildRange(idx, lo, mid, depth + 1);
    int right = buildRange(idx, mid + 1, hi, depth + 1);
    nodes[static_cast<size_t>(self)].left = left;
    nodes[static_cast<size_t>(self)].right = right;
    return self;
}

std::vector<KDTree::Neighbor> KDTree::kNearest(const std::vector<double>& query, size_t k, long* visited) const {
    std::vector<Neighbor> out;
    if (root < 0 || k == 0) return out;
    if (query.size() != dims) throw std::runtime_error("Query has the wrong number of dimensions");
    CandidateHeap heap;
    heap.reserve(k + 1);
    long count = 0;
    searchNode(nodes, points, root, query, k, heap, count);
    if (visited) *visited += count;
    // Popping the max-heap gives the worst first: fill from the back
    out.resize(heap.size());
    for (size_t i = out.size(); i > 0; --i) {
        Candidate c = heap.pop();
        out[i - 1] = Neighbor{std::sqrt(c.d2), c.index};
    }
    return out;
}

const std::vector<KDTree::Node>& KDTree::getNodes() const { return nodes; }
int KDTree::getRoot() const { return root; }
size_t KDTree::getDimensions() const { return dims; }
size_t KDTree::size() const { return points.size(); }
const std::vector<double>& KDTree::point(size_t index) const { return points.at(index); }

int KDTree::heightOf(int node) const {
    if (node < 0) return 0;
    int l = heightOf(nodes[static_cast<size_t>(node)].left);
    int r = heightOf(nodes[static_cast<size_t>(node)].right);
    return 1 + (l > r ? l : r);
}

int KDTree::height() const { return heightOf(root); }

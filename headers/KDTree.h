#ifndef KD_TREE_H
#define KD_TREE_H

#include <cstddef>
#include <vector>

/**
 * @class KDTree
 * @brief k-d tree over the standardized training rows, for K-nearest-neighbour search
 *
 * Each node splits on axis depth % dimensions at the median point. The median is
 * found by merge-sorting the node's index range by (coordinate, row index).
 * Search keeps the K best candidates in a max-heap (BinaryHeap) and skips a
 * subtree when (query[axis] - split)^2 > current K-th best distance^2.
 * Ties in distance are broken by row index, so results equal brute force exactly.
 *
 * Complexity (n points, d dimensions):
 *   build      O(n log^2 n)  (a merge sort per level)
 *   kNearest   O(log n + K log K) average, O(n log K) worst case
 *   withinRadius O(n^(1-1/d) + m) typical for m results, O(n) worst case
 *   memory     O(n d)
 */
class KDTree {
public:
    struct Node {
        size_t point;   // row index of the point stored in this node
        int axis;       // splitting dimension
        double split;   // coordinate of the point on that axis
        int left;       // child node index or -1
        int right;
        size_t size;    // number of points in this subtree
    };

    struct Neighbor {
        double distance; // Euclidean distance
        size_t index;    // row index
    };

    KDTree();

    void build(const std::vector<std::vector<double>>& points);
    // K nearest rows, closest first; visited counts the nodes examined
    std::vector<Neighbor> kNearest(const std::vector<double>& query, size_t k, long* visited = nullptr) const;

    // Every row within distance r of query (r inclusive), in no particular order
    std::vector<Neighbor> withinRadius(const std::vector<double>& query, double r, long* visited = nullptr) const;

    const std::vector<Node>& getNodes() const;
    int getRoot() const;
    size_t getDimensions() const;
    size_t size() const;
    int height() const;
    const std::vector<double>& point(size_t index) const;

    // Squared Euclidean distance
    static double distance2(const std::vector<double>& a, const std::vector<double>& b);

private:
    std::vector<std::vector<double>> points;
    std::vector<Node> nodes;
    int root;
    size_t dims;

    int buildRange(std::vector<size_t>& idx, size_t lo, size_t hi, int depth);
    int heightOf(int node) const;
};

#endif // KD_TREE_H

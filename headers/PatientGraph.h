#ifndef PATIENT_GRAPH_H
#define PATIENT_GRAPH_H

#include <cstddef>
#include <vector>

/**
 * @class PatientGraph
 * @brief Undirected similarity graph: one node per patient, an edge when the
 *        Euclidean distance between their standardized feature rows is <= eps
 *
 * Stored as adjacency lists (vector of edge vectors), each list sorted by node
 * index so BFS order is deterministic. Edges are found with a KD-tree radius
 * search per node (build); buildBruteForce compares every pair and gives the
 * same graph (used by the tests).
 *
 * Complexity (V nodes, E edges, d = 4 dimensions):
 *   build            O(V log^2 V) KD-tree + one radius search per node,
 *                    about O(V * (V^(1-1/d) + deg)) typical, O(V^2) worst case
 *   buildBruteForce  O(V^2 d)
 *   bfs              O(V + E), using LinkedQueue
 *   components       O(V + E), one BFS per unvisited node
 *   memory           O(V + E)
 */
class PatientGraph {
public:
    struct Edge {
        size_t to;
        double distance;
    };

    struct Visit {
        size_t node;
        int level;     // number of edges from the start node
        long parent;   // -1 for the start node
    };

    PatientGraph();

    // Returns the number of KD-tree nodes visited while finding edges
    long build(const std::vector<std::vector<double>>& points, double eps);
    void buildBruteForce(const std::vector<std::vector<double>>& points, double eps);

    size_t nodeCount() const;
    size_t edgeCount() const;
    double getEps() const;
    const std::vector<Edge>& neighbors(size_t node) const;

    // Breadth-first order from start (only the nodes reachable from it)
    std::vector<Visit> bfs(size_t start) const;
    // componentOf[i] = component number of node i (0, 1, ... in order of the lowest node index)
    size_t components(std::vector<int>& componentOf) const;

private:
    std::vector<std::vector<Edge>> adjacency;
    size_t edges;
    double eps;

    void sortLists();
};

#endif // PATIENT_GRAPH_H

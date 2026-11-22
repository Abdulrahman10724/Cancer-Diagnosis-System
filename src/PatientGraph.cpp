#include "../headers/PatientGraph.h"
#include "../headers/KDTree.h"
#include "../headers/LinkedQueue.h"
#include "../headers/Sorting.h"
#include <cmath>
#include <stdexcept>

PatientGraph::PatientGraph() : edges(0), eps(0.0) {}

long PatientGraph::build(const std::vector<std::vector<double>>& points, double e) {
    eps = e;
    adjacency.assign(points.size(), std::vector<Edge>());
    edges = 0;
    if (points.empty()) return 0;
    KDTree tree;
    tree.build(points);
    long visited = 0;
    for (size_t i = 0; i < points.size(); ++i) {
        std::vector<KDTree::Neighbor> near = tree.withinRadius(points[i], eps, &visited);
        for (const auto& n : near) {
            if (n.index == i) continue;
            adjacency[i].push_back(Edge{n.index, n.distance});
            if (n.index > i) edges++; // each undirected edge is found from both ends
        }
    }
    sortLists();
    return visited;
}

void PatientGraph::buildBruteForce(const std::vector<std::vector<double>>& points, double e) {
    eps = e;
    adjacency.assign(points.size(), std::vector<Edge>());
    edges = 0;
    double eps2 = eps * eps;
    for (size_t i = 0; i < points.size(); ++i) {
        for (size_t j = i + 1; j < points.size(); ++j) {
            double d2 = KDTree::distance2(points[i], points[j]);
            if (d2 <= eps2) {
                double d = std::sqrt(d2);
                adjacency[i].push_back(Edge{j, d});
                adjacency[j].push_back(Edge{i, d});
                edges++;
            }
        }
    }
    sortLists();
}

void PatientGraph::sortLists() {
    for (auto& list : adjacency) {
        Sorting::mergeSortBy(list, [](const Edge& a, const Edge& b) { return a.to < b.to; });
    }
}

size_t PatientGraph::nodeCount() const { return adjacency.size(); }
size_t PatientGraph::edgeCount() const { return edges; }
double PatientGraph::getEps() const { return eps; }

const std::vector<PatientGraph::Edge>& PatientGraph::neighbors(size_t node) const {
    if (node >= adjacency.size()) throw std::out_of_range("No such node");
    return adjacency[node];
}

std::vector<PatientGraph::Visit> PatientGraph::bfs(size_t start) const {
    std::vector<Visit> order;
    if (start >= adjacency.size()) return order;
    std::vector<int> level(adjacency.size(), -1);
    std::vector<long> parent(adjacency.size(), -1);
    LinkedQueue<size_t> queue;
    level[start] = 0;
    queue.push(start);
    while (!queue.empty()) {
        size_t u = queue.pop();
        order.push_back(Visit{u, level[u], parent[u]});
        for (const Edge& e : adjacency[u]) {
            if (level[e.to] >= 0) continue;
            level[e.to] = level[u] + 1;
            parent[e.to] = static_cast<long>(u);
            queue.push(e.to);
        }
    }
    return order;
}

size_t PatientGraph::components(std::vector<int>& componentOf) const {
    componentOf.assign(adjacency.size(), -1);
    int next = 0;
    for (size_t s = 0; s < adjacency.size(); ++s) {
        if (componentOf[s] >= 0) continue;
        LinkedQueue<size_t> queue;
        componentOf[s] = next;
        queue.push(s);
        while (!queue.empty()) {
            size_t u = queue.pop();
            for (const Edge& e : adjacency[u]) {
                if (componentOf[e.to] >= 0) continue;
                componentOf[e.to] = next;
                queue.push(e.to);
            }
        }
        next++;
    }
    return static_cast<size_t>(next);
}

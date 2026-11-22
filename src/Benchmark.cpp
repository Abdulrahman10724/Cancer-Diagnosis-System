#include "../headers/Benchmark.h"
#include "../headers/AVLTree.h"
#include "../headers/BinaryHeap.h"
#include "../headers/DataPreprocessor.h"
#include "../headers/DecisionTreeClassifier.h"
#include "../headers/HashMapper.h"
#include "../headers/KDTree.h"
#include "../headers/Sampling.h"
#include "../headers/Sorting.h"
#include <chrono>
#include <cmath>
#include <memory>
#include <random>

namespace {

const size_t LOOKUPS = 200;
const size_t KNN_QUERIES = 100;
const size_t K = 5;

struct Synthetic {
    std::vector<std::string> ids;
    std::vector<std::vector<double>> raw;
    std::vector<int> labels;
    std::vector<double> risk;
};

double uniform(std::mt19937& rng) {
    return static_cast<double>(rng()) / 4294967296.0; // [0, 1), same on every compiler
}

std::vector<double> randomFeatures(std::mt19937& rng) {
    double avg = 0.1 + 0.8 * uniform(rng);
    double mx = avg + 0.3 * uniform(rng);
    if (mx > 1.0) mx = 1.0;
    double high = static_cast<double>(rng() % 7);
    double age = 20.0 + static_cast<double>(rng() % 71);
    return std::vector<double>{avg, mx, high, age};
}

Synthetic makePatients(size_t n, std::mt19937& rng) {
    Synthetic s;
    for (size_t i = 0; i < n; ++i) {
        std::string num = std::to_string(i + 1);
        while (num.size() < 6) num = "0" + num;
        s.ids.push_back("S" + num);
        std::vector<double> f = randomFeatures(rng);
        double z = 6.0 * (f[0] - 0.5) + 3.0 * (f[1] - 0.6) + 0.4 * (f[2] - 2.0) + 0.01 * (f[3] - 55.0);
        double p = 1.0 / (1.0 + std::exp(-z));
        s.labels.push_back(uniform(rng) < p ? 1 : 0);
        s.risk.push_back(p);
        s.raw.push_back(f);
    }
    return s;
}

// Runs job RUNS times and keeps the fastest; job returns its step count
template <typename Job>
BenchmarkVariant timeBest(const std::string& name, Job job) {
    BenchmarkVariant v{name, 0, 0.0};
    for (int r = 0; r < Benchmark::RUNS; ++r) {
        auto start = std::chrono::steady_clock::now();
        long long steps = job();
        auto end = std::chrono::steady_clock::now();
        double micros = std::chrono::duration<double, std::micro>(end - start).count();
        if (r == 0 || micros < v.micros) v.micros = micros;
        v.steps = steps;
    }
    return v;
}

// ---- Find patient by ID ----

struct ListNode {
    std::string id;
    size_t index;
    std::unique_ptr<ListNode> next;
};

struct IdList {
    std::unique_ptr<ListNode> head;
    ListNode* tail = nullptr;
    void append(const std::string& id, size_t index) {
        std::unique_ptr<ListNode> node(new ListNode{id, index, nullptr});
        ListNode* raw = node.get();
        if (tail) tail->next = std::move(node);
        else head = std::move(node);
        tail = raw;
    }
    ~IdList() {
        while (head) head = std::move(head->next); // iterative: no deep recursion
    }
};

struct StrLess {
    bool operator()(const std::string& a, const std::string& b) const { return a < b; }
};

BenchmarkTask lookupTask(const Synthetic& s, std::mt19937& rng) {
    size_t n = s.ids.size();
    // Insert in shuffled order so the list order is not the ID order
    std::vector<size_t> order(n);
    for (size_t i = 0; i < n; ++i) order[i] = i;
    Sampling::shuffle(order, rng);

    IdList list;
    AVLTree<std::string, size_t, StrLess> avl;
    HashMapper hash;
    for (size_t i : order) {
        list.append(s.ids[i], i);
        avl.insert(s.ids[i], i);
        hash.put(s.ids[i], static_cast<double>(i));
    }
    std::vector<std::string> queries;
    for (size_t q = 0; q < LOOKUPS; ++q) queries.push_back(s.ids[rng() % n]);

    std::vector<size_t> foundList(LOOKUPS), foundAvl(LOOKUPS), foundHash(LOOKUPS);
    BenchmarkTask t{"Find patient by ID", "nodes or chain entries compared", LOOKUPS, true, {}};
    t.variants.push_back(timeBest("Linked list", [&]() {
        long long steps = 0;
        for (size_t q = 0; q < queries.size(); ++q) {
            for (const ListNode* p = list.head.get(); p; p = p->next.get()) {
                steps++;
                if (p->id == queries[q]) {
                    foundList[q] = p->index;
                    break;
                }
            }
        }
        return steps;
    }));
    t.variants.push_back(timeBest("AVL tree", [&]() {
        int steps = 0;
        for (size_t q = 0; q < queries.size(); ++q) avl.find(queries[q], &foundAvl[q], nullptr, &steps);
        return static_cast<long long>(steps);
    }));
    t.variants.push_back(timeBest("Hash table", [&]() {
        int steps = 0;
        for (size_t q = 0; q < queries.size(); ++q) {
            double v = 0.0;
            hash.get(queries[q], v, &steps);
            foundHash[q] = static_cast<size_t>(v);
        }
        return static_cast<long long>(steps);
    }));
    for (size_t q = 0; q < LOOKUPS; ++q) {
        if (foundList[q] != foundAvl[q] || foundList[q] != foundHash[q]) t.sameAnswer = false;
    }
    return t;
}

// ---- Find 5 nearest neighbours ----

struct Candidate {
    double d2;
    size_t index;
};

bool closer(const Candidate& a, const Candidate& b) {
    if (a.d2 != b.d2) return a.d2 < b.d2;
    return a.index < b.index;
}

// Worse candidate on top of the max-heap; counts every comparison
struct CountingWorse {
    long long* count;
    bool operator()(const Candidate& a, const Candidate& b) const {
        (*count)++;
        return closer(b, a);
    }
};

BenchmarkTask knnTask(const std::vector<std::vector<double>>& X, const DataPreprocessor& scaler, std::mt19937& rng) {
    std::vector<std::vector<double>> queries;
    for (size_t q = 0; q < KNN_QUERIES; ++q) queries.push_back(scaler.transform(randomFeatures(rng)));
    KDTree tree;
    tree.build(X);

    std::vector<std::vector<size_t>> bySort(KNN_QUERIES), byHeap(KNN_QUERIES), byTree(KNN_QUERIES);
    BenchmarkTask t{"Find 5 nearest neighbours", "distances computed + comparisons (KD-tree: nodes visited)",
                    KNN_QUERIES, true, {}};
    t.variants.push_back(timeBest("Brute force + full sort", [&]() {
        long long steps = 0;
        for (size_t q = 0; q < queries.size(); ++q) {
            std::vector<Candidate> all(X.size());
            for (size_t i = 0; i < X.size(); ++i) all[i] = Candidate{KDTree::distance2(queries[q], X[i]), i};
            steps += static_cast<long long>(X.size());
            Sorting::mergeSortBy(all, closer, &steps);
            bySort[q].clear();
            for (size_t j = 0; j < K && j < all.size(); ++j) bySort[q].push_back(all[j].index);
        }
        return steps;
    }));
    t.variants.push_back(timeBest("Brute force + heap", [&]() {
        long long steps = 0;
        for (size_t q = 0; q < queries.size(); ++q) {
            BinaryHeap<Candidate, CountingWorse> heap(CountingWorse{&steps});
            heap.reserve(K + 1);
            for (size_t i = 0; i < X.size(); ++i) {
                Candidate c{KDTree::distance2(queries[q], X[i]), i};
                steps++;
                if (heap.size() < K) {
                    heap.push(c);
                } else {
                    steps++;
                    if (closer(c, heap.top())) {
                        heap.pop();
                        heap.push(c);
                    }
                }
            }
            byHeap[q].assign(heap.size(), 0);
            for (size_t j = byHeap[q].size(); j > 0; --j) byHeap[q][j - 1] = heap.pop().index;
        }
        return steps;
    }));
    t.variants.push_back(timeBest("KD-tree", [&]() {
        long visited = 0;
        for (size_t q = 0; q < queries.size(); ++q) {
            std::vector<KDTree::Neighbor> nb = tree.kNearest(queries[q], K, &visited);
            byTree[q].clear();
            for (const auto& x : nb) byTree[q].push_back(x.index);
        }
        return static_cast<long long>(visited);
    }));
    for (size_t q = 0; q < KNN_QUERIES; ++q) {
        if (bySort[q] != byHeap[q] || bySort[q] != byTree[q]) t.sameAnswer = false;
    }
    return t;
}

// ---- Train decision tree ----

BenchmarkTask treeTask(const std::vector<std::vector<double>>& X, const std::vector<int>& y) {
    DecisionTreeClassifier naive(5, 4), fast(5, 4);
    naive.setNaiveSplit(true);
    BenchmarkTask t{"Train decision tree", "split-search operations (comparisons and Gini evaluations)", 0, true, {}};
    t.variants.push_back(timeBest("Naive split search", [&]() {
        naive.fit(X, y);
        return naive.getFitWork();
    }));
    t.variants.push_back(timeBest("Merge sort + prefix sums", [&]() {
        fast.fit(X, y);
        return fast.getFitWork();
    }));
    if (naive.getNodeCount() != fast.getNodeCount() || naive.predict(X) != fast.predict(X)) t.sameAnswer = false;
    return t;
}

// ---- Order triage queue ----

struct Item {
    double risk;
    size_t arrival;
};

bool before(const Item& a, const Item& b) {
    if (a.risk != b.risk) return a.risk > b.risk;
    return a.arrival < b.arrival;
}

struct CountingBefore {
    long long* count;
    bool operator()(const Item& a, const Item& b) const {
        (*count)++;
        return before(a, b);
    }
};

BenchmarkTask triageTask(const Synthetic& s) {
    std::vector<Item> items;
    for (size_t i = 0; i < s.risk.size(); ++i) {
        // Round to 3 decimals so equal risks (and the arrival tie-break) actually occur
        items.push_back(Item{std::floor(s.risk[i] * 1000.0) / 1000.0, i});
    }
    std::vector<size_t> byScan, byHeap;
    BenchmarkTask t{"Order triage queue", "comparisons", 0, true, {}};
    t.variants.push_back(timeBest("Repeated selection scan", [&]() {
        long long steps = 0;
        std::vector<Item> a = items;
        byScan.clear();
        for (size_t i = 0; i < a.size(); ++i) {
            size_t best = i;
            for (size_t j = i + 1; j < a.size(); ++j) {
                steps++;
                if (before(a[j], a[best])) best = j;
            }
            std::swap(a[i], a[best]);
            byScan.push_back(a[i].arrival);
        }
        return steps;
    }));
    t.variants.push_back(timeBest("Binary heap", [&]() {
        long long steps = 0;
        BinaryHeap<Item, CountingBefore> heap(CountingBefore{&steps});
        heap.reserve(items.size());
        for (const Item& it : items) heap.push(it);
        byHeap.clear();
        while (!heap.empty()) byHeap.push_back(heap.pop().arrival);
        return steps;
    }));
    if (byScan != byHeap) t.sameAnswer = false;
    return t;
}

} // namespace

BenchmarkResult Benchmark::run(size_t n, unsigned seed) {
    if (n < MIN_N) n = MIN_N;
    if (n > MAX_N) n = MAX_N;
    std::mt19937 rng(seed);
    Synthetic s = makePatients(n, rng);
    DataPreprocessor scaler;
    scaler.fit(s.raw);
    std::vector<std::vector<double>> X = scaler.transform(s.raw);

    BenchmarkResult result{n, seed, RUNS, {}};
    result.tasks.push_back(lookupTask(s, rng));
    result.tasks.push_back(knnTask(X, scaler, rng));
    result.tasks.push_back(treeTask(X, s.labels));
    result.tasks.push_back(triageTask(s));
    return result;
}

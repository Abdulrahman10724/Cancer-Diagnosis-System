// Unit tests for the data structures and models. Run with ctest (target cds_tests).
#include "AVLTree.h"
#include "BinaryHeap.h"
#include "CancerDiagnosisSystem.h"
#include "DataPreprocessor.h"
#include "DatasetLoader.h"
#include "DecisionTreeClassifier.h"
#include "FeatureExtractor.h"
#include "HashMapper.h"
#include "KDTree.h"
#include "PatientGraph.h"
#include "Sorting.h"
#include "Stack.h"
#include <cmath>
#include <cstdio>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <vector>

// ---- Tiny assertion helper ----

namespace {

int checksRun = 0;
int checksFailed = 0;
const char* currentTest = "";

void check(bool ok, const char* expr, const char* file, int line) {
    checksRun++;
    if (!ok) {
        checksFailed++;
        std::cerr << "FAIL [" << currentTest << "] " << file << ":" << line << ": " << expr << "\n";
    }
}

bool near(double a, double b, double tol = 1e-9) { return std::fabs(a - b) <= tol; }

} // namespace

#define CHECK(cond) check((cond), #cond, __FILE__, __LINE__)
#define CHECK_NEAR(a, b, tol) check(near((a), (b), (tol)), #a " ~= " #b, __FILE__, __LINE__)

// ---- Helpers ----

namespace {

struct Pair {
    int key;
    int order; // original position, to check stability
};

std::vector<int> insertionSort(std::vector<int> a) {
    for (size_t i = 1; i < a.size(); ++i) {
        int v = a[i];
        size_t j = i;
        while (j > 0 && a[j - 1] > v) {
            a[j] = a[j - 1];
            j--;
        }
        a[j] = v;
    }
    return a;
}

struct IntLess {
    bool operator()(int a, int b) const { return a < b; }
};
struct IntGreater {
    bool operator()(int a, int b) const { return a > b; }
};

std::vector<std::vector<double>> randomPoints(std::mt19937& rng, size_t n, size_t d, int levels) {
    std::vector<std::vector<double>> pts;
    for (size_t i = 0; i < n; ++i) {
        std::vector<double> p;
        for (size_t j = 0; j < d; ++j) p.push_back(static_cast<double>(rng() % static_cast<unsigned>(levels)) / 10.0);
        pts.push_back(p);
    }
    return pts;
}

// A small valid dataset: 30 patients, 6 genes; diagnosis follows the gene scores
DatasetContent smallDataset() {
    std::ostringstream p, g, pg;
    p << "Patient_ID,Name,Age,Diagnosis\n";
    g << "Gene_ID,Mutation_Score\n";
    pg << "Patient_ID,Gene_ID\n";
    const double scores[6] = {0.1, 0.2, 0.3, 0.75, 0.85, 0.95};
    for (int i = 0; i < 6; ++i) g << "G" << i << "," << scores[i] << "\n";
    for (int i = 0; i < 30; ++i) {
        bool sick = i % 2 == 1;
        p << "P" << (i < 10 ? "0" : "") << i << ",Name " << i << "," << (30 + i) << "," << (sick ? 1 : 0) << "\n";
        int a = sick ? 3 + i % 3 : i % 3;
        int b = sick ? 3 + (i + 1) % 3 : (i + 1) % 3;
        pg << "P" << (i < 10 ? "0" : "") << i << ",G" << a << "\n";
        pg << "P" << (i < 10 ? "0" : "") << i << ",G" << b << "\n";
    }
    return DatasetContent{p.str(), g.str(), pg.str()};
}

const DatasetFiles TEST_FILES{"cds_test_patients.csv", "cds_test_genes.csv", "cds_test_patient_genes.csv"};

void removeTestFiles() {
    std::remove(TEST_FILES.patients.c_str());
    std::remove(TEST_FILES.genes.c_str());
    std::remove(TEST_FILES.patientGenes.c_str());
}

bool loadSmall(CancerDiagnosisSystem& sys) {
    std::vector<std::string> problems;
    return sys.loadContent(smallDataset(), TEST_FILES, "test", problems);
}

std::vector<std::string> idsInOrder(const CancerDiagnosisSystem& sys) {
    std::vector<std::string> ids;
    for (const Patient* p : sys.patientsInOrder()) ids.push_back(p->getPatientId());
    return ids;
}

bool contains(const std::vector<std::string>& list, const std::string& part) {
    for (const auto& s : list) {
        if (s.find(part) != std::string::npos) return true;
    }
    return false;
}

} // namespace

// ---- Tests ----

void testMergeSort() {
    std::mt19937 rng(1);
    for (int t = 0; t < 100; ++t) {
        std::vector<int> a;
        size_t n = rng() % 200;
        for (size_t i = 0; i < n; ++i) a.push_back(static_cast<int>(rng() % 50) - 25);
        std::vector<int> b = a;
        Sorting::mergeSortBy(b, IntLess());
        CHECK(b == insertionSort(a));
    }
    // Stability: equal keys keep their original order
    std::vector<Pair> pairs;
    for (int i = 0; i < 500; ++i) pairs.push_back(Pair{static_cast<int>(rng() % 10), i});
    Sorting::mergeSortBy(pairs, [](const Pair& x, const Pair& y) { return x.key < y.key; });
    bool stable = true;
    for (size_t i = 1; i < pairs.size(); ++i) {
        if (pairs[i - 1].key > pairs[i].key) stable = false;
        if (pairs[i - 1].key == pairs[i].key && pairs[i - 1].order > pairs[i].order) stable = false;
    }
    CHECK(stable);
    // argsort is stable too
    std::vector<size_t> idx = Sorting::argsortMergeSort({3.0, 1.0, 3.0, 1.0, 2.0});
    CHECK((idx == std::vector<size_t>{1, 3, 4, 0, 2}));
    CHECK((Sorting::mergeSort({2.5, -1.0, 0.0}) == std::vector<double>{-1.0, 0.0, 2.5}));
}

void testHeap() {
    std::mt19937 rng(2);
    std::vector<int> values;
    for (int i = 0; i < 1000; ++i) values.push_back(static_cast<int>(rng() % 300));
    BinaryHeap<int, IntGreater> maxHeap;
    BinaryHeap<int, IntLess> minHeap;
    for (int v : values) {
        maxHeap.push(v);
        minHeap.push(v);
    }
    CHECK(maxHeap.size() == 1000);
    std::vector<int> sorted = insertionSort(values);
    bool maxOk = true, minOk = true;
    for (size_t i = 0; i < sorted.size(); ++i) {
        if (minHeap.pop() != sorted[i]) minOk = false;
        if (maxHeap.pop() != sorted[sorted.size() - 1 - i]) maxOk = false;
    }
    CHECK(maxOk);
    CHECK(minOk);
    CHECK(maxHeap.empty());
    CHECK(minHeap.empty());
}

void testAVL() {
    std::mt19937 rng(3);
    AVLTree<int, int, IntLess> tree;
    std::vector<bool> present(2000, false);
    size_t expected = 0;
    bool alwaysValid = true;
    for (int op = 0; op < 1000; ++op) {
        int k = static_cast<int>(rng() % 2000);
        if (rng() % 3 == 0) {
            bool removed = tree.erase(k);
            CHECK(removed == present[static_cast<size_t>(k)]);
            if (removed) expected--;
            present[static_cast<size_t>(k)] = false;
        } else {
            bool added = tree.insert(k, k * 10);
            CHECK(added == !present[static_cast<size_t>(k)]);
            if (added) expected++;
            present[static_cast<size_t>(k)] = true;
        }
        if (!tree.isValid()) alwaysValid = false;
    }
    CHECK(alwaysValid);
    CHECK(tree.size() == expected);
    // Height of an AVL tree is at most 1.44 log2(n + 2)
    CHECK(tree.height() <= static_cast<int>(1.45 * std::log2(static_cast<double>(expected) + 2.0)) + 1);

    std::vector<std::pair<int, int>> in = tree.inOrder();
    bool sorted = in.size() == expected;
    for (size_t i = 1; i < in.size(); ++i) {
        if (!(in[i - 1].first < in[i].first)) sorted = false;
    }
    CHECK(sorted);

    for (int t = 0; t < 50; ++t) {
        int lo = static_cast<int>(rng() % 2000);
        int hi = lo + static_cast<int>(rng() % 300);
        std::vector<std::pair<int, int>> got = tree.rangeQuery(lo, hi);
        std::vector<int> want;
        for (int k = lo; k <= hi && k < 2000; ++k) {
            if (present[static_cast<size_t>(k)]) want.push_back(k);
        }
        bool same = got.size() == want.size();
        for (size_t i = 0; same && i < got.size(); ++i) {
            if (got[i].first != want[i] || got[i].second != want[i] * 10) same = false;
        }
        CHECK(same);
    }
    int v = 0;
    int steps = 0;
    CHECK(!tree.find(-5, &v, nullptr, &steps));
    CHECK(steps > 0);
}

void testKDTree() {
    std::mt19937 rng(4);
    // Few distinct coordinates, so there are many ties in distance
    std::vector<std::vector<double>> pts = randomPoints(rng, 500, 4, 8);
    KDTree tree;
    tree.build(pts);
    CHECK(tree.size() == 500);
    bool allEqual = true;
    for (int q = 0; q < 200; ++q) {
        std::vector<double> query = randomPoints(rng, 1, 4, 8)[0];
        size_t k = 1 + rng() % 9;
        std::vector<KDTree::Neighbor> got = tree.kNearest(query, k);
        // Brute force: distances sorted by (distance, index)
        std::vector<KDTree::Neighbor> all;
        for (size_t i = 0; i < pts.size(); ++i) all.push_back(KDTree::Neighbor{KDTree::distance2(query, pts[i]), i});
        Sorting::mergeSortBy(all, [](const KDTree::Neighbor& a, const KDTree::Neighbor& b) {
            if (a.distance != b.distance) return a.distance < b.distance;
            return a.index < b.index;
        });
        if (got.size() != k) allEqual = false;
        for (size_t i = 0; allEqual && i < k; ++i) {
            if (got[i].index != all[i].index || !near(got[i].distance, std::sqrt(all[i].distance), 1e-12)) allEqual = false;
        }
    }
    CHECK(allEqual);
    long visited = 0;
    tree.kNearest(pts[0], 5, &visited);
    CHECK(visited > 0 && visited <= 500);
}

void testSplit() {
    std::mt19937 rng(5);
    bool same = true;
    for (int t = 0; t < 100; ++t) {
        size_t n = 2 + rng() % 60;
        std::vector<std::vector<double>> X = randomPoints(rng, n, 4, 6);
        std::vector<int> y;
        std::vector<size_t> idx;
        for (size_t i = 0; i < n; ++i) {
            y.push_back(static_cast<int>(rng() % 2));
            idx.push_back(i);
        }
        DecisionTreeClassifier::Split a = DecisionTreeClassifier::findBestSplitFast(X, y, idx);
        DecisionTreeClassifier::Split b = DecisionTreeClassifier::findBestSplitNaive(X, y, idx);
        if (a.found != b.found) same = false;
        else if (a.found && (a.feature != b.feature || !near(a.threshold, b.threshold, 1e-12) || !near(a.gini, b.gini, 1e-12))) same = false;
    }
    CHECK(same);
    // Whole trees agree too
    std::vector<std::vector<double>> X = randomPoints(rng, 300, 4, 20);
    std::vector<int> y;
    for (const auto& r : X) y.push_back(r[0] + r[1] > 2.0 ? 1 : 0);
    DecisionTreeClassifier fast(5, 4), naive(5, 4);
    naive.setNaiveSplit(true);
    fast.fit(X, y);
    naive.fit(X, y);
    CHECK(fast.getNodeCount() == naive.getNodeCount());
    CHECK(fast.predict(X) == naive.predict(X));
    CHECK(fast.getFitWork() < naive.getFitWork());
}

void testHashTable() {
    HashMapper map;
    CHECK(map.size() == 0);
    CHECK(map.put("GENE_1", 0.5));
    CHECK(!map.put("GENE_1", 0.6)); // existing key: value replaced, not added
    double v = 0.0;
    CHECK(map.get("GENE_1", v) && near(v, 0.6, 1e-12));
    CHECK(!map.get("missing", v));

    size_t startBuckets = map.bucketCount();
    for (int i = 0; i < 1000; ++i) map.put("K" + std::to_string(i), i);
    CHECK(map.size() == 1001);
    CHECK(map.bucketCount() > startBuckets); // rehashed
    CHECK(map.loadFactor() <= 0.75);
    bool allFound = true;
    for (int i = 0; i < 1000; ++i) {
        if (!map.get("K" + std::to_string(i), v) || !near(v, i, 1e-12)) allFound = false;
    }
    CHECK(allFound);

    // Collisions: at least one chain holds two or more keys, and the chain lengths add up
    size_t longest = 0, total = 0;
    for (size_t b = 0; b < map.bucketCount(); ++b) {
        size_t len = 0;
        for (const HashNode* n = map.bucketHead(b); n; n = n->next.get()) len++;
        total += len;
        if (len > longest) longest = len;
    }
    CHECK(longest >= 2);
    CHECK(total == map.size());

    CHECK(map.erase("K5"));
    CHECK(!map.erase("K5"));
    CHECK(!map.get("K5", v));
    CHECK(map.size() == 1000);
    HashMapper copy(map);
    map.clear();
    CHECK(copy.size() == 1000 && copy.get("K7", v));
}

void testGraph() {
    // Points on a line: 0 - 1 - 2 are linked (gap 1), 3 - 4 linked, 5 alone
    std::vector<std::vector<double>> pts = {{0, 0, 0, 0}, {1, 0, 0, 0}, {2, 0, 0, 0},
                                            {10, 0, 0, 0}, {11, 0, 0, 0}, {20, 0, 0, 0}};
    PatientGraph g;
    g.build(pts, 1.0);
    CHECK(g.edgeCount() == 3);
    std::vector<PatientGraph::Visit> order = g.bfs(1);
    CHECK(order.size() == 3);
    CHECK(order[0].node == 1 && order[0].level == 0 && order[0].parent == -1);
    CHECK(order[1].node == 0 && order[1].level == 1 && order[1].parent == 1);
    CHECK(order[2].node == 2 && order[2].level == 1);
    std::vector<PatientGraph::Visit> fromEnd = g.bfs(0);
    CHECK(fromEnd.size() == 3 && fromEnd[2].node == 2 && fromEnd[2].level == 2);
    std::vector<int> comp;
    CHECK(g.components(comp) == 3);
    CHECK(comp[0] == comp[2] && comp[3] == comp[4] && comp[0] != comp[3] && comp[5] != comp[3]);

    // KD-tree edge search equals the all-pairs version
    std::mt19937 rng(6);
    bool same = true;
    for (int t = 0; t < 20; ++t) {
        std::vector<std::vector<double>> p = randomPoints(rng, 150, 4, 15);
        PatientGraph a, b;
        a.build(p, 0.4);
        b.buildBruteForce(p, 0.4);
        if (a.edgeCount() != b.edgeCount()) same = false;
        for (size_t i = 0; same && i < p.size(); ++i) {
            if (a.neighbors(i).size() != b.neighbors(i).size()) same = false;
            for (size_t j = 0; same && j < a.neighbors(i).size(); ++j) {
                if (a.neighbors(i)[j].to != b.neighbors(i)[j].to) same = false;
            }
        }
    }
    CHECK(same);
}

void testStackAndUndo() {
    Stack<int> s;
    for (int i = 0; i < 5; ++i) s.push(i);
    CHECK(s.size() == 5 && s.top() == 4);
    s.dropBottom();
    CHECK(s.size() == 4);
    CHECK(s.pop() == 4 && s.pop() == 3 && s.pop() == 2 && s.pop() == 1);
    CHECK(s.empty());

    CancerDiagnosisSystem sys;
    CHECK(loadSmall(sys));
    std::vector<std::string> before = idsInOrder(sys);
    std::string error, description;

    // add -> undo
    NewPatientInput input{"X1", "New Person", 44, 1, {NewGene{"G4", 0.0, false}, NewGene{"NEWG", 0.9, true}}};
    std::vector<GeneReport> report;
    CHECK(sys.addPatient(input, report, error) == 200);
    CHECK(sys.getPatientCount() == 31 && sys.findPatient("X1") != nullptr);
    CHECK(sys.addPatient(input, report, error) == 409);
    CHECK(sys.undo(description));
    CHECK(sys.findPatient("X1") == nullptr);
    CHECK(idsInOrder(sys) == before);
    double score = 0.0;
    CHECK(!sys.getGenes().get("NEWG", score)); // the new gene went away with the patient

    // delete -> undo puts the patient back in the same place
    CHECK(sys.deletePatient("P05", error) == 200);
    CHECK(sys.findPatient("P05") == nullptr && sys.getPatientCount() == 29);
    CHECK(sys.deletePatient("P05", error) == 404);
    CHECK(sys.undo(description));
    CHECK(idsInOrder(sys) == before);
    CHECK(sys.findPatient("P05") != nullptr && sys.findPatient("P05")->getDiagnosis() == 1);
    CHECK(!sys.undo(description));
    removeTestFiles();
}

void testFeatures() {
    // Scores 0.2, 0.7, 0.9 (two at or above the 0.7 cutoff), age 40
    std::vector<double> f = FeatureExtractor::fromScores({0.2, 0.7, 0.9}, 40);
    CHECK(f.size() == 4);
    CHECK_NEAR(f[FeatureExtractor::AVG_MUTATION], 0.6, 1e-12);
    CHECK_NEAR(f[FeatureExtractor::MAX_MUTATION], 0.9, 1e-12);
    CHECK_NEAR(f[FeatureExtractor::HIGH_RISK_GENES], 2.0, 1e-12);
    CHECK_NEAR(f[FeatureExtractor::AGE], 40.0, 1e-12);

    HashMapper genes;
    genes.put("A", 0.1);
    genes.put("B", 0.3);
    genes.put("C", 0.8);
    Patient p("P1", "Test", 65, 1);
    p.setGeneIds({"A", "B", "C"});
    std::vector<double> e = FeatureExtractor::extract(p, genes);
    CHECK_NEAR(e[0], 0.4, 1e-12);
    CHECK_NEAR(e[1], 0.8, 1e-12);
    CHECK_NEAR(e[2], 1.0, 1e-12);
    CHECK_NEAR(e[3], 65.0, 1e-12);
    CHECK(FeatureExtractor::featureNames().size() == 4);
}

void testLoader() {
    LoadedDataset data;
    std::vector<std::string> problems;
    CHECK(DatasetLoader::parse(smallDataset(), data, problems));
    CHECK(data.patients.size() == 30 && data.genes.size() == 6 && data.labelledCount == 30);

    DatasetContent broken{"Patient_ID,Name,Age,Diagnosis\nP1,Ann,abc,1\nP1,Bob,50,1\nP3,,40,0\nP4,Dee,40,2\n",
                          "Gene_ID,Mutation_Score\nG1,1.5\nG2,x\nG2,0.3\n",
                          "Patient_ID,Gene_ID\nP9,G1\nP3,G7\n"};
    problems.clear();
    LoadedDataset bad;
    CHECK(!DatasetLoader::parse(broken, bad, problems));
    CHECK(contains(problems, "patients.csv line 2: age 'abc' is not a whole number"));
    CHECK(contains(problems, "duplicate Patient_ID 'P1'"));
    CHECK(contains(problems, "diagnosis '2' must be 0, 1 or empty"));
    CHECK(contains(problems, "patients.csv line 4: name is empty"));
    CHECK(contains(problems, "mutation score 1.5 is outside 0 to 1"));
    CHECK(contains(problems, "mutation score 'x' is not a number"));
    CHECK(contains(problems, "duplicate Gene_ID 'G2'"));
    CHECK(contains(problems, "unknown patient 'P9'"));
    CHECK(contains(problems, "unknown gene 'G7'"));

    // A failed load keeps the dataset that was active
    CancerDiagnosisSystem sys;
    CHECK(loadSmall(sys));
    problems.clear();
    CHECK(!sys.loadContent(broken, DatasetFiles{"x.csv", "y.csv", "z.csv"}, "broken", problems));
    CHECK(!problems.empty());
    CHECK(sys.getPatientCount() == 30);
    CHECK(sys.getDatasetName() == "test");
    CHECK(sys.getFiles().patients == TEST_FILES.patients);
    CHECK(sys.areModelsTrained());
    CHECK(sys.findPatient("P00") != nullptr);

    // The problem list is capped
    std::ostringstream many;
    many << "Patient_ID,Name,Age,Diagnosis\n";
    for (int i = 0; i < 200; ++i) many << "Q" << i << ",N,old,1\n";
    problems.clear();
    CHECK(!DatasetLoader::parse(DatasetContent{many.str(), "Gene_ID,Mutation_Score\n", "Patient_ID,Gene_ID\n"}, bad, problems));
    CHECK(problems.size() <= DatasetLoader::MAX_PROBLEMS + 1);
    removeTestFiles();
}

void testPreprocessor() {
    std::mt19937 rng(7);
    std::vector<std::vector<double>> X;
    for (int i = 0; i < 300; ++i) {
        X.push_back({static_cast<double>(rng() % 1000) / 1000.0, static_cast<double>(rng() % 90),
                     static_cast<double>(rng() % 7), 5.0}); // last column is constant
    }
    DataPreprocessor scaler;
    scaler.fit(X);
    std::vector<std::vector<double>> Z = scaler.transform(X);
    for (size_t j = 0; j < 3; ++j) {
        double mean = 0.0, var = 0.0;
        for (const auto& r : Z) mean += r[j];
        mean /= static_cast<double>(Z.size());
        for (const auto& r : Z) var += (r[j] - mean) * (r[j] - mean);
        var /= static_cast<double>(Z.size());
        CHECK_NEAR(mean, 0.0, 1e-9);
        CHECK_NEAR(std::sqrt(var), 1.0, 1e-9);
    }
    CHECK_NEAR(Z[0][3], 0.0, 1e-12); // constant feature: std treated as 1, value becomes 0
    bool restored = true;
    for (size_t i = 0; i < X.size(); ++i) {
        std::vector<double> back = scaler.inverseTransform(Z[i]);
        for (size_t j = 0; j < 4; ++j) {
            if (!near(back[j], X[i][j], 1e-9)) restored = false;
        }
    }
    CHECK(restored);
}

int main() {
    struct Test {
        const char* name;
        void (*fn)();
    };
    const Test tests[] = {
        {"merge sort", testMergeSort},     {"binary heap", testHeap},       {"AVL tree", testAVL},
        {"KD-tree", testKDTree},           {"split search", testSplit},     {"hash table", testHashTable},
        {"graph + BFS", testGraph},        {"stack + undo", testStackAndUndo}, {"feature extraction", testFeatures},
        {"dataset loader", testLoader},    {"preprocessor", testPreprocessor},
    };
    for (const Test& t : tests) {
        currentTest = t.name;
        int failedBefore = checksFailed;
        try {
            t.fn();
        } catch (const std::exception& e) {
            checksFailed++;
            std::cerr << "FAIL [" << t.name << "] exception: " << e.what() << "\n";
        }
        std::cout << (checksFailed == failedBefore ? "PASS " : "FAIL ") << t.name << "\n";
    }
    std::cout << checksRun << " checks, " << checksFailed << " failed\n";
    return checksFailed == 0 ? 0 : 1;
}

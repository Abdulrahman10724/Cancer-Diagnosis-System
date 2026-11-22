#ifndef BENCHMARK_H
#define BENCHMARK_H

#include <cstddef>
#include <string>
#include <vector>

struct BenchmarkVariant {
    std::string name;
    long long steps;   // operations counted by the variant (see BenchmarkTask::stepsMean)
    double micros;     // best of RUNS wall-clock times, steady_clock
};

struct BenchmarkTask {
    std::string task;
    std::string stepsMean;  // what one step is for this task
    size_t queries;         // lookups or searches per run (0 = one whole job)
    bool sameAnswer;        // every variant produced the same result
    std::vector<BenchmarkVariant> variants;
};

struct BenchmarkResult {
    size_t n;
    unsigned seed;
    int runs;
    std::vector<BenchmarkTask> tasks;
};

/**
 * @class Benchmark
 * @brief Times the hand-written structures against simpler alternatives on
 *        synthetic patients built in memory (the loaded dataset is not touched)
 *
 * Tasks (n synthetic patients, 4 features each):
 *   Find patient by ID         200 random IDs: linked list O(n) vs AVL O(log n) vs hash table O(1) average
 *   Find 5 nearest neighbours  100 queries: brute force + full merge sort O(n log n) vs
 *                              brute force + size-K heap O(n log K) vs KD-tree O(log n) average
 *   Train decision tree        naive split search O(n^2) per node vs merge sort + prefix sums O(n log n)
 *   Order triage queue         repeated selection scan O(n^2) vs binary heap O(n log n)
 * Each variant runs RUNS times; the fastest time is reported.
 */
class Benchmark {
public:
    static const size_t MAX_N = 20000;
    static const size_t MIN_N = 10;
    static const int RUNS = 3;

    static BenchmarkResult run(size_t n, unsigned seed);
};

#endif // BENCHMARK_H

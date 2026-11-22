#ifndef SAMPLING_H
#define SAMPLING_H

#include <random>
#include <vector>

/**
 * @class Sampling
 * @brief Shuffling and stratified splits for evaluation (fixed seed, reproducible)
 *
 * shuffle: Fisher-Yates, O(n). stratifiedSplit / stratifiedFolds: O(n).
 * Index lists are returned in ascending order (marked with a flag array,
 * then collected in index order, so no sort is needed).
 */
class Sampling {
public:
    static void shuffle(std::vector<size_t>& items, std::mt19937& rng);

    // Each class is shuffled separately; testRatio of each class goes to test
    static void stratifiedSplit(const std::vector<int>& labels, double testRatio, unsigned seed,
                                std::vector<size_t>& train, std::vector<size_t>& test);

    // k folds; fold[f] holds the test indices of fold f. Classes are dealt round-robin
    static std::vector<std::vector<size_t>> stratifiedFolds(const std::vector<int>& labels, int k, unsigned seed);
};

#endif // SAMPLING_H

#include "../headers/Sampling.h"
#include <cmath>

void Sampling::shuffle(std::vector<size_t>& items, std::mt19937& rng) {
    // Fisher-Yates: swap each position with a random earlier (or same) position.
    // mt19937 output is fixed by the C++ standard, so results match on every compiler.
    for (size_t i = items.size(); i > 1; --i) {
        size_t j = static_cast<size_t>(rng() % i);
        size_t tmp = items[i - 1];
        items[i - 1] = items[j];
        items[j] = tmp;
    }
}

void Sampling::stratifiedSplit(const std::vector<int>& labels, double testRatio, unsigned seed,
                               std::vector<size_t>& train, std::vector<size_t>& test) {
    std::mt19937 rng(seed);
    std::vector<size_t> byClass[2];
    for (size_t i = 0; i < labels.size(); ++i) byClass[labels[i] == 1 ? 1 : 0].push_back(i);

    std::vector<char> isTest(labels.size(), 0);
    for (int c = 0; c < 2; ++c) {
        shuffle(byClass[c], rng);
        size_t nTest = static_cast<size_t>(std::round(byClass[c].size() * testRatio));
        if (nTest == 0 && byClass[c].size() >= 2) nTest = 1;
        for (size_t i = 0; i < nTest && i < byClass[c].size(); ++i) isTest[byClass[c][i]] = 1;
    }
    train.clear();
    test.clear();
    for (size_t i = 0; i < labels.size(); ++i) {
        if (isTest[i]) test.push_back(i);
        else train.push_back(i);
    }
}

std::vector<std::vector<size_t>> Sampling::stratifiedFolds(const std::vector<int>& labels, int k, unsigned seed) {
    std::mt19937 rng(seed);
    std::vector<size_t> byClass[2];
    for (size_t i = 0; i < labels.size(); ++i) byClass[labels[i] == 1 ? 1 : 0].push_back(i);

    std::vector<int> foldOf(labels.size(), 0);
    size_t next = 0;
    for (int c = 0; c < 2; ++c) {
        shuffle(byClass[c], rng);
        for (size_t i = 0; i < byClass[c].size(); ++i) {
            foldOf[byClass[c][i]] = static_cast<int>(next % static_cast<size_t>(k));
            next++;
        }
    }
    std::vector<std::vector<size_t>> folds(static_cast<size_t>(k));
    for (size_t i = 0; i < labels.size(); ++i) folds[static_cast<size_t>(foldOf[i])].push_back(i);
    return folds;
}

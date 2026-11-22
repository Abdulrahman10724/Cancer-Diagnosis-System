#ifndef SORTING_H
#define SORTING_H

#include <cstddef>
#include <vector>

/**
 * @file Sorting.h
 * @brief Hand-written stable merge sort
 *
 * mergeSortBy sorts any vector with a "less" comparator. It is stable: equal
 * elements keep their original order. Complexity O(n log n) time, O(n) extra
 * memory. The optional counter adds the number of comparisons made.
 *
 * Used by: the KD-tree (median per level), the decision tree split search
 * (rows ordered by each feature), the ROC curve (predictions ordered by risk),
 * KNN brute-force mode and the benchmark.
 */
namespace Sorting {

template <typename T, typename Less>
void mergeRange(std::vector<T>& a, std::vector<T>& buf, size_t lo, size_t mid, size_t hi,
                Less& less, long long* comparisons) {
    size_t i = lo;
    size_t j = mid;
    size_t k = lo;
    while (i < mid && j < hi) {
        if (comparisons) (*comparisons)++;
        // Take from the right only when strictly smaller: keeps the sort stable
        if (less(a[j], a[i])) buf[k++] = a[j++];
        else buf[k++] = a[i++];
    }
    while (i < mid) buf[k++] = a[i++];
    while (j < hi) buf[k++] = a[j++];
    for (size_t t = lo; t < hi; ++t) a[t] = buf[t];
}

template <typename T, typename Less>
void mergeSortRange(std::vector<T>& a, std::vector<T>& buf, size_t lo, size_t hi,
                    Less& less, long long* comparisons) {
    if (hi - lo < 2) return;
    size_t mid = lo + (hi - lo) / 2;
    mergeSortRange(a, buf, lo, mid, less, comparisons);
    mergeSortRange(a, buf, mid, hi, less, comparisons);
    mergeRange(a, buf, lo, mid, hi, less, comparisons);
}

template <typename T, typename Less>
void mergeSortBy(std::vector<T>& a, Less less, long long* comparisons = nullptr) {
    if (a.size() < 2) return;
    std::vector<T> buf(a.size());
    mergeSortRange(a, buf, 0, a.size(), less, comparisons);
}

// Sorted copy of values (ascending)
std::vector<double> mergeSort(const std::vector<double>& values, long long* comparisons = nullptr);

// Stable argsort: indices that put values in ascending order (equal values keep index order)
std::vector<size_t> argsortMergeSort(const std::vector<double>& values, long long* comparisons = nullptr);

} // namespace Sorting

#endif // SORTING_H

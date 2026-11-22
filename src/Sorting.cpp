#include "../headers/Sorting.h"

namespace Sorting {

std::vector<double> mergeSort(const std::vector<double>& values, long long* comparisons) {
    std::vector<double> out = values;
    mergeSortBy(out, [](double a, double b) { return a < b; }, comparisons);
    return out;
}

std::vector<size_t> argsortMergeSort(const std::vector<double>& values, long long* comparisons) {
    std::vector<size_t> idx(values.size());
    for (size_t i = 0; i < idx.size(); ++i) idx[i] = i;
    // Stable sort on the value alone keeps equal values in index order
    mergeSortBy(idx, [&values](size_t a, size_t b) { return values[a] < values[b]; }, comparisons);
    return idx;
}

} // namespace Sorting

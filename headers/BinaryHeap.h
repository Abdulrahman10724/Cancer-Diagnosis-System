#ifndef BINARY_HEAP_H
#define BINARY_HEAP_H

#include <stdexcept>
#include <vector>

/**
 * @class BinaryHeap
 * @brief Array-based binary heap; Higher(a, b) is true when a belongs above b
 *
 * Children of index i are 2i+1 and 2i+2; the parent is (i-1)/2.
 * With Higher = "greater" it is a max-heap, with "less" a min-heap.
 * Complexity: push O(log n), pop O(log n), top O(1), size/empty O(1),
 * toArray O(1) (returns the internal array in heap order, for visualization).
 * Used for KNN top-K (max-heap of the K best distances) and the triage queue
 * (max-heap of patients by risk).
 */
template <typename T, typename Higher>
class BinaryHeap {
private:
    std::vector<T> data;
    Higher higher;

    void siftUp(size_t i) {
        while (i > 0) {
            size_t parent = (i - 1) / 2;
            if (!higher(data[i], data[parent])) break;
            T tmp = data[i];
            data[i] = data[parent];
            data[parent] = tmp;
            i = parent;
        }
    }

    void siftDown(size_t i) {
        size_t n = data.size();
        while (true) {
            size_t left = 2 * i + 1;
            size_t right = left + 1;
            size_t best = i;
            if (left < n && higher(data[left], data[best])) best = left;
            if (right < n && higher(data[right], data[best])) best = right;
            if (best == i) break;
            T tmp = data[i];
            data[i] = data[best];
            data[best] = tmp;
            i = best;
        }
    }

public:
    explicit BinaryHeap(Higher h = Higher()) : higher(h) {}

    void push(const T& value) {
        data.push_back(value);
        siftUp(data.size() - 1);
    }

    T pop() {
        if (data.empty()) throw std::runtime_error("Heap is empty");
        T topValue = data[0];
        data[0] = data.back();
        data.pop_back();
        if (!data.empty()) siftDown(0);
        return topValue;
    }

    const T& top() const {
        if (data.empty()) throw std::runtime_error("Heap is empty");
        return data[0];
    }

    size_t size() const { return data.size(); }
    bool empty() const { return data.empty(); }
    void clear() { data.clear(); }
    void reserve(size_t n) { data.reserve(n); }
    const std::vector<T>& toArray() const { return data; }
};

#endif // BINARY_HEAP_H

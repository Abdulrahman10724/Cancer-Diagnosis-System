#ifndef LINKED_QUEUE_H
#define LINKED_QUEUE_H

#include <memory>
#include <stdexcept>
#include <vector>

/**
 * @class LinkedQueue
 * @brief First-in, first-out queue on a hand-written singly linked list
 *
 * Keeps a head (front) and a tail (rear) pointer.
 * Complexity: push O(1), pop O(1), front O(1), size O(1), toVector O(n).
 */
template <typename T>
class LinkedQueue {
private:
    struct Node {
        T value;
        std::unique_ptr<Node> next;
        explicit Node(const T& v) : value(v), next(nullptr) {}
    };

    std::unique_ptr<Node> head;
    Node* tail;
    size_t count;

public:
    LinkedQueue() : head(nullptr), tail(nullptr), count(0) {}
    ~LinkedQueue() { clear(); }

    LinkedQueue(const LinkedQueue&) = delete;
    LinkedQueue& operator=(const LinkedQueue&) = delete;

    void push(const T& value) {
        std::unique_ptr<Node> node(new Node(value));
        Node* raw = node.get();
        if (tail) {
            tail->next = std::move(node);
        } else {
            head = std::move(node);
        }
        tail = raw;
        count++;
    }

    T pop() {
        if (!head) throw std::runtime_error("Queue is empty");
        T value = head->value;
        head = std::move(head->next);
        if (!head) tail = nullptr;
        count--;
        return value;
    }

    const T& front() const {
        if (!head) throw std::runtime_error("Queue is empty");
        return head->value;
    }

    bool empty() const { return count == 0; }
    size_t size() const { return count; }

    void clear() {
        // Unlink iteratively so a long queue cannot overflow the stack
        while (head) head = std::move(head->next);
        tail = nullptr;
        count = 0;
    }

    // Remove every element equal to value (used when a patient is deleted); O(n)
    void removeAll(const T& value) {
        std::unique_ptr<Node>* slot = &head;
        Node* last = nullptr;
        while (*slot) {
            if ((*slot)->value == value) {
                *slot = std::move((*slot)->next);
                count--;
            } else {
                last = slot->get();
                slot = &(*slot)->next;
            }
        }
        tail = last;
    }

    std::vector<T> toVector() const {
        std::vector<T> out;
        out.reserve(count);
        for (Node* n = head.get(); n; n = n->next.get()) out.push_back(n->value);
        return out;
    }
};

#endif // LINKED_QUEUE_H

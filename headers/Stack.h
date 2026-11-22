#ifndef STACK_H
#define STACK_H

#include <memory>
#include <stdexcept>

/**
 * @class Stack
 * @brief Last-in, first-out stack on a hand-written singly linked list
 *
 * Complexity: push O(1), pop O(1), top O(1), size O(1).
 * dropBottom removes the oldest element in O(n); it keeps the undo history
 * capped (n <= 50).
 */
template <typename T>
class Stack {
private:
    struct Node {
        T value;
        std::unique_ptr<Node> next;
        explicit Node(const T& v) : value(v), next(nullptr) {}
    };

    std::unique_ptr<Node> head; // top of the stack
    size_t count;

public:
    Stack() : head(nullptr), count(0) {}
    ~Stack() { clear(); }

    Stack(const Stack&) = delete;
    Stack& operator=(const Stack&) = delete;

    void push(const T& value) {
        std::unique_ptr<Node> node(new Node(value));
        node->next = std::move(head);
        head = std::move(node);
        count++;
    }

    T pop() {
        if (!head) throw std::runtime_error("Stack is empty");
        T value = head->value;
        head = std::move(head->next);
        count--;
        return value;
    }

    const T& top() const {
        if (!head) throw std::runtime_error("Stack is empty");
        return head->value;
    }

    // Remove the oldest (bottom) element
    void dropBottom() {
        if (!head) return;
        if (!head->next) {
            head.reset();
            count = 0;
            return;
        }
        Node* n = head.get();
        while (n->next->next) n = n->next.get();
        n->next.reset();
        count--;
    }

    bool empty() const { return count == 0; }
    size_t size() const { return count; }

    void clear() {
        while (head) head = std::move(head->next);
        count = 0;
    }
};

#endif // STACK_H

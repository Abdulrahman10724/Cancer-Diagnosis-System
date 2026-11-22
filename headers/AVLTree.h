#ifndef AVL_TREE_H
#define AVL_TREE_H

#include <cstddef>
#include <memory>
#include <utility>
#include <vector>

/**
 * @class AVLTree
 * @brief Self-balancing binary search tree (hand-written, templated on key type)
 *
 * After every insert or erase the heights are updated and any node whose
 * balance factor reaches +/-2 is fixed with an LL, RR, LR or RL rotation,
 * so the height stays O(log n).
 * Complexity: insert O(log n), erase O(log n), find O(log n) (reports the keys
 * visited), rangeQuery O(log n + m) for m results, inOrder O(n).
 */
template <typename Key, typename Value, typename Less>
class AVLTree {
private:
    struct Node {
        Key key;
        Value value;
        int height;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;
        Node(const Key& k, const Value& v) : key(k), value(v), height(1) {}
    };

    std::unique_ptr<Node> root;
    size_t count;
    Less less;

    static int h(const std::unique_ptr<Node>& n) { return n ? n->height : 0; }
    static int balanceOf(const std::unique_ptr<Node>& n) { return n ? h(n->left) - h(n->right) : 0; }
    static void update(std::unique_ptr<Node>& n) {
        int l = h(n->left);
        int r = h(n->right);
        n->height = 1 + (l > r ? l : r);
    }

    /*
     * Right rotation:
     *       n                l
     *      / \              / \
     *     l   c    ==>     a   n
     *    / \                  / \
     *   a   b                b   c
     */
    static void rotateRight(std::unique_ptr<Node>& n) {
        std::unique_ptr<Node> l = std::move(n->left);
        n->left = std::move(l->right);
        update(n);
        l->right = std::move(n);
        n = std::move(l);
        update(n);
    }

    static void rotateLeft(std::unique_ptr<Node>& n) {
        std::unique_ptr<Node> r = std::move(n->right);
        n->right = std::move(r->left);
        update(n);
        r->left = std::move(n);
        n = std::move(r);
        update(n);
    }

    static void rebalance(std::unique_ptr<Node>& n) {
        update(n);
        int b = balanceOf(n);
        if (b > 1) {
            if (balanceOf(n->left) < 0) rotateLeft(n->left); // LR case
            rotateRight(n);                                   // LL case
        } else if (b < -1) {
            if (balanceOf(n->right) > 0) rotateRight(n->right); // RL case
            rotateLeft(n);                                       // RR case
        }
    }

    bool insertAt(std::unique_ptr<Node>& n, const Key& key, const Value& value) {
        if (!n) {
            n.reset(new Node(key, value));
            return true;
        }
        bool added;
        if (less(key, n->key)) added = insertAt(n->left, key, value);
        else if (less(n->key, key)) added = insertAt(n->right, key, value);
        else return false; // duplicate key
        if (added) rebalance(n);
        return added;
    }

    // Detach the smallest node of a subtree
    std::unique_ptr<Node> takeMin(std::unique_ptr<Node>& n) {
        if (!n->left) {
            std::unique_ptr<Node> m = std::move(n);
            n = std::move(m->right);
            return m;
        }
        std::unique_ptr<Node> m = takeMin(n->left);
        rebalance(n);
        return m;
    }

    bool eraseAt(std::unique_ptr<Node>& n, const Key& key) {
        if (!n) return false;
        bool removed;
        if (less(key, n->key)) {
            removed = eraseAt(n->left, key);
        } else if (less(n->key, key)) {
            removed = eraseAt(n->right, key);
        } else {
            if (!n->left) {
                n = std::move(n->right);
            } else if (!n->right) {
                n = std::move(n->left);
            } else {
                // Two children: replace with the in-order successor
                std::unique_ptr<Node> successor = takeMin(n->right);
                successor->left = std::move(n->left);
                successor->right = std::move(n->right);
                n = std::move(successor);
            }
            removed = true;
        }
        if (n) rebalance(n);
        return removed;
    }

    void inOrderAt(const Node* n, std::vector<std::pair<Key, Value>>& out) const {
        if (!n) return;
        inOrderAt(n->left.get(), out);
        out.push_back(std::make_pair(n->key, n->value));
        inOrderAt(n->right.get(), out);
    }

    void rangeAt(const Node* n, const Key& lo, const Key& hi, std::vector<std::pair<Key, Value>>& out,
                 int& visited) const {
        if (!n) return;
        visited++;
        if (less(lo, n->key)) rangeAt(n->left.get(), lo, hi, out, visited);      // smaller keys may be in range
        if (!less(n->key, lo) && !less(hi, n->key)) out.push_back(std::make_pair(n->key, n->value));
        if (less(n->key, hi)) rangeAt(n->right.get(), lo, hi, out, visited);     // larger keys may be in range
    }

    bool checkAt(const Node* n, int& height) const {
        if (!n) {
            height = 0;
            return true;
        }
        int lh = 0;
        int rh = 0;
        if (!checkAt(n->left.get(), lh) || !checkAt(n->right.get(), rh)) return false;
        if (n->left && !less(n->left->key, n->key)) return false;
        if (n->right && !less(n->key, n->right->key)) return false;
        int diff = lh - rh;
        height = 1 + (lh > rh ? lh : rh);
        return diff >= -1 && diff <= 1 && height == n->height;
    }

    void clearAt(std::unique_ptr<Node>& n) {
        if (!n) return;
        clearAt(n->left);
        clearAt(n->right);
        n.reset();
    }

public:
    explicit AVLTree(Less l = Less()) : root(nullptr), count(0), less(l) {}
    ~AVLTree() { clear(); }

    AVLTree(const AVLTree&) = delete;
    AVLTree& operator=(const AVLTree&) = delete;

    bool insert(const Key& key, const Value& value) {
        bool added = insertAt(root, key, value);
        if (added) count++;
        return added;
    }

    bool erase(const Key& key) {
        bool removed = eraseAt(root, key);
        if (removed) count--;
        return removed;
    }

    // Finds key; path receives every key compared on the way down, steps their count
    bool find(const Key& key, Value* out = nullptr, std::vector<Key>* path = nullptr, int* steps = nullptr) const {
        const Node* n = root.get();
        int s = 0;
        while (n) {
            s++;
            if (path) path->push_back(n->key);
            if (less(key, n->key)) n = n->left.get();
            else if (less(n->key, key)) n = n->right.get();
            else {
                if (out) *out = n->value;
                if (steps) *steps += s;
                return true;
            }
        }
        if (steps) *steps += s;
        return false;
    }

    std::vector<std::pair<Key, Value>> inOrder() const {
        std::vector<std::pair<Key, Value>> out;
        out.reserve(count);
        inOrderAt(root.get(), out);
        return out;
    }

    // All entries with lo <= key <= hi, in key order; visited counts nodes examined
    std::vector<std::pair<Key, Value>> rangeQuery(const Key& lo, const Key& hi, int* visited = nullptr) const {
        std::vector<std::pair<Key, Value>> out;
        int v = 0;
        rangeAt(root.get(), lo, hi, out, v);
        if (visited) *visited += v;
        return out;
    }

    int height() const { return h(root); }
    size_t size() const { return count; }
    bool empty() const { return count == 0; }
    void clear() {
        clearAt(root);
        count = 0;
    }

    // True when every node is ordered, balanced (|balance| <= 1) and stores the right height
    bool isValid() const {
        int height = 0;
        return checkAt(root.get(), height);
    }
};

#endif // AVL_TREE_H

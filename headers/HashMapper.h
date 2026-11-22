#ifndef HASH_MAPPER_H
#define HASH_MAPPER_H

#include <memory>
#include <string>
#include <vector>
#include <cstdint>

/**
 * @struct HashNode
 * @brief One entry in a bucket chain (singly linked list written by hand)
 */
struct HashNode {
    std::string key;
    double value;
    std::unique_ptr<HashNode> next;

    HashNode(const std::string& k, double v) : key(k), value(v), next(nullptr) {}
};

/**
 * @class HashMapper
 * @brief Gene ID -> mutation score, stored in a hand-written hash table
 *
 * Separate chaining: a vector of buckets, each bucket the head of a singly
 * linked chain of HashNode. Keys are hashed with a polynomial rolling hash
 * (h = h * 31 + c, unsigned 64-bit) modulo the bucket count. The table starts
 * with 16 buckets and doubles when the load factor goes above 0.75.
 *
 * Complexity (n keys, m buckets, load factor a = n/m <= 0.75):
 *   put / get / contains / erase : O(1) average, O(n) worst case (all keys in one chain)
 *   rehash                       : O(n), amortised O(1) per insert
 *   keys / display               : O(n + m)
 */
class HashMapper {
private:
    std::vector<std::unique_ptr<HashNode>> buckets;
    size_t itemCount;
    std::string labelToCategory[2]; // index = class label (0 or 1)

    static const size_t INITIAL_BUCKETS = 16;
    static constexpr double MAX_LOAD_FACTOR = 0.75;

    size_t bucketIndex(const std::string& key) const;
    void rehash(size_t newBucketCount);
    void copyFrom(const HashMapper& other);

public:
    HashMapper();
    HashMapper(const HashMapper& other);
    HashMapper& operator=(const HashMapper& other);
    HashMapper(HashMapper&& other) noexcept = default;
    HashMapper& operator=(HashMapper&& other) noexcept = default;

    // Gene ID -> mutation score
    // put returns true when the key is new, false when an existing value was replaced
    bool put(const std::string& key, double value);
    // get returns false when the key is missing; steps counts chain nodes visited
    bool get(const std::string& key, double& out, int* steps = nullptr) const;
    bool erase(const std::string& key);
    void clear();

    // Older names kept for existing callers
    void addMutationMapping(const std::string& mutation, double riskScore);
    double getRiskScore(const std::string& mutation) const;
    bool hasMutation(const std::string& mutation) const;

    // Label (0/1) -> category name
    void setLabelCategory(int label, const std::string& category);
    std::string getCategory(int label) const;

    // Bulk operations
    void buildMutationMap(const std::vector<std::string>& mutations,
                         const std::vector<double>& riskScores);

    // Utility
    void displayMappings() const;
    size_t size() const;
    std::vector<std::string> keys() const;

    // Read-only accessors (used by the /hashmap visualizer)
    static uint64_t hashKey(const std::string& key);
    size_t bucketCount() const;
    double loadFactor() const;
    const HashNode* bucketHead(size_t index) const;
};

#endif // HASH_MAPPER_H

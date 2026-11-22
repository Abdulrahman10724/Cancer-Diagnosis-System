#ifndef HASH_MAPPER_H
#define HASH_MAPPER_H

#include <map>
#include <list>
#include <string>
#include <vector>
#include <utility>
#include <cstdint>

/**
 * @class HashMapper
 * @brief Maps genetic mutation IDs to risk scores using a hash table
 *
 * The mutation table is a separate-chaining hash table implemented here:
 * a vector of buckets, each bucket a linked list of (key, value) pairs.
 * Keys are hashed with a polynomial rolling hash (h = h * 31 + c) and the
 * table doubles its bucket count when the load factor goes above 0.75.
 */
class HashMapper {
private:
    std::vector<std::list<std::pair<std::string, double>>> buckets;
    size_t itemCount;
    std::map<int, std::string> labelToCategoryMap;
    
    static const size_t INITIAL_BUCKETS = 16;
    static constexpr double MAX_LOAD_FACTOR = 0.75;
    
    size_t bucketIndex(const std::string& key) const;
    void rehash(size_t newBucketCount);
    
public:
    HashMapper();
    
    // Mutation mapping
    void addMutationMapping(const std::string& mutation, double riskScore);
    double getRiskScore(const std::string& mutation) const;
    bool hasMutation(const std::string& mutation) const;
    
    // Label mapping
    void setLabelCategory(int label, const std::string& category);
    std::string getCategory(int label) const;
    
    // Bulk operations
    void buildMutationMap(const std::vector<std::string>& mutations, 
                         const std::vector<double>& riskScores);
    
    // Utility
    void displayMappings() const;
    size_t size() const;
    
    // Read-only accessors (used by the /hashmap visualizer)
    static uint64_t hashKey(const std::string& key);
    size_t bucketCount() const;
    double loadFactor() const;
    const std::list<std::pair<std::string, double>>& bucketAt(size_t index) const;
};

#endif // HASH_MAPPER_H

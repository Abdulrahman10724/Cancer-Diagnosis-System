#include "../headers/HashMapper.h"
#include <iostream>
#include <iomanip>
#include <stdexcept>

HashMapper::HashMapper() : buckets(INITIAL_BUCKETS), itemCount(0) {
    // Initialize default label mappings
    labelToCategoryMap[0] = "Non-Cancerous";
    labelToCategoryMap[1] = "Cancerous";
}

uint64_t HashMapper::hashKey(const std::string& key) {
    // Polynomial rolling hash; unsigned 64-bit arithmetic wraps on overflow
    uint64_t h = 0;
    for (unsigned char c : key) {
        h = h * 31 + c;
    }
    return h;
}

size_t HashMapper::bucketIndex(const std::string& key) const {
    return static_cast<size_t>(hashKey(key) % buckets.size());
}

void HashMapper::rehash(size_t newBucketCount) {
    std::vector<std::list<std::pair<std::string, double>>> newBuckets(newBucketCount);
    for (const auto& bucket : buckets) {
        for (const auto& item : bucket) {
            newBuckets[hashKey(item.first) % newBucketCount].push_back(item);
        }
    }
    buckets.swap(newBuckets);
}

void HashMapper::addMutationMapping(const std::string& mutation, double riskScore) {
    // Update the value if the key already exists (same behaviour as map[key] = value)
    auto& bucket = buckets[bucketIndex(mutation)];
    for (auto& item : bucket) {
        if (item.first == mutation) {
            item.second = riskScore;
            return;
        }
    }
    
    bucket.push_back({mutation, riskScore});
    itemCount++;
    
    if (loadFactor() > MAX_LOAD_FACTOR) {
        rehash(buckets.size() * 2);
    }
}

double HashMapper::getRiskScore(const std::string& mutation) const {
    for (const auto& item : buckets[bucketIndex(mutation)]) {
        if (item.first == mutation) {
            return item.second;
        }
    }
    return 0.0; // Default risk score if mutation not found
}

bool HashMapper::hasMutation(const std::string& mutation) const {
    for (const auto& item : buckets[bucketIndex(mutation)]) {
        if (item.first == mutation) {
            return true;
        }
    }
    return false;
}

void HashMapper::setLabelCategory(int label, const std::string& category) {
    labelToCategoryMap[label] = category;
}

std::string HashMapper::getCategory(int label) const {
    auto it = labelToCategoryMap.find(label);
    if (it != labelToCategoryMap.end()) {
        return it->second;
    }
    return "Unknown";
}

void HashMapper::buildMutationMap(const std::vector<std::string>& mutations, 
                                  const std::vector<double>& riskScores) {
    if (mutations.size() != riskScores.size()) {
        throw std::runtime_error("Mutations and risk scores must have the same size");
    }
    
    for (size_t i = 0; i < mutations.size(); ++i) {
        addMutationMapping(mutations[i], riskScores[i]);
    }
}

void HashMapper::displayMappings() const {
    std::cout << "\n=== Mutation to Risk Mappings ===" << std::endl;
    for (const auto& bucket : buckets) {
        for (const auto& pair : bucket) {
            std::cout << "Mutation: " << std::setw(15) << pair.first 
                      << " -> Risk Score: " << std::fixed << std::setprecision(4) << pair.second << std::endl;
        }
    }
    std::cout << "\n=== Label to Category Mappings ===" << std::endl;
    for (const auto& pair : labelToCategoryMap) {
        std::cout << "Label: " << pair.first << " -> Category: " << pair.second << std::endl;
    }
    std::cout << "==================================\n" << std::endl;
}

size_t HashMapper::size() const {
    return itemCount;
}

size_t HashMapper::bucketCount() const {
    return buckets.size();
}

double HashMapper::loadFactor() const {
    return static_cast<double>(itemCount) / buckets.size();
}

const std::list<std::pair<std::string, double>>& HashMapper::bucketAt(size_t index) const {
    return buckets.at(index);
}

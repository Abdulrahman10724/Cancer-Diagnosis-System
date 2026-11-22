#include "../headers/HashMapper.h"
#include <iostream>
#include <iomanip>
#include <stdexcept>

HashMapper::HashMapper() : buckets(INITIAL_BUCKETS), itemCount(0) {
    labelToCategory[0] = "Non-Cancerous";
    labelToCategory[1] = "Cancerous";
}

HashMapper::HashMapper(const HashMapper& other) : itemCount(0) {
    copyFrom(other);
}

HashMapper& HashMapper::operator=(const HashMapper& other) {
    if (this != &other) {
        copyFrom(other);
    }
    return *this;
}

void HashMapper::copyFrom(const HashMapper& other) {
    // Deep copy: same bucket count and the same chain order in every bucket
    buckets.clear();
    buckets.resize(other.buckets.size());
    for (size_t i = 0; i < other.buckets.size(); ++i) {
        std::unique_ptr<HashNode>* tail = &buckets[i];
        for (const HashNode* node = other.buckets[i].get(); node; node = node->next.get()) {
            *tail = std::unique_ptr<HashNode>(new HashNode(node->key, node->value));
            tail = &(*tail)->next;
        }
    }
    itemCount = other.itemCount;
    labelToCategory[0] = other.labelToCategory[0];
    labelToCategory[1] = other.labelToCategory[1];
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
    std::vector<std::unique_ptr<HashNode>> newBuckets(newBucketCount);
    for (auto& head : buckets) {
        // Move every node to the tail of its new chain (keeps relative order)
        std::unique_ptr<HashNode> node = std::move(head);
        while (node) {
            std::unique_ptr<HashNode> rest = std::move(node->next);
            size_t idx = static_cast<size_t>(hashKey(node->key) % newBucketCount);
            std::unique_ptr<HashNode>* tail = &newBuckets[idx];
            while (*tail) tail = &(*tail)->next;
            *tail = std::move(node);
            node = std::move(rest);
        }
    }
    buckets.swap(newBuckets);
}

bool HashMapper::put(const std::string& key, double value) {
    std::unique_ptr<HashNode>* slot = &buckets[bucketIndex(key)];
    while (*slot) {
        if ((*slot)->key == key) {
            (*slot)->value = value;
            return false;
        }
        slot = &(*slot)->next;
    }
    // Append at the end of the chain
    *slot = std::unique_ptr<HashNode>(new HashNode(key, value));
    itemCount++;
    if (loadFactor() > MAX_LOAD_FACTOR) {
        rehash(buckets.size() * 2);
    }
    return true;
}

bool HashMapper::get(const std::string& key, double& out, int* steps) const {
    int visited = 0;
    for (const HashNode* node = buckets[bucketIndex(key)].get(); node; node = node->next.get()) {
        visited++;
        if (node->key == key) {
            if (steps) *steps += visited;
            out = node->value;
            return true;
        }
    }
    if (steps) *steps += (visited == 0 ? 1 : visited);
    return false;
}

bool HashMapper::erase(const std::string& key) {
    std::unique_ptr<HashNode>* slot = &buckets[bucketIndex(key)];
    while (*slot) {
        if ((*slot)->key == key) {
            std::unique_ptr<HashNode> removed = std::move(*slot);
            *slot = std::move(removed->next);
            itemCount--;
            return true;
        }
        slot = &(*slot)->next;
    }
    return false;
}

void HashMapper::clear() {
    buckets.clear();
    buckets.resize(INITIAL_BUCKETS);
    itemCount = 0;
}

void HashMapper::addMutationMapping(const std::string& mutation, double riskScore) {
    put(mutation, riskScore);
}

double HashMapper::getRiskScore(const std::string& mutation) const {
    double value = 0.0;
    return get(mutation, value) ? value : 0.0; // 0.0 if the mutation is not found
}

bool HashMapper::hasMutation(const std::string& mutation) const {
    double value = 0.0;
    return get(mutation, value);
}

void HashMapper::setLabelCategory(int label, const std::string& category) {
    if (label == 0 || label == 1) {
        labelToCategory[label] = category;
    }
}

std::string HashMapper::getCategory(int label) const {
    if (label == 0 || label == 1) {
        return labelToCategory[label];
    }
    return "Unknown";
}

void HashMapper::buildMutationMap(const std::vector<std::string>& mutations,
                                  const std::vector<double>& riskScores) {
    if (mutations.size() != riskScores.size()) {
        throw std::runtime_error("Mutations and risk scores must have the same size");
    }
    for (size_t i = 0; i < mutations.size(); ++i) {
        put(mutations[i], riskScores[i]);
    }
}

void HashMapper::displayMappings() const {
    std::cout << "\n=== Mutation to Risk Mappings ===" << std::endl;
    for (const auto& head : buckets) {
        for (const HashNode* node = head.get(); node; node = node->next.get()) {
            std::cout << "Mutation: " << std::setw(15) << node->key
                      << " -> Risk Score: " << std::fixed << std::setprecision(4) << node->value << std::endl;
        }
    }
    std::cout << "\n=== Label to Category Mappings ===" << std::endl;
    for (int label = 0; label < 2; ++label) {
        std::cout << "Label: " << label << " -> Category: " << labelToCategory[label] << std::endl;
    }
    std::cout << "==================================\n" << std::endl;
}

size_t HashMapper::size() const {
    return itemCount;
}

std::vector<std::string> HashMapper::keys() const {
    std::vector<std::string> out;
    out.reserve(itemCount);
    for (const auto& head : buckets) {
        for (const HashNode* node = head.get(); node; node = node->next.get()) {
            out.push_back(node->key);
        }
    }
    return out;
}

size_t HashMapper::bucketCount() const {
    return buckets.size();
}

double HashMapper::loadFactor() const {
    return static_cast<double>(itemCount) / buckets.size();
}

const HashNode* HashMapper::bucketHead(size_t index) const {
    return buckets.at(index).get();
}

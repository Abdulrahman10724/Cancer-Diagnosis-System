#ifndef DATASET_STORE_H
#define DATASET_STORE_H

#include <string>
#include <vector>
#include "DatasetLoader.h"

struct DatasetInfo {
    std::string name;
    bool valid;
    size_t patients;
    size_t labelled;
    size_t genes;
};

/**
 * @class DatasetStore
 * @brief Where datasets live on disk: "default" in data/, uploads in data/uploads/<name>/
 */
class DatasetStore {
public:
    static const char* UPLOAD_ROOT; // "data/uploads"

    // Upload names: 1-40 characters from a-z, 0-9 and '-'
    static bool validName(const std::string& name);
    static DatasetFiles filesFor(const std::string& name);
    static bool exists(const std::string& name);
    static std::vector<std::string> uploadNames();     // folder names in data/uploads
    static bool writeUpload(const std::string& name, const DatasetContent& content, std::string& error);
    static DatasetInfo describe(const std::string& name);
};

#endif // DATASET_STORE_H

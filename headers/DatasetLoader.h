#ifndef DATASET_LOADER_H
#define DATASET_LOADER_H

#include <string>
#include <vector>
#include "Patient.h"
#include "HashMapper.h"

struct DatasetFiles {
    std::string patients;
    std::string genes;
    std::string patientGenes;
};

struct DatasetContent {
    std::string patientsCsv;
    std::string genesCsv;
    std::string patientGenesCsv;
};

struct LoadedDataset {
    std::vector<Patient> patients;       // in file order
    HashMapper genes;                     // Gene_ID -> Mutation_Score
    std::vector<std::string> geneOrder;   // gene IDs in file order (for saving)
    int labelledCount = 0;
    int cancerCount = 0;
};

/**
 * @class DatasetLoader
 * @brief Reads and validates patients.csv, genes.csv and patient_genes.csv
 *
 * Validation is all-or-nothing: every problem is collected (up to MAX_PROBLEMS
 * messages) and the dataset is rejected if there is any. Duplicate IDs and
 * links are found with the hand-written hash table, so validation is
 * O(P + G + L) on average for P patients, G genes and L patient-gene links.
 */
class DatasetLoader {
public:
    static const size_t MAX_PROBLEMS = 50;
    static const int MIN_LABELLED = 10;

    static bool readFile(const std::string& path, std::string& out);
    static bool readFiles(const DatasetFiles& files, DatasetContent& out, std::vector<std::string>& problems);
    // Parse and validate; returns true only when there are no problems
    static bool parse(const DatasetContent& content, LoadedDataset& out, std::vector<std::string>& problems);
};

#endif // DATASET_LOADER_H

#ifndef CANCER_DIAGNOSIS_SYSTEM_H
#define CANCER_DIAGNOSIS_SYSTEM_H

#include <memory>
#include <string>
#include <vector>
#include "Patient.h"
#include "HashMapper.h"
#include "FeatureExtractor.h"
#include "DatasetLoader.h"
#include "ModelSet.h"
#include "EvaluationMetrics.h"
#include "LinkedQueue.h"

/**
 * @struct PatientNode
 * @brief Node of the patient-history linked list (the master list, insertion order)
 */
struct PatientNode {
    Patient patient;
    std::shared_ptr<PatientNode> next;

    explicit PatientNode(const Patient& p) : patient(p), next(nullptr) {}
};

// ---- Diagnosis of one patient by all four models, with explanation data ----
struct LogisticContribution {
    int feature;
    double weight;
    double value;   // scaled value
    double product; // weight * value
};

struct NeighborInfo {
    const Patient* patient;
    double distance; // in the standardized feature space
};

struct TreeStepInfo {
    int feature;
    double threshold;    // scaled
    double thresholdRaw; // raw units
    double value;        // patient's raw value
    bool wentLeft;       // value <= threshold
};

struct Diagnosis {
    std::vector<double> raw;
    std::vector<double> scaled;
    double risk[ModelSet::NUM_MODELS];

    double lrBias;
    double lrZ;
    std::vector<LogisticContribution> lrContributions;

    int k;
    std::vector<NeighborInfo> neighbors;
    int votesCancer;
    int votesSafe;
    long kdNodesVisited;

    std::vector<TreeStepInfo> path;
    int leafSamples;
    double leafPositiveFraction;

    double nbPrior[2];
    double nbMeanRaw[2][FeatureExtractor::NUM_FEATURES];
    double nbStdRaw[2][FeatureExtractor::NUM_FEATURES];

    int cancerVotes;
    double meanRisk;
};

// ---- Evaluation on a held-out split ----
struct EvalSample {
    const Patient* patient;
    int label;
    double risk;
};

struct ModelEvaluation {
    int model;
    double accuracy;
    double precision;
    double recall;
    double f1;
    ConfusionMatrix confusion;
    std::vector<EvalSample> samples;
};

struct EvaluationResult {
    size_t trainCount;
    size_t testCount;
    unsigned seed;
    std::vector<ModelEvaluation> models;
};

// ---- Adding a patient ----
struct NewGene {
    std::string geneId;
    double score;
    bool hasScore;
};

struct NewPatientInput {
    std::string id;
    std::string name;
    int age;
    int diagnosis; // -1 unknown
    std::vector<NewGene> genes;
};

struct GeneReport {
    std::string geneId;
    double usedScore;
    bool existed;       // true: stored score reused
    bool scoreIgnored;  // true: a different score was sent and ignored
    double sentScore;
};

struct QueueResult {
    const Patient* patient;
    double risk;
    int prediction;
};

/**
 * @class CancerDiagnosisSystem
 * @brief Owns the active dataset, the trained models and the data structures
 */
class CancerDiagnosisSystem {
private:
    // Dataset
    std::shared_ptr<PatientNode> head;
    PatientNode* tail;
    size_t patientCount;
    HashMapper genes;                    // Gene_ID -> mutation score
    std::vector<std::string> geneOrder;  // genes in insertion order (for saving)
    std::string datasetName;
    DatasetFiles files;
    bool hasDataset;

    // Models
    ModelSet models;
    std::vector<const Patient*> trainPatients;  // row i of the training matrix
    std::vector<std::vector<double>> Xraw;
    std::vector<int> y;

    // Test queue (FIFO of patient IDs)
    LinkedQueue<std::string> testQueue;

    void install(LoadedDataset& data, const DatasetFiles& f, const std::string& name);
    void appendPatient(const Patient& p);
    void refreshFeatures(Patient& p) const;
    void refreshRisks();
    bool writeFileSafely(const std::string& path, const std::string& content, std::string& error) const;

public:
    CancerDiagnosisSystem();

    // Dataset
    bool loadDataset(const DatasetFiles& f, const std::string& name, std::vector<std::string>& problems);
    bool loadContent(const DatasetContent& content, const DatasetFiles& f, const std::string& name,
                     std::vector<std::string>& problems);
    bool saveDataset(std::string& error) const;
    bool hasData() const;
    const std::string& getDatasetName() const;
    const DatasetFiles& getFiles() const;

    // Training
    void retrain();
    bool areModelsTrained() const;
    const ModelSet& getModels() const;
    size_t getLabelledCount() const;

    // Patients (linked list)
    size_t getPatientCount() const;
    std::vector<const Patient*> patientsInOrder() const;
    const Patient* findPatient(const std::string& id) const;               // linear search
    bool searchPatientTrace(const std::string& id, std::vector<std::string>& visitedOrder) const;
    // status: 200 ok, 400 bad input, 409 duplicate; error set otherwise
    int addPatient(const NewPatientInput& input, std::vector<GeneReport>& report, std::string& error);

    // Genes
    const HashMapper& getGenes() const;
    const std::vector<std::string>& getGeneOrder() const;

    // Diagnosis
    bool diagnose(const Patient& patient, int k, Diagnosis& out) const;
    double modelRisk(const Patient& patient, int model, int k = 0) const;

    // Evaluation (stratified 80/20 split, seed 42)
    bool evaluate(EvaluationResult& out) const;

    // Test queue
    bool enqueue(const std::string& id);
    size_t queueSize() const;
    std::vector<std::string> queuedIds() const;
    std::vector<QueueResult> processQueue(int model);
};

#endif // CANCER_DIAGNOSIS_SYSTEM_H

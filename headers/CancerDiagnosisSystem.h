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
#include "AVLTree.h"
#include "BinaryHeap.h"
#include "Stack.h"

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
    std::vector<std::pair<double, double>> roc; // (FPR, TPR)
    double auc;
};

struct EvaluationResult {
    size_t trainCount;
    size_t testCount;
    unsigned seed;
    std::vector<ModelEvaluation> models;
};

// ---- K-fold cross-validation ----
struct CrossValidationResult {
    int k;
    unsigned seed;
    // metric index: 0 accuracy, 1 precision, 2 recall, 3 f1
    std::vector<std::vector<double>> folds[ModelSet::NUM_MODELS]; // [model][fold][metric]
    double mean[ModelSet::NUM_MODELS][4];
    double stdDev[ModelSet::NUM_MODELS][4];
    std::vector<size_t> foldSizes;
};

// ---- Feature statistics ----
struct FeatureSummary {
    double mean;
    double stdDev;
    double min;
    double max;
};

struct FeatureStats {
    static const int F = FeatureExtractor::NUM_FEATURES;
    static const int BINS = 10;
    size_t count[2];                 // labelled patients per class
    FeatureSummary overall[F];       // all labelled patients
    FeatureSummary perClass[2][F];   // by diagnosis
    double correlation[F + 1][F + 1]; // Pearson; last row/column is Diagnosis
    double importanceLogistic[F];
    double importanceTree[F];
    double binStart[F];
    double binWidth[F];
    int histogram[2][F][BINS];       // [class][feature][bin]
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

// Key of the risk index: ordered by risk, then by patient ID
struct RiskKey {
    double risk;
    std::string id;
};

struct RiskKeyLess {
    bool operator()(const RiskKey& a, const RiskKey& b) const {
        if (a.risk != b.risk) return a.risk < b.risk;
        return a.id < b.id;
    }
};

struct StringLess {
    bool operator()(const std::string& a, const std::string& b) const { return a < b; }
};

// Triage: highest risk first; equal risk -> earlier arrival first
struct TriageItem {
    double risk;
    long arrival;
    std::string id;
};

struct TriageHigher {
    bool operator()(const TriageItem& a, const TriageItem& b) const {
        if (a.risk != b.risk) return a.risk > b.risk;
        return a.arrival < b.arrival;
    }
};

// One undoable action
struct UndoRecord {
    enum Type { ADD, DELETE } type;
    Patient patient;                     // the patient added or deleted
    size_t position;                     // list position of a deleted patient
    std::vector<std::string> newGenes;   // genes created by an add
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

    // AVL indexes, rebuilt whenever patients or their risks change
    AVLTree<std::string, Patient*, StringLess> idIndex;   // Patient_ID -> patient
    AVLTree<RiskKey, Patient*, RiskKeyLess> riskIndex;    // (risk, Patient_ID) -> patient
    void rebuildIndexes();

    // Triage priority queue (max-heap by consensus risk)
    BinaryHeap<TriageItem, TriageHigher> triage;
    long triageArrivals;
    void rebuildTriage();

    // Undo history (latest action on top), at most MAX_UNDO records
    Stack<UndoRecord> undoStack;
    static const size_t MAX_UNDO = 50;
    void pushUndo(const UndoRecord& record);
    // Linked-list editing helpers
    bool unlinkPatient(const std::string& id, Patient& removed, size_t& position);
    void insertPatientAt(const Patient& p, size_t position);
    void afterChange(bool labelledChanged);

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
    const std::vector<const Patient*>& getTrainPatients() const; // row i of the training matrix

    // Patients (linked list)
    size_t getPatientCount() const;
    std::vector<const Patient*> patientsInOrder() const;
    const Patient* findPatient(const std::string& id) const;               // AVL ID index, O(log n)
    const Patient* findPatientLinear(const std::string& id) const;         // linked list, O(n)
    // AVL lookup with the keys visited on the way down
    bool indexLookup(const std::string& id, std::vector<std::string>& path, int& steps, int& height) const;
    // Patients with lo <= risk <= hi, in risk order (AVL risk index)
    std::vector<const Patient*> riskRange(double lo, double hi, int& visited) const;
    bool searchPatientTrace(const std::string& id, std::vector<std::string>& visitedOrder) const;
    // status: 200 ok, 400 bad input, 409 duplicate; error set otherwise
    int addPatient(const NewPatientInput& input, std::vector<GeneReport>& report, std::string& error);
    // status 200 or 404
    int deletePatient(const std::string& id, std::string& error);
    // Reverts the last add or delete; returns false when there is nothing to undo
    bool undo(std::string& description);
    size_t undoDepth() const;

    // Genes
    const HashMapper& getGenes() const;
    const std::vector<std::string>& getGeneOrder() const;

    // Diagnosis
    bool diagnose(const Patient& patient, int k, Diagnosis& out) const;
    double modelRisk(const Patient& patient, int model, int k = 0) const;

    // Evaluation (stratified 80/20 split, seed 42)
    bool evaluate(EvaluationResult& out) const;
    // Stratified k-fold cross-validation (seed 42)
    bool crossValidate(int k, CrossValidationResult& out) const;
    // Feature statistics, correlation, importance and histograms (labelled patients)
    bool featureStats(FeatureStats& out) const;

    // Test queue
    bool enqueue(const std::string& id);
    size_t queueSize() const;
    std::vector<std::string> queuedIds() const;
    std::vector<QueueResult> processQueue(int model);

    // Triage priority queue
    int triagePush(const std::string& id, std::string& error); // 200, 400, 404 or 409
    std::vector<TriageItem> triageHeapArray() const;          // heap order (index order)
    std::vector<TriageItem> triageSorted() const;             // priority order
    std::vector<QueueResult> triageProcess();                 // pops everything
};

#endif // CANCER_DIAGNOSIS_SYSTEM_H

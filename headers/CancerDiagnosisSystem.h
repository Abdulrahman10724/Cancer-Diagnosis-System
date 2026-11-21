#ifndef CANCER_DIAGNOSIS_SYSTEM_H
#define CANCER_DIAGNOSIS_SYSTEM_H

#include "Patient.h"
#include "GeneticData.h"
#include "DataPreprocessor.h"
#include "HashMapper.h"
#include "DecisionTreeClassifier.h"
#include "LogisticRegressionModel.h"
#include "KNNClassifier.h"
#include "NaiveBayesClassifier.h"
#include "EvaluationMetrics.h"
#include <vector>
#include <queue>
#include <list>
#include <string>
#include <memory>

/**
 * @struct PatientNode
 * @brief Node for linked list storing patient history
 */
struct PatientNode
{
    Patient patient;
    std::shared_ptr<PatientNode> next;
    
    PatientNode(const Patient& p) : patient(p), next(nullptr) {}
};

/**
 * @struct ModelEvaluation
 * @brief Evaluation metrics of one model on held-out test data
 */
struct ModelEvaluation {
    std::string key;
    std::string name;
    double accuracy;
    double precision;
    double recall;
    double f1;
};

/**
 * @class CancerDiagnosisSystem
 * @brief Main controller class for the cancer diagnosis system
 */
class CancerDiagnosisSystem
{
private:
    // Data structures
    std::vector<GeneticData> geneticDataArray;
    std::shared_ptr<PatientNode> patientHistoryHead; // Linked list
    std::queue<Patient> testRequestQueue;            // Queue for test scheduling
    HashMapper mutationMapper;

    // Preprocessing
    DataPreprocessor preprocessor;

    // ML Models
    std::unique_ptr<LogisticRegressionModel> logisticModel;
    std::unique_ptr<KNNClassifier> knnModel;
    std::unique_ptr<DecisionTreeClassifier> decisionTreeModel;
    std::unique_ptr<NaiveBayesClassifier> naiveBayesModel;

    // Evaluation
    EvaluationMetrics evaluator;

    // Training data
    std::vector<std::vector<double>> X_train;
    std::vector<int> y_train;
    bool modelsTrained;

    // Helper functions
    void loadGeneticDataFromFile(const std::string& filename);
    void loadPatientsFromFile(const std::string& filename, const std::string& patientGenesFile);
    void addPatientToHistory(const Patient& patient);
    void updateOrAddPatientInHistory(const Patient& patient);
    void prepareTrainingData();
    void trainAllModels();
    std::vector<double> extractFeatures(const Patient &patient) const;

public:
    enum class ModelType
    {
        LOGISTIC,
        KNN,
        DECISION_TREE,
        NAIVE_BAYES
    };

    enum class ModelType { LOGISTIC, KNN, DECISION_TREE, NAIVE_BAYES };

    CancerDiagnosisSystem();
    ~CancerDiagnosisSystem();

    // Data acquisition
    void loadData(const std::string& genesFile, const std::string& patientsFile,
                  const std::string& patientGenesFile = "data/patient_genes.csv");
    void addPatient(const Patient& patient);
    void addGeneticData(const GeneticData& data);
    // Re-run preprocessing and training on the current genetic data
    void retrainModels();
    
    // Test scheduling
    void scheduleTest(const Patient &patient);
    void processTestQueue();
    // Process test queue and return number processed
    int processTestQueueAndReturnCount();
    // Process test queue with selected model and return diagnosis results
    std::vector<std::string> processTestQueueWithModel(ModelType model);
    // Query queue state
    size_t getQueueSize() const;
    std::vector<std::string> getQueuedPatientIds() const;

    // Diagnosis
    double diagnosePatient(const Patient& patient, ModelType model);
    int predictPatient(const Patient& patient, ModelType model);
    
    // Evaluation
    void evaluateModels(const std::vector<Patient>& testPatients);
    // Train temporary models on a stratified 80/20 hold-out split (fixed seed)
    // and return metrics on the 20% test part. Returns false if no data/models.
    bool evaluateModelsHoldout(std::vector<ModelEvaluation>& results, size_t& testSamples,
                               double testRatio = 0.2, unsigned int seed = 42) const;
    void displayModelMetrics(ModelType model, const std::vector<int>& yTrue, 
                            const std::vector<int>& yPred) const;
    
    // Display
    void displayGeneticData() const;
    void displayPatientHistory() const;
    void displayMutationMappings() const;
    void displayDecisionTree() const;

    // Utility
    size_t getGeneticDataCount() const;
    size_t getPatientCount() const;
    bool areModelsTrained() const;
    bool getPatientById(const std::string &patientId, Patient &outPatient) const;

    // Data export
    std::vector<Patient> getAllPatients() const;
    std::vector<GeneticData> getAllGeneticData() const;
    void saveDataToFiles(const std::string& genesFile, const std::string& patientsFile,
                         const std::string& patientGenesFile = "data/patient_genes.csv") const;
};

#endif // CANCER_DIAGNOSIS_SYSTEM_H

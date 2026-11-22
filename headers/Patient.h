#ifndef PATIENT_H
#define PATIENT_H

#include <string>
#include <vector>

/**
 * @class Patient
 * @brief One patient: identity, known diagnosis (if any), gene IDs and features
 *
 * diagnosis: 1 = cancer, 0 = no cancer, -1 = unknown (never used for training).
 * features holds the raw (unscaled) feature vector from FeatureExtractor.
 */
class Patient {
private:
    std::string patientId;
    std::string name;
    int age;
    int diagnosis;
    std::vector<std::string> geneIds;
    std::vector<double> features;
    double riskScore;   // consensus mean risk of the four models
    int prediction;     // riskScore >= 0.5
    bool hasRisk;

public:
    static const int UNKNOWN = -1;

    Patient();
    Patient(const std::string& id, const std::string& name, int age, int diagnosis = UNKNOWN);

    // Getters
    const std::string& getPatientId() const;
    const std::string& getName() const;
    int getAge() const;
    int getDiagnosis() const;
    bool isLabelled() const;
    const std::vector<std::string>& getGeneIds() const;
    const std::vector<double>& getFeatures() const;
    double getRiskScore() const;
    int getPrediction() const;
    bool getHasRisk() const;

    // Setters
    void setPatientId(const std::string& id);
    void setName(const std::string& name);
    void setAge(int age);
    void setDiagnosis(int diagnosis);
    void setFeatures(const std::vector<double>& values);
    void setRisk(double risk, int prediction);
    void clearRisk();

    // Genes
    void addGeneId(const std::string& geneId);
    void setGeneIds(const std::vector<std::string>& ids);

    // Utility
    void display() const;
};

#endif // PATIENT_H

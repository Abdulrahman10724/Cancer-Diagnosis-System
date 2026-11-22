#include "../headers/Patient.h"
#include <iostream>
#include <iomanip>

Patient::Patient()
    : age(0), diagnosis(UNKNOWN), riskScore(0.0), prediction(0), hasRisk(false) {}

Patient::Patient(const std::string& id, const std::string& name, int age, int diagnosis)
    : patientId(id), name(name), age(age), diagnosis(diagnosis),
      riskScore(0.0), prediction(0), hasRisk(false) {}

const std::string& Patient::getPatientId() const { return patientId; }
const std::string& Patient::getName() const { return name; }
int Patient::getAge() const { return age; }
int Patient::getDiagnosis() const { return diagnosis; }
bool Patient::isLabelled() const { return diagnosis == 0 || diagnosis == 1; }
const std::vector<std::string>& Patient::getGeneIds() const { return geneIds; }
const std::vector<double>& Patient::getFeatures() const { return features; }
double Patient::getRiskScore() const { return riskScore; }
int Patient::getPrediction() const { return prediction; }
bool Patient::getHasRisk() const { return hasRisk; }

void Patient::setPatientId(const std::string& id) { patientId = id; }
void Patient::setName(const std::string& n) { name = n; }
void Patient::setAge(int a) { age = a; }
void Patient::setDiagnosis(int d) { diagnosis = (d == 0 || d == 1) ? d : UNKNOWN; }
void Patient::setFeatures(const std::vector<double>& values) { features = values; }

void Patient::setRisk(double risk, int pred) {
    riskScore = risk;
    prediction = pred;
    hasRisk = true;
}

void Patient::clearRisk() {
    riskScore = 0.0;
    prediction = 0;
    hasRisk = false;
}

void Patient::addGeneId(const std::string& geneId) { geneIds.push_back(geneId); }
void Patient::setGeneIds(const std::vector<std::string>& ids) { geneIds = ids; }

void Patient::display() const {
    std::cout << "Patient ID: " << patientId << "\n"
              << "Name: " << name << "\n"
              << "Age: " << age << "\n"
              << "Diagnosis: " << (diagnosis == UNKNOWN ? std::string("unknown") : std::to_string(diagnosis)) << "\n"
              << "Genes: " << geneIds.size() << "\n";
    if (hasRisk) {
        std::cout << "Risk Score: " << std::fixed << std::setprecision(4) << riskScore << "\n";
    }
}

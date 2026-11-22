#include "../headers/CancerDiagnosisSystem.h"
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <fstream>
#include <mutex>
#include <iomanip>

// NOTE: This server uses the single-header cpp-httplib library.
// Download it from: https://github.com/yhirose/cpp-httplib (place httplib.h in a folder named third_party)
#include "../third_party/httplib.h"

using namespace std;

// Forward declare serverMain (defined below after all handlers)
int serverMain();

// Helper: escape JSON string
static string json_escape(const string &s) {
    string out;
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                out.push_back(c);
        }
    }
    return out;
}

// Helper: read a number (quoted or unquoted) after "key": in a naive JSON body
static double extractNumber(const string &body, const string &key, double defaultValue = 0.0) {
    size_t p = body.find("\"" + key + "\"");
    if (p == string::npos) return defaultValue;
    size_t colon = body.find(':', p);
    if (colon == string::npos) return defaultValue;
    size_t numStart = body.find_first_not_of(" \t\r\n\"", colon + 1);
    if (numStart == string::npos) return defaultValue;
    size_t numEnd = body.find_first_of(",}]\" \t\r\n", numStart);
    string numStr = body.substr(numStart, (numEnd == string::npos ? body.size() - numStart : numEnd - numStart));
    try { return stod(numStr); } catch(...) { return defaultValue; }
}

int serverMain() {
    httplib::Server svr;
    CancerDiagnosisSystem system;
    // All handlers share one system object; cpp-httplib runs handlers on a thread pool
    std::mutex systemMutex;

    // Add CORS header to ALL responses (including errors)
    svr.set_post_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        if (!res.has_header("Access-Control-Allow-Origin")) {
            res.set_header("Access-Control-Allow-Origin", "*");
        }
    });

    // CORS preflight for every route
    svr.Options(R"(.*)", [&](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_content("", "text/plain");
    });

    svr.Get("/status", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::ostringstream ss;
        ss << "{\"modelsTrained\":" << (system.areModelsTrained() ? "true" : "false")
           << ",\"geneticCount\":" << system.getGeneticDataCount()
           << ",\"patientCount\":" << system.getPatientCount() << "}";
        res.set_content(ss.str(), "application/json");
    });


    // POST /load {"genesFile":"data/genes.csv","patientsFile":"data/patients.csv"}
    svr.Post("/load", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string body = req.body;
        // naive JSON parsing (just extract values)
        auto extract = [&](const string &key)->string {
            size_t p = body.find(key);
            if (p == string::npos) return string();
            size_t colon = body.find(':', p);
            if (colon == string::npos) return string();
            size_t start = body.find_first_of('\"', colon);
            if (start == string::npos) return string();
            start++;
            size_t end = body.find('"', start);
            if (end == string::npos) return string();
            return body.substr(start, end - start);
        };

        string genesFile = extract("genesFile");
        string patientsFile = extract("patientsFile");
        string patientGenesFile = extract("patientGenesFile");
        if (patientGenesFile.empty()) patientGenesFile = "data/patient_genes.csv";

        if (genesFile.empty() || patientsFile.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing genesFile or patientsFile\"}", "application/json");
            return;
        }

        // Load data and train models
        system.loadData(genesFile, patientsFile, patientGenesFile);

        std::ostringstream ss;
        ss << "{\"modelsTrained\":" << (system.areModelsTrained() ? "true" : "false")
           << ",\"geneticCount\":" << system.getGeneticDataCount()
           << ",\"patientCount\":" << system.getPatientCount() << "}";
        res.set_content(ss.str(), "application/json");
    });


    // POST /patients  { "patient_id":"P011","name":"Alice","age":30, "geneticRecords":[{"geneId":"GENE_010","mutationScore":0.45,"label":0}, ...] }
    svr.Post("/patients", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string body = req.body;
        auto extract = [&](const string &key)->string {
            size_t p = body.find(key);
            if (p == string::npos) return string();
            size_t colon = body.find(':', p);
            if (colon == string::npos) return string();
            size_t start = body.find_first_of('"', colon);
            if (start == string::npos) return string();
            start++;
            size_t end = body.find('"', start);
            if (end == string::npos) return string();
            return body.substr(start, end - start);
        };

        // Support a few key name variants
        string pid = extract("patient_id");
        if (pid.empty()) pid = extract("patientId");
        if (pid.empty()) pid = extract("id");
        string name = extract("name");
        int age = static_cast<int>(extractNumber(body, "age", 0.0));

        if (pid.empty() || name.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing patient_id or name\"}", "application/json");
            return;
        }

        // Reject duplicate patient IDs
        Patient existing;
        if (system.getPatientById(pid, existing)) {
            res.status = 409;
            res.set_content("{\"error\":\"Patient ID already exists\"}", "application/json");
            return;
        }

        // Create patient and attach any genetic records found in body
        Patient patient(pid, name, age);

        // Naive scan for gene entries: look for occurrences of "geneId" or "gene_id"
        size_t pos = 0;
        int genesAdded = 0;
        while (true) {
            size_t gpos = body.find("geneId", pos);
            if (gpos == string::npos) gpos = body.find("gene_id", pos);
            if (gpos == string::npos) break;

            // extract gene id
            size_t colon = body.find(':', gpos);
            size_t start = body.find_first_of('"', colon);
            if (start == string::npos) break; start++;
            size_t end = body.find('"', start);
            if (end == string::npos) break;
            string geneId = body.substr(start, end - start);

            // mutationScore (try several variants)
            double mutationScore = 0.0;
            size_t mpos = body.find("mutationScore", end);
            if (mpos == string::npos) mpos = body.find("mutation_score", end);
            if (mpos != string::npos) {
                size_t mcolon = body.find(':', mpos);
                if (mcolon != string::npos) {
                    // read number after colon
                    size_t numStart = body.find_first_not_of(" \t\r\n\"", mcolon+1);
                    if (numStart != string::npos) {
                        size_t numEnd = body.find_first_of(",}]\n\r", numStart);
                        string numStr = body.substr(numStart, (numEnd==string::npos? body.size()-numStart: numEnd-numStart));
                        try { mutationScore = stod(numStr); } catch(...) { mutationScore = 0.0; }
                    }
                }
            }

            int label = 0;
            size_t lpos = body.find("label", end);
            if (lpos != string::npos) {
                size_t lcolon = body.find(':', lpos);
                if (lcolon != string::npos) {
                    size_t numStart = body.find_first_not_of(" \t\r\n\"", lcolon+1);
                    if (numStart != string::npos) {
                        size_t numEnd = body.find_first_of(",}]\n\r", numStart);
                        string numStr = body.substr(numStart, (numEnd==string::npos? body.size()-numStart: numEnd-numStart));
                        try { label = stoi(numStr); } catch(...) { label = 0; }
                    }
                }
            }

            // Create GeneticData and attach to global system and patient
            GeneticData gd(geneId, mutationScore, label);
            system.addGeneticData(gd);
            patient.addGeneticData(gd);
            genesAdded++;

            pos = end + 1;
        }

        // Retrain models so they include the new genetic data
        if (genesAdded > 0) {
            system.retrainModels();
        }

        // Add patient to system history (makes patient immediately available for /diagnose)
        system.addPatient(patient);
        
        // IMPORTANT: Auto-save to CSV files immediately after adding patient
        system.saveDataToFiles("data/genes.csv", "data/patients.csv", "data/patient_genes.csv");

        std::ostringstream ss;
        ss << "{\"success\":true,\"patientCount\":" << system.getPatientCount()
           << ",\"geneticCount\":" << system.getGeneticDataCount() << ",\"message\":\"Patient added and data auto-saved to CSV\"}";
        res.set_content(ss.str(), "application/json");
    });

    svr.Get("/patients", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::ostringstream ss;
        ss << "[";
        bool first = true;
        for (const auto& p : system.getAllPatients()) {
            if (!first) ss << ",";
            ss << "{\"patient_id\":\"" << json_escape(p.getPatientId())
               << "\",\"name\":\"" << json_escape(p.getName())
               << "\",\"age\":" << p.getAge()
               << ",\"riskScore\":" << p.getRiskScore()
               << ",\"prediction\":" << p.getPrediction()
               << ",\"genes\":[";
            bool firstGene = true;
            for (const auto& g : p.getGeneticData()) {
                if (!firstGene) ss << ",";
                firstGene = false;
                ss << "{\"gene_id\":\"" << json_escape(g.getGeneId())
                   << "\",\"mutation_score\":" << g.getMutationScore()
                   << ",\"label\":" << g.getLabel() << "}";
            }
            ss << "]}";
            first = false;
        }
        ss << "]";
        res.set_content(ss.str(), "application/json");
    });

    svr.Get(R"(/genetic)", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::ostringstream ss;
        ss << "[";
        bool first = true;
        for (const auto& g : system.getAllGeneticData()) {
            if (!first) ss << ",";
            ss << "{\"gene_id\":\"" << json_escape(g.getGeneId())
               << "\",\"mutation_score\":" << g.getMutationScore()
               << ",\"label\":" << g.getLabel() << "}";
            first = false;
        }
        ss << "]";
        res.set_content(ss.str(), "application/json");
    });

    // GET /diagnose?patient_id=P001&model=logistic
    // GET /diagnose?patient_id=P001&model=logistic|knn|decision_tree|naive_bayes|all&k=5
    // model=all returns all four models with the numbers behind each prediction.
    // k (optional, odd 1-15) sets the KNN K for this request only.
    svr.Get(R"(/diagnose)", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string pid;
        string modelStr = "logistic";
        if (req.has_param("patient_id")) pid = req.get_param_value("patient_id");
        if (req.has_param("model")) modelStr = req.get_param_value("model");

        if (pid.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing patient_id\"}", "application/json");
            return;
        }

        int k = 0; // 0 = use the trained default
        if (req.has_param("k")) {
            try { k = stoi(req.get_param_value("k")); } catch(...) { k = -1; }
            if (k < 1 || k > 15 || k % 2 == 0) {
                res.status = 400;
                res.set_content("{\"error\":\"k must be an odd number from 1 to 15\"}", "application/json");
                return;
            }
        }

        if (!system.areModelsTrained()) {
            res.status = 400;
            res.set_content("{\"error\":\"Load data first\"}", "application/json");
            return;
        }

        Patient patient;
        if (!system.getPatientById(pid, patient)) {
            res.status = 404;
            std::ostringstream ss; ss << "{\"error\":\"Patient ID '" << json_escape(pid) << "' not found\"}";
            res.set_content(ss.str(), "application/json");
            return;
        }

        if (modelStr == "all") {
            DiagnosisExplanation e;
            system.explainPatient(patient, k, e);
            const double threshold = 0.5;
            auto pred = [&](double r) { return r >= threshold ? 1 : 0; };
            int cancer = pred(e.lrRisk) + pred(e.knnRisk) + pred(e.dtRisk) + pred(e.nbRisk);

            std::ostringstream ss;
            ss << std::setprecision(6);
            ss << "{\"patient_id\":\"" << json_escape(patient.getPatientId()) << "\""
               << ",\"featureRaw\":" << e.featureRaw
               << ",\"featureScaled\":" << e.featureScaled
               << ",\"scale\":{\"mean\":" << e.scaleMean << ",\"std\":" << e.scaleStd << "}"
               << ",\"geneCount\":" << e.geneCount
               << ",\"threshold\":" << threshold
               << ",\"models\":{";
            ss << "\"logistic\":{\"risk\":" << e.lrRisk << ",\"prediction\":" << pred(e.lrRisk)
               << ",\"explain\":{\"weight\":" << e.lrWeight << ",\"bias\":" << e.lrBias
               << ",\"z\":" << e.lrZ << "}}";
            ss << ",\"knn\":{\"risk\":" << e.knnRisk << ",\"prediction\":" << pred(e.knnRisk)
               << ",\"k\":" << e.k << ",\"explain\":{\"neighbors\":[";
            for (size_t i = 0; i < e.neighbors.size(); ++i) {
                const auto& n = e.neighbors[i];
                if (i) ss << ",";
                // mutation_score is RAW (from genes.csv); distance is in the scaled space
                ss << "{\"gene_id\":\"" << json_escape(n.geneId) << "\",\"mutation_score\":" << n.mutationScore
                   << ",\"label\":" << n.label << ",\"distance\":" << n.distance << "}";
            }
            ss << "],\"votesCancer\":" << e.votesCancer << ",\"votesSafe\":" << e.votesSafe << "}}";
            ss << ",\"decision_tree\":{\"risk\":" << e.dtRisk << ",\"prediction\":" << pred(e.dtRisk)
               << ",\"explain\":{\"path\":[";
            for (size_t i = 0; i < e.path.size(); ++i) {
                const auto& st = e.path[i];
                if (i) ss << ",";
                // threshold is on the raw score scale; thresholdScaled is what the tree compares
                ss << "{\"threshold\":" << st.threshold << ",\"thresholdScaled\":" << st.thresholdScaled
                   << ",\"wentLeft\":" << (st.wentLeft ? "true" : "false")
                   << ",\"positiveFraction\":" << st.positiveFraction << ",\"samples\":" << st.samples << "}";
            }
            ss << "],\"leafPositiveFraction\":" << e.leafPositiveFraction
               << ",\"leafSamples\":" << e.leafSamples << "}}";
            ss << ",\"naive_bayes\":{\"risk\":" << e.nbRisk << ",\"prediction\":" << pred(e.nbRisk)
               << ",\"explain\":{\"safe\":{\"mean\":" << e.nbSafeMean << ",\"std\":" << e.nbSafeStd
               << ",\"prior\":" << e.nbSafePrior << "},\"cancer\":{\"mean\":" << e.nbCancerMean
               << ",\"std\":" << e.nbCancerStd << ",\"prior\":" << e.nbCancerPrior << "}}}";
            ss << "},\"consensus\":{\"cancer\":" << cancer << ",\"safe\":" << (4 - cancer) << "}}";
            res.set_content(ss.str(), "application/json");
            return;
        }

        CancerDiagnosisSystem::ModelType model = CancerDiagnosisSystem::ModelType::LOGISTIC;
        if (modelStr == "knn") model = CancerDiagnosisSystem::ModelType::KNN;
        else if (modelStr == "decision_tree") model = CancerDiagnosisSystem::ModelType::DECISION_TREE;
        else if (modelStr == "naive_bayes") model = CancerDiagnosisSystem::ModelType::NAIVE_BAYES;

        double risk = system.diagnosePatient(patient, model);
        if (model == CancerDiagnosisSystem::ModelType::KNN && k > 0) {
            DiagnosisExplanation e;
            system.explainPatient(patient, k, e);
            risk = e.knnRisk;
        }
        int pred = risk >= 0.5 ? 1 : 0;

        std::ostringstream ss;
        ss << "{\"patient_id\":\"" << json_escape(patient.getPatientId()) << "\",\"riskScore\":" << risk << ",\"prediction\":" << pred << "}";
        res.set_content(ss.str(), "application/json");
    });

    // GET /evaluate -> metrics of all models on a held-out 20% test split
    svr.Get("/evaluate", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::vector<ModelEvaluation> results;
        size_t testSamples = 0;
        if (!system.evaluateModelsHoldout(results, testSamples)) {
            res.status = 400;
            res.set_content("{\"error\":\"Load data first\"}", "application/json");
            return;
        }

        std::ostringstream ss;
        ss << std::fixed << std::setprecision(4);
        ss << "{\"testSamples\":" << testSamples << ",\"models\":[";
        for (size_t i = 0; i < results.size(); ++i) {
            if (i) ss << ",";
            ss << "{\"key\":\"" << json_escape(results[i].key)
               << "\",\"name\":\"" << json_escape(results[i].name)
               << "\",\"accuracy\":" << results[i].accuracy
               << ",\"precision\":" << results[i].precision
               << ",\"recall\":" << results[i].recall
               << ",\"f1\":" << results[i].f1
               << ",\"confusion\":{\"tp\":" << results[i].confusion.truePositive
               << ",\"fp\":" << results[i].confusion.falsePositive
               << ",\"tn\":" << results[i].confusion.trueNegative
               << ",\"fn\":" << results[i].confusion.falseNegative << "}"
               << ",\"samples\":[";
            for (size_t j = 0; j < results[i].samples.size(); ++j) {
                const auto& sm = results[i].samples[j];
                if (j) ss << ",";
                ss << "{\"gene_id\":\"" << json_escape(sm.geneId) << "\""
                   << ",\"mutation_score\":" << sm.mutationScore
                   << ",\"label\":" << sm.label
                   << ",\"risk\":" << sm.risk << "}";
            }
            ss << "]}";
        }
        ss << "]}";
        res.set_content(ss.str(), "application/json");
    });

    // GET /patients/search?id=P007 -> linear search of the linked list, with the visit order
    svr.Get("/patients/search", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string pid = req.has_param("id") ? req.get_param_value("id") : string();
        if (pid.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing id\"}", "application/json");
            return;
        }
        std::vector<std::string> order;
        bool found = system.searchPatientTrace(pid, order);
        std::ostringstream ss;
        ss << "{\"found\":" << (found ? "true" : "false")
           << ",\"hops\":" << order.size() << ",\"order\":[";
        for (size_t i = 0; i < order.size(); ++i) {
            if (i) ss << ",";
            ss << "\"" << json_escape(order[i]) << "\"";
        }
        ss << "]}";
        res.set_content(ss.str(), "application/json");
    });

    // GET /hashmap -> buckets of the mutation hash table (separate chaining)
    svr.Get("/hashmap", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        const HashMapper& map = system.getMutationMapper();
        std::ostringstream ss;
        ss << std::setprecision(6);
        ss << "{\"bucketCount\":" << map.bucketCount()
           << ",\"size\":" << map.size()
           << ",\"loadFactor\":" << map.loadFactor()
           << ",\"buckets\":[";
        for (size_t i = 0; i < map.bucketCount(); ++i) {
            if (i) ss << ",";
            ss << "{\"index\":" << i << ",\"items\":[";
            bool first = true;
            for (const auto& item : map.bucketAt(i)) {
                if (!first) ss << ",";
                first = false;
                ss << "{\"key\":\"" << json_escape(item.first) << "\",\"value\":" << item.second
                   << ",\"hash\":" << HashMapper::hashKey(item.first) << "}";
            }
            ss << "]}";
        }
        ss << "]}";
        res.set_content(ss.str(), "application/json");
    });

    // GET /queue -> { queueSize: N, patients: ["P1","P2"] }
    svr.Get("/queue", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::ostringstream ss;
        auto ids = system.getQueuedPatientIds();
        ss << "{";
        ss << "\"queueSize\":" << system.getQueueSize() << ",";
        ss << "\"patients\":[";
        for (size_t i = 0; i < ids.size(); ++i) {
            if (i) ss << ",";
            ss << "\"" << json_escape(ids[i]) << "\"";
        }
        ss << "]}";
        res.set_content(ss.str(), "application/json");
    });


    // POST /queue { "patient_id":"P001" } -> schedule patient for testing
    svr.Post("/queue", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string body = req.body;
        auto extract = [&](const string &key)->string {
            size_t p = body.find(key);
            if (p == string::npos) return string();
            size_t colon = body.find(':', p);
            if (colon == string::npos) return string();
            size_t start = body.find_first_of('"', colon);
            if (start == string::npos) return string();
            start++;
            size_t end = body.find('"', start);
            if (end == string::npos) return string();
            return body.substr(start, end - start);
        };

        string pid = extract("patient_id");
        if (pid.empty()) pid = extract("patientId");
        if (pid.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing patient_id\"}", "application/json");
            return;
        }

        Patient patient;
        if (!system.getPatientById(pid, patient)) {
            res.status = 404;
            std::ostringstream ss; ss << "{\"error\":\"Patient ID '" << json_escape(pid) << "' not found\"}";
            res.set_content(ss.str(), "application/json");
            return;
        }

        system.scheduleTest(patient);

        std::ostringstream ss;
        ss << "{\"success\":true,\"queueSize\":" << system.getQueueSize() << ",\"message\":\"Patient scheduled for diagnosis\"}";
        res.set_content(ss.str(), "application/json");
    });

    // POST /queue/process -> processes all queued patients with optional model selection
    // Body: { "model": "logistic" } or empty for default (logistic)
    svr.Post("/queue/process", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string body = req.body;
        
        // Extract model from request body
        string modelStr = "logistic"; // default
        size_t modelPos = body.find("\"model\"");
        if (modelPos != string::npos) {
            size_t colon = body.find(':', modelPos);
            if (colon != string::npos) {
                size_t start = body.find_first_of('"', colon);
                if (start != string::npos) {
                    start++;
                    size_t end = body.find('"', start);
                    if (end != string::npos) {
                        modelStr = body.substr(start, end - start);
                    }
                }
            }
        }
        
        // Map string to ModelType
        CancerDiagnosisSystem::ModelType model = CancerDiagnosisSystem::ModelType::LOGISTIC;
        if (modelStr == "knn") model = CancerDiagnosisSystem::ModelType::KNN;
        else if (modelStr == "decision_tree") model = CancerDiagnosisSystem::ModelType::DECISION_TREE;
        else if (modelStr == "naive_bayes") model = CancerDiagnosisSystem::ModelType::NAIVE_BAYES;

        // Process queue with selected model and get diagnosis results
        auto results = system.processTestQueueWithModel(model);

        // Persist changes to CSV files
        system.saveDataToFiles("data/genes.csv", "data/patients.csv", "data/patient_genes.csv");

        // Build JSON array of results
        std::ostringstream ss;
        ss << "{\"model\":\"" << json_escape(modelStr) << "\",\"processed\":" << results.size() 
           << ",\"results\":[";
        for (size_t i = 0; i < results.size(); ++i) {
            if (i) ss << ",";
            ss << results[i];
        }
        ss << "],\"patientCount\":" << system.getPatientCount()
           << ",\"geneticCount\":" << system.getGeneticDataCount() << "}";
        res.set_content(ss.str(), "application/json");
    });


    std::cout << "Starting server on http://localhost:8080 ..." << std::endl;
        std::cout.flush();
    
        if (!svr.listen("localhost", 8080)) {
            std::cerr << "Failed to bind to port 8080. Is another server already running?" << std::endl;
            return 1;
        }

    return 0;
}

// Wrapper entry point for the server executable
int main() {
    return serverMain();
}

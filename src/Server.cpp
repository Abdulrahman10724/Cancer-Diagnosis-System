#include "../headers/CancerDiagnosisSystem.h"
#include "../headers/Json.h"
#include "../headers/DatasetStore.h"
#include "../headers/PatientGraph.h"
#include "../headers/Benchmark.h"
#include "../headers/Sorting.h"
#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <cmath>
#include <vector>

// Single-header HTTP library (third_party/httplib.h)
// Bodies sent without a JSON content type (curl -d) are treated as forms; allow the same 5 MB
#define CPPHTTPLIB_FORM_URL_ENCODED_PAYLOAD_MAX_LENGTH (5 * 1024 * 1024)
#include "../third_party/httplib.h"

using std::string;

namespace {

const DatasetFiles DEFAULT_FILES = {"data/patients.csv", "data/genes.csv", "data/patient_genes.csv"};

// ------------------------------------------------------------ responses

void sendJson(httplib::Response& res, int status, const string& body) {
    res.status = status;
    res.set_content(body, "application/json");
}

void sendError(httplib::Response& res, int status, const string& message) {
    sendJson(res, status, "{\"error\":" + jsonString(message) + "}");
}

void sendProblems(httplib::Response& res, const std::vector<string>& problems) {
    std::ostringstream ss;
    ss << "{\"error\":\"Dataset is invalid\",\"problems\":[";
    for (size_t i = 0; i < problems.size(); ++i) {
        if (i) ss << ",";
        ss << jsonString(problems[i]);
    }
    ss << "]}";
    sendJson(res, 400, ss.str());
}

// Parse the request body as a JSON object; an empty body counts as {}
bool readBody(const httplib::Request& req, httplib::Response& res, JsonValue& body) {
    string trimmed = req.body;
    if (trimmed.find_first_not_of(" \t\r\n") == string::npos) {
        body = JsonValue();
        body.type = JsonValue::Object;
        return true;
    }
    string error;
    if (!JsonValue::parse(req.body, body, error)) {
        sendError(res, 400, error);
        return false;
    }
    if (!body.isObject()) {
        sendError(res, 400, "The request body must be a JSON object");
        return false;
    }
    return true;
}

string stringField(const JsonValue& body, const string& key, const string& fallback = "") {
    const JsonValue* v = body.get(key);
    return (v && v->isString()) ? v->text : fallback;
}

bool parseDoubleParam(const string& s, double& out) {
    if (s.empty()) return false;
    char* end = nullptr;
    errno = 0;
    double v = std::strtod(s.c_str(), &end);
    if (end != s.c_str() + s.size() || errno == ERANGE || !std::isfinite(v)) return false;
    out = v;
    return true;
}

bool parseIntParam(const string& s, long& out) {
    if (s.empty()) return false;
    char* end = nullptr;
    errno = 0;
    long v = std::strtol(s.c_str(), &end, 10);
    if (end != s.c_str() + s.size() || errno == ERANGE) return false;
    out = v;
    return true;
}

// Reads ?k= (odd 1-15). Returns false (and sends 400) when present but invalid.
bool readK(const httplib::Request& req, httplib::Response& res, int& k) {
    k = 0;
    if (!req.has_param("k")) return true;
    long v = 0;
    if (!parseIntParam(req.get_param_value("k"), v) || v < 1 || v > 15 || v % 2 == 0) {
        sendError(res, 400, "k must be an odd number from 1 to 15");
        return false;
    }
    k = static_cast<int>(v);
    return true;
}

// ------------------------------------------------------------ JSON pieces

string featuresJson(const std::vector<double>& f) {
    const auto& names = FeatureExtractor::featureNames();
    std::ostringstream ss;
    ss << "{";
    for (size_t j = 0; j < names.size(); ++j) {
        if (j) ss << ",";
        ss << jsonString(names[j]) << ":" << (j < f.size() ? jsonNumber(f[j]) : "null");
    }
    ss << "}";
    return ss.str();
}

string featureNamesJson() {
    const auto& names = FeatureExtractor::featureNames();
    std::ostringstream ss;
    ss << "[";
    for (size_t j = 0; j < names.size(); ++j) {
        if (j) ss << ",";
        ss << jsonString(names[j]);
    }
    ss << "]";
    return ss.str();
}

string diagnosisJson(int d) {
    return d == 0 || d == 1 ? std::to_string(d) : "null";
}

string patientJson(const Patient& p) {
    std::ostringstream ss;
    ss << "{\"patient_id\":" << jsonString(p.getPatientId())
       << ",\"name\":" << jsonString(p.getName())
       << ",\"age\":" << p.getAge()
       << ",\"diagnosis\":" << diagnosisJson(p.getDiagnosis())
       << ",\"features\":" << featuresJson(p.getFeatures())
       << ",\"riskScore\":" << (p.getHasRisk() ? jsonNumber(p.getRiskScore()) : "null")
       << ",\"prediction\":" << (p.getHasRisk() ? std::to_string(p.getPrediction()) : "null")
       << ",\"geneIds\":[";
    const auto& ids = p.getGeneIds();
    for (size_t i = 0; i < ids.size(); ++i) {
        if (i) ss << ",";
        ss << jsonString(ids[i]);
    }
    ss << "]}";
    return ss.str();
}

string statusJson(const CancerDiagnosisSystem& system) {
    std::ostringstream ss;
    ss << "{\"modelsTrained\":" << (system.areModelsTrained() ? "true" : "false")
       << ",\"dataset\":" << (system.hasData() ? jsonString(system.getDatasetName()) : "null")
       << ",\"patientCount\":" << system.getPatientCount()
       << ",\"labelledCount\":" << system.getLabelledCount()
       << ",\"geneCount\":" << system.getGenes().size()
       << ",\"featureNames\":" << featureNamesJson() << "}";
    return ss.str();
}

string diagnoseAllJson(const Patient& p, const Diagnosis& d) {
    const auto& names = FeatureExtractor::featureNames();
    const int F = FeatureExtractor::NUM_FEATURES;
    auto pred = [](double r) { return r >= 0.5 ? 1 : 0; };
    std::ostringstream ss;
    ss << "{\"patient_id\":" << jsonString(p.getPatientId())
       << ",\"features\":" << featuresJson(d.raw)
       << ",\"featuresScaled\":" << featuresJson(d.scaled)
       << ",\"threshold\":0.5,\"models\":{";

    // Logistic regression
    ss << "\"logistic\":{\"risk\":" << jsonNumber(d.risk[ModelSet::LOGISTIC])
       << ",\"prediction\":" << pred(d.risk[ModelSet::LOGISTIC])
       << ",\"explain\":{\"bias\":" << jsonNumber(d.lrBias) << ",\"contributions\":[";
    for (size_t i = 0; i < d.lrContributions.size(); ++i) {
        const auto& c = d.lrContributions[i];
        if (i) ss << ",";
        ss << "{\"feature\":" << jsonString(names[c.feature]) << ",\"weight\":" << jsonNumber(c.weight)
           << ",\"value\":" << jsonNumber(c.value) << ",\"product\":" << jsonNumber(c.product) << "}";
    }
    ss << "],\"z\":" << jsonNumber(d.lrZ) << "}}";

    // KNN
    ss << ",\"knn\":{\"risk\":" << jsonNumber(d.risk[ModelSet::KNN])
       << ",\"prediction\":" << pred(d.risk[ModelSet::KNN]) << ",\"k\":" << d.k
       << ",\"explain\":{\"neighbors\":[";
    for (size_t i = 0; i < d.neighbors.size(); ++i) {
        const auto& n = d.neighbors[i];
        if (i) ss << ",";
        ss << "{\"patient_id\":" << jsonString(n.patient->getPatientId())
           << ",\"features\":" << featuresJson(n.patient->getFeatures())
           << ",\"diagnosis\":" << diagnosisJson(n.patient->getDiagnosis())
           << ",\"distance\":" << jsonNumber(n.distance) << "}";
    }
    ss << "],\"votesCancer\":" << d.votesCancer << ",\"votesSafe\":" << d.votesSafe
       << ",\"kdNodesVisited\":" << d.kdNodesVisited << "}}";

    // Decision tree
    ss << ",\"decision_tree\":{\"risk\":" << jsonNumber(d.risk[ModelSet::DECISION_TREE])
       << ",\"prediction\":" << pred(d.risk[ModelSet::DECISION_TREE]) << ",\"explain\":{\"path\":[";
    for (size_t i = 0; i < d.path.size(); ++i) {
        const auto& s = d.path[i];
        if (i) ss << ",";
        ss << "{\"feature\":" << jsonString(names[s.feature]) << ",\"threshold\":" << jsonNumber(s.threshold)
           << ",\"thresholdRaw\":" << jsonNumber(s.thresholdRaw) << ",\"value\":" << jsonNumber(s.value)
           << ",\"wentLeft\":" << (s.wentLeft ? "true" : "false") << "}";
    }
    ss << "],\"leafSamples\":" << d.leafSamples
       << ",\"leafPositiveFraction\":" << jsonNumber(d.leafPositiveFraction) << "}}";

    // Naive Bayes (statistics in raw units)
    ss << ",\"naive_bayes\":{\"risk\":" << jsonNumber(d.risk[ModelSet::NAIVE_BAYES])
       << ",\"prediction\":" << pred(d.risk[ModelSet::NAIVE_BAYES])
       << ",\"explain\":{\"prior\":[" << jsonNumber(d.nbPrior[0]) << "," << jsonNumber(d.nbPrior[1])
       << "],\"perFeature\":[";
    for (int j = 0; j < F; ++j) {
        if (j) ss << ",";
        ss << "{\"feature\":" << jsonString(names[j])
           << ",\"mean\":[" << jsonNumber(d.nbMeanRaw[0][j]) << "," << jsonNumber(d.nbMeanRaw[1][j]) << "]"
           << ",\"std\":[" << jsonNumber(d.nbStdRaw[0][j]) << "," << jsonNumber(d.nbStdRaw[1][j]) << "]"
           << ",\"value\":" << jsonNumber(d.raw[j]) << "}";
    }
    ss << "]}}},\"consensus\":{\"cancer\":" << d.cancerVotes << ",\"safe\":" << (ModelSet::NUM_MODELS - d.cancerVotes)
       << ",\"meanRisk\":" << jsonNumber(d.meanRisk) << "}}";
    return ss.str();
}

string treeNodeJson(const std::shared_ptr<TreeNode>& node, const DataPreprocessor& scaler) {
    if (!node) return "null";
    std::ostringstream ss;
    bool isLeaf = node->featureIndex < 0;
    ss << "{\"feature\":" << (isLeaf ? "null" : jsonString(FeatureExtractor::featureNames()[static_cast<size_t>(node->featureIndex)]))
       << ",\"threshold\":" << (isLeaf ? "null" : jsonNumber(node->threshold))
       << ",\"thresholdRaw\":" << (isLeaf ? "null" : jsonNumber(scaler.inverseValue(static_cast<size_t>(node->featureIndex), node->threshold)))
       << ",\"samples\":" << node->sampleCount
       << ",\"positiveFraction\":" << jsonNumber(node->positiveFraction)
       << ",\"prediction\":" << node->prediction
       << ",\"left\":" << treeNodeJson(node->left, scaler)
       << ",\"right\":" << treeNodeJson(node->right, scaler) << "}";
    return ss.str();
}

string summaryJson(const FeatureSummary& s) {
    return "{\"mean\":" + jsonNumber(s.mean) + ",\"std\":" + jsonNumber(s.stdDev) + ",\"min\":" + jsonNumber(s.min) +
           ",\"max\":" + jsonNumber(s.max) + "}";
}

string kdNodeJson(const KDTree& tree, const DataPreprocessor& scaler, const std::vector<const Patient*>& rows,
                  int node, int depth, int maxDepth) {
    if (node < 0) return "null";
    const KDTree::Node& n = tree.getNodes()[static_cast<size_t>(node)];
    std::ostringstream ss;
    ss << "{\"axis\":" << n.axis << ",\"feature\":" << jsonString(FeatureExtractor::featureNames()[static_cast<size_t>(n.axis)])
       << ",\"split\":" << jsonNumber(n.split)
       << ",\"splitRaw\":" << jsonNumber(scaler.inverseValue(static_cast<size_t>(n.axis), n.split))
       << ",\"size\":" << n.size
       << ",\"patient_id\":" << (n.point < rows.size() ? jsonString(rows[n.point]->getPatientId()) : "null");
    if (depth + 1 < maxDepth) {
        ss << ",\"left\":" << kdNodeJson(tree, scaler, rows, n.left, depth + 1, maxDepth)
           << ",\"right\":" << kdNodeJson(tree, scaler, rows, n.right, depth + 1, maxDepth);
    } else {
        ss << ",\"truncated\":" << ((n.left >= 0 || n.right >= 0) ? "true" : "false");
    }
    ss << "}";
    return ss.str();
}

} // namespace

int serverMain() {
    httplib::Server svr;
    CancerDiagnosisSystem system;
    // All handlers share one system object; cpp-httplib runs handlers on a thread pool
    std::mutex systemMutex;

    svr.set_payload_max_length(5 * 1024 * 1024);

    // CORS header on every response, including errors
    svr.set_post_routing_handler([](const httplib::Request&, httplib::Response& res) {
        if (!res.has_header("Access-Control-Allow-Origin")) {
            res.set_header("Access-Control-Allow-Origin", "*");
        }
    });

    // CORS preflight for every route
    svr.Options(R"(.*)", [](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        res.set_content("", "text/plain");
    });

    // Load the default dataset at start-up
    {
        std::vector<string> problems;
        if (system.loadDataset(DEFAULT_FILES, "default", problems)) {
            std::cout << "Loaded the default dataset: " << system.getPatientCount() << " patients, "
                      << system.getGenes().size() << " genes." << std::endl;
        } else {
            std::cout << "The default dataset was not loaded:" << std::endl;
            for (const auto& p : problems) std::cout << "  " << p << std::endl;
        }
    }

    svr.Get("/status", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        sendJson(res, 200, statusJson(system));
    });

    // POST /load {"patientsFile","genesFile","patientGenesFile"} (missing fields use data/ defaults)
    svr.Post("/load", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        DatasetFiles f;
        f.patients = stringField(body, "patientsFile", DEFAULT_FILES.patients);
        f.genes = stringField(body, "genesFile", DEFAULT_FILES.genes);
        f.patientGenes = stringField(body, "patientGenesFile", DEFAULT_FILES.patientGenes);
        bool isDefault = f.patients == DEFAULT_FILES.patients && f.genes == DEFAULT_FILES.genes &&
                         f.patientGenes == DEFAULT_FILES.patientGenes;
        std::vector<string> problems;
        if (!system.loadDataset(f, isDefault ? "default" : "custom", problems)) {
            sendProblems(res, problems);
            return;
        }
        sendJson(res, 200, statusJson(system));
    });

    // POST /upload {"name","patientsCsv","genesCsv","patientGenesCsv"} -> validate, save, load
    svr.Post("/upload", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        string name = stringField(body, "name");
        if (!DatasetStore::validName(name)) {
            sendError(res, 400, "name must be 1 to 40 characters from a-z, 0-9 and - (and not 'default')");
            return;
        }
        if (DatasetStore::exists(name)) {
            sendError(res, 409, "A dataset called '" + name + "' already exists");
            return;
        }
        const JsonValue* p = body.get("patientsCsv");
        const JsonValue* g = body.get("genesCsv");
        const JsonValue* pg = body.get("patientGenesCsv");
        if (!p || !p->isString() || !g || !g->isString() || !pg || !pg->isString()) {
            sendError(res, 400, "patientsCsv, genesCsv and patientGenesCsv must be the CSV files as text");
            return;
        }
        DatasetContent content{p->text, g->text, pg->text};
        // Validate before anything is written; the active dataset stays if this fails
        LoadedDataset check;
        std::vector<string> problems;
        if (!DatasetLoader::parse(content, check, problems)) {
            sendProblems(res, problems);
            return;
        }
        string error;
        if (!DatasetStore::writeUpload(name, content, error)) {
            sendError(res, 500, error);
            return;
        }
        if (!system.loadContent(content, DatasetStore::filesFor(name), name, problems)) {
            sendProblems(res, problems);
            return;
        }
        sendJson(res, 200, statusJson(system));
    });

    // GET /datasets -> "default" and every folder in data/uploads, with counts
    svr.Get("/datasets", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::vector<string> names;
        names.push_back("default");
        for (const auto& n : DatasetStore::uploadNames()) names.push_back(n);
        std::ostringstream ss;
        ss << "{\"active\":" << (system.hasData() ? jsonString(system.getDatasetName()) : "null") << ",\"datasets\":[";
        for (size_t i = 0; i < names.size(); ++i) {
            DatasetInfo info = DatasetStore::describe(names[i]);
            if (i) ss << ",";
            ss << "{\"name\":" << jsonString(info.name) << ",\"valid\":" << (info.valid ? "true" : "false")
               << ",\"patientCount\":" << info.patients << ",\"labelledCount\":" << info.labelled
               << ",\"geneCount\":" << info.genes << "}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // POST /datasets/select {"name":"my-data"} -> loads that dataset
    svr.Post("/datasets/select", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        string name = stringField(body, "name");
        if (name.empty()) {
            sendError(res, 400, "Missing name");
            return;
        }
        if (!DatasetStore::exists(name)) {
            sendError(res, 404, "Dataset '" + name + "' not found");
            return;
        }
        std::vector<string> problems;
        if (!system.loadDataset(DatasetStore::filesFor(name), name, problems)) {
            sendProblems(res, problems);
            return;
        }
        sendJson(res, 200, statusJson(system));
    });

    svr.Get("/patients", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::ostringstream ss;
        ss << "[";
        bool first = true;
        for (const Patient* p : system.patientsInOrder()) {
            if (!first) ss << ",";
            first = false;
            ss << patientJson(*p);
        }
        ss << "]";
        sendJson(res, 200, ss.str());
    });

    // POST /patients {"patient_id","name","age","diagnosis":0/1/null,"genes":[{"geneId","mutationScore"}]}
    svr.Post("/patients", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        NewPatientInput in;
        in.id = stringField(body, "patient_id");
        in.name = stringField(body, "name");
        const JsonValue* age = body.get("age");
        if (!age || !age->isNumber() || age->number != static_cast<double>(static_cast<long>(age->number))) {
            sendError(res, 400, "age must be a whole number from 0 to 120");
            return;
        }
        in.age = static_cast<int>(age->number);
        in.diagnosis = Patient::UNKNOWN;
        const JsonValue* diag = body.get("diagnosis");
        if (diag && !diag->isNull()) {
            if (!diag->isNumber() || (diag->number != 0.0 && diag->number != 1.0)) {
                sendError(res, 400, "diagnosis must be 0, 1 or null");
                return;
            }
            in.diagnosis = static_cast<int>(diag->number);
        }
        const JsonValue* list = body.get("genes");
        if (!list || !list->isArray()) {
            sendError(res, 400, "genes must be a list like [{\"geneId\":\"GENE_001\",\"mutationScore\":0.5}]");
            return;
        }
        for (const auto& item : list->items) {
            const JsonValue* gid = item.get("geneId");
            if (!item.isObject() || !gid || !gid->isString()) {
                sendError(res, 400, "Every gene needs a geneId");
                return;
            }
            NewGene g;
            g.geneId = gid->text;
            const JsonValue* sc = item.get("mutationScore");
            g.hasScore = sc && sc->isNumber();
            g.score = g.hasScore ? sc->number : 0.0;
            if (sc && !sc->isNull() && !sc->isNumber()) {
                sendError(res, 400, "mutationScore must be a number from 0 to 1");
                return;
            }
            in.genes.push_back(g);
        }
        std::vector<GeneReport> report;
        string error;
        int status = system.addPatient(in, report, error);
        if (status != 200) {
            sendError(res, status, error);
            return;
        }
        const Patient* p = system.findPatient(in.id);
        std::ostringstream ss;
        ss << "{\"success\":true,\"patient\":" << patientJson(*p) << ",\"genes\":[";
        for (size_t i = 0; i < report.size(); ++i) {
            const auto& r = report[i];
            if (i) ss << ",";
            ss << "{\"geneId\":" << jsonString(r.geneId) << ",\"mutationScore\":" << jsonNumber(r.usedScore)
               << ",\"existing\":" << (r.existed ? "true" : "false")
               << ",\"sentScoreIgnored\":" << (r.scoreIgnored ? "true" : "false") << "}";
        }
        ss << "],\"status\":" << statusJson(system) << "}";
        sendJson(res, 200, ss.str());
    });

    // GET /patients/search?id=P007 -> linear search of the linked list with the visit order
    svr.Get("/patients/search", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string id = req.has_param("id") ? req.get_param_value("id") : string();
        if (id.empty()) {
            sendError(res, 400, "Missing id");
            return;
        }
        std::vector<string> order;
        bool found = system.searchPatientTrace(id, order);
        std::ostringstream ss;
        ss << "{\"found\":" << (found ? "true" : "false") << ",\"hops\":" << order.size() << ",\"order\":[";
        for (size_t i = 0; i < order.size(); ++i) {
            if (i) ss << ",";
            ss << jsonString(order[i]);
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // DELETE /patients/{id} -> removes the patient (undoable)
    svr.Delete(R"(/patients/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string id = req.matches[1];
        string error;
        int status = system.deletePatient(id, error);
        if (status != 200) {
            sendError(res, status, error);
            return;
        }
        sendJson(res, 200, "{\"deleted\":" + jsonString(id) + ",\"undoAvailable\":" +
                               std::to_string(system.undoDepth()) + ",\"status\":" + statusJson(system) + "}");
    });

    // POST /undo -> reverts the last add or delete
    svr.Post("/undo", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string description;
        if (!system.undo(description)) {
            sendError(res, 400, "Nothing to undo");
            return;
        }
        sendJson(res, 200, "{\"undone\":" + jsonString(description) + ",\"undoAvailable\":" +
                               std::to_string(system.undoDepth()) + ",\"status\":" + statusJson(system) + "}");
    });

    // GET /patients/index?id=P007 -> AVL lookup with the keys visited
    svr.Get("/patients/index", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string id = req.has_param("id") ? req.get_param_value("id") : string();
        if (id.empty()) {
            sendError(res, 400, "Missing id");
            return;
        }
        std::vector<string> path;
        int steps = 0;
        int height = 0;
        bool found = system.indexLookup(id, path, steps, height);
        std::ostringstream ss;
        ss << "{\"found\":" << (found ? "true" : "false") << ",\"steps\":" << steps << ",\"path\":[";
        for (size_t i = 0; i < path.size(); ++i) ss << (i ? "," : "") << jsonString(path[i]);
        ss << "],\"height\":" << height << ",\"size\":" << system.getPatientCount() << "}";
        sendJson(res, 200, ss.str());
    });

    // GET /patients/range?min=0.4&max=0.6 -> patients by consensus risk (AVL risk index)
    svr.Get("/patients/range", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        auto readNumber = [&](const char* name, double fallback, double& out) {
            if (!req.has_param(name)) {
                out = fallback;
                return true;
            }
            string v = req.get_param_value(name);
            char* end = nullptr;
            out = std::strtod(v.c_str(), &end);
            return !v.empty() && end == v.c_str() + v.size();
        };
        double lo = 0.0;
        double hi = 1.0;
        if (!readNumber("min", 0.0, lo) || !readNumber("max", 1.0, hi) || lo < 0.0 || hi > 1.0 || lo > hi) {
            sendError(res, 400, "min and max must be numbers with 0 <= min <= max <= 1");
            return;
        }
        if (!system.areModelsTrained()) {
            sendError(res, 400, "Load data first");
            return;
        }
        int visited = 0;
        auto found = system.riskRange(lo, hi, visited);
        std::ostringstream ss;
        ss << "{\"min\":" << jsonNumber(lo) << ",\"max\":" << jsonNumber(hi) << ",\"count\":" << found.size()
           << ",\"visited\":" << visited << ",\"patients\":[";
        for (size_t i = 0; i < found.size(); ++i) {
            if (i) ss << ",";
            ss << "{\"patient_id\":" << jsonString(found[i]->getPatientId())
               << ",\"name\":" << jsonString(found[i]->getName())
               << ",\"risk\":" << jsonNumber(found[i]->getRiskScore()) << "}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // GET /genetic -> every gene and its mutation score (insertion order)
    svr.Get("/genetic", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        std::ostringstream ss;
        ss << "[";
        bool first = true;
        for (const auto& id : system.getGeneOrder()) {
            double s = 0.0;
            if (!system.getGenes().get(id, s)) continue;
            if (!first) ss << ",";
            first = false;
            ss << "{\"gene_id\":" << jsonString(id) << ",\"mutation_score\":" << jsonNumber(s) << "}";
        }
        ss << "]";
        sendJson(res, 200, ss.str());
    });

    // GET /diagnose?patient_id=P007&model=all|logistic|knn|decision_tree|naive_bayes&k=5
    svr.Get("/diagnose", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string pid = req.has_param("patient_id") ? req.get_param_value("patient_id") : string();
        string modelKey = req.has_param("model") ? req.get_param_value("model") : string("logistic");
        int k = 0;
        if (pid.empty()) {
            sendError(res, 400, "Missing patient_id");
            return;
        }
        if (!readK(req, res, k)) return;
        int model = ModelSet::fromKey(modelKey);
        if (modelKey != "all" && model < 0) {
            sendError(res, 400, "model must be all, logistic, knn, decision_tree or naive_bayes");
            return;
        }
        if (!system.areModelsTrained()) {
            sendError(res, 400, "Load data first");
            return;
        }
        const Patient* p = system.findPatient(pid);
        if (!p) {
            sendError(res, 404, "Patient ID '" + pid + "' not found");
            return;
        }
        if (modelKey == "all") {
            Diagnosis d;
            system.diagnose(*p, k, d);
            sendJson(res, 200, diagnoseAllJson(*p, d));
            return;
        }
        double r = system.modelRisk(*p, model, k);
        std::ostringstream ss;
        ss << "{\"patient_id\":" << jsonString(p->getPatientId()) << ",\"riskScore\":" << jsonNumber(r)
           << ",\"prediction\":" << (r >= 0.5 ? 1 : 0) << "}";
        sendJson(res, 200, ss.str());
    });

    // GET /evaluate -> metrics on a stratified 80/20 split (seed 42)
    svr.Get("/evaluate", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        EvaluationResult ev;
        if (!system.evaluate(ev)) {
            sendError(res, 400, "Load data first");
            return;
        }
        std::ostringstream ss;
        ss << "{\"split\":{\"train\":" << ev.trainCount << ",\"test\":" << ev.testCount
           << ",\"seed\":" << ev.seed << "},\"testSamples\":" << ev.testCount << ",\"models\":[";
        for (size_t i = 0; i < ev.models.size(); ++i) {
            const auto& m = ev.models[i];
            if (i) ss << ",";
            ss << "{\"key\":" << jsonString(ModelSet::key(m.model)) << ",\"name\":" << jsonString(ModelSet::name(m.model))
               << ",\"accuracy\":" << jsonNumber(m.accuracy) << ",\"precision\":" << jsonNumber(m.precision)
               << ",\"recall\":" << jsonNumber(m.recall) << ",\"f1\":" << jsonNumber(m.f1)
               << ",\"confusion\":{\"tp\":" << m.confusion.truePositive << ",\"fp\":" << m.confusion.falsePositive
               << ",\"tn\":" << m.confusion.trueNegative << ",\"fn\":" << m.confusion.falseNegative << "}"
               << ",\"roc\":{\"points\":[";
            for (size_t j = 0; j < m.roc.size(); ++j) {
                if (j) ss << ",";
                ss << "[" << jsonNumber(m.roc[j].first) << "," << jsonNumber(m.roc[j].second) << "]";
            }
            ss << "],\"auc\":" << jsonNumber(m.auc) << "}"
               << ",\"samples\":[";
            for (size_t j = 0; j < m.samples.size(); ++j) {
                const auto& s = m.samples[j];
                if (j) ss << ",";
                ss << "{\"patient_id\":" << jsonString(s.patient->getPatientId())
                   << ",\"features\":" << featuresJson(s.patient->getFeatures())
                   << ",\"diagnosis\":" << s.label << ",\"risk\":" << jsonNumber(s.risk) << "}";
            }
            ss << "]}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // GET /crossval?k=5 -> stratified k-fold cross-validation, mean and std per metric
    svr.Get("/crossval", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        long k = 5;
        if (req.has_param("k") && (!parseIntParam(req.get_param_value("k"), k) || k < 2 || k > 10)) {
            sendError(res, 400, "k must be a whole number from 2 to 10");
            return;
        }
        CrossValidationResult cv;
        if (!system.crossValidate(static_cast<int>(k), cv)) {
            sendError(res, 400, "Load data first");
            return;
        }
        static const char* METRICS[4] = {"accuracy", "precision", "recall", "f1"};
        std::ostringstream ss;
        ss << "{\"k\":" << cv.k << ",\"seed\":" << cv.seed << ",\"foldSizes\":[";
        for (size_t f = 0; f < cv.foldSizes.size(); ++f) ss << (f ? "," : "") << cv.foldSizes[f];
        ss << "],\"models\":[";
        for (int m = 0; m < ModelSet::NUM_MODELS; ++m) {
            if (m) ss << ",";
            ss << "{\"key\":" << jsonString(ModelSet::key(m)) << ",\"name\":" << jsonString(ModelSet::name(m));
            for (int j = 0; j < 4; ++j) {
                ss << ",\"" << METRICS[j] << "\":{\"mean\":" << jsonNumber(cv.mean[m][j])
                   << ",\"std\":" << jsonNumber(cv.stdDev[m][j]) << ",\"folds\":[";
                for (size_t f = 0; f < cv.folds[m].size(); ++f) {
                    if (f) ss << ",";
                    ss << jsonNumber(cv.folds[m][f][static_cast<size_t>(j)]);
                }
                ss << "]}";
            }
            ss << "}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // GET /features -> feature statistics, correlation matrix, importance and histograms
    svr.Get("/features", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        FeatureStats fs;
        if (!system.featureStats(fs)) {
            sendError(res, 400, "Load data first");
            return;
        }
        const auto& names = FeatureExtractor::featureNames();
        const int F = FeatureStats::F;
        std::ostringstream ss;
        ss << "{\"featureNames\":" << featureNamesJson()
           << ",\"labelled\":{\"noCancer\":" << fs.count[0] << ",\"cancer\":" << fs.count[1] << "},\"features\":[";
        for (int j = 0; j < F; ++j) {
            if (j) ss << ",";
            ss << "{\"name\":" << jsonString(names[static_cast<size_t>(j)])
               << ",\"overall\":" << summaryJson(fs.overall[j])
               << ",\"noCancer\":" << summaryJson(fs.perClass[0][j])
               << ",\"cancer\":" << summaryJson(fs.perClass[1][j])
               << ",\"importance\":{\"logistic\":" << jsonNumber(fs.importanceLogistic[j])
               << ",\"tree\":" << jsonNumber(fs.importanceTree[j]) << "}"
               << ",\"histogram\":{\"binStart\":" << jsonNumber(fs.binStart[j])
               << ",\"binWidth\":" << jsonNumber(fs.binWidth[j]) << ",\"noCancer\":[";
            for (int b = 0; b < FeatureStats::BINS; ++b) ss << (b ? "," : "") << fs.histogram[0][j][b];
            ss << "],\"cancer\":[";
            for (int b = 0; b < FeatureStats::BINS; ++b) ss << (b ? "," : "") << fs.histogram[1][j][b];
            ss << "]}}";
        }
        ss << "],\"correlation\":{\"labels\":[";
        for (int a = 0; a < F; ++a) ss << jsonString(names[static_cast<size_t>(a)]) << ",";
        ss << "\"diagnosis\"],\"matrix\":[";
        for (int a = 0; a <= F; ++a) {
            if (a) ss << ",";
            ss << "[";
            for (int b = 0; b <= F; ++b) ss << (b ? "," : "") << jsonNumber(fs.correlation[a][b]);
            ss << "]";
        }
        ss << "]}}";
        sendJson(res, 200, ss.str());
    });

    // GET /tree -> the decision tree as nested nodes
    svr.Get("/tree", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        if (!system.areModelsTrained()) {
            sendError(res, 400, "Load data first");
            return;
        }
        const ModelSet& m = system.getModels();
        std::ostringstream ss;
        ss << "{\"depth\":" << m.tree.getDepth() << ",\"nodeCount\":" << m.tree.getNodeCount()
           << ",\"root\":" << treeNodeJson(m.tree.getRoot(), m.scaler) << "}";
        sendJson(res, 200, ss.str());
    });

    // GET /queue -> {"queueSize":N,"patients":["P1","P2"]} (front first)
    svr.Get("/queue", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        auto ids = system.queuedIds();
        std::ostringstream ss;
        ss << "{\"queueSize\":" << ids.size() << ",\"patients\":[";
        for (size_t i = 0; i < ids.size(); ++i) {
            if (i) ss << ",";
            ss << jsonString(ids[i]);
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // POST /queue {"patient_id":"P001"} -> add to the rear
    svr.Post("/queue", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        string pid = stringField(body, "patient_id");
        if (pid.empty()) {
            sendError(res, 400, "Missing patient_id");
            return;
        }
        if (!system.enqueue(pid)) {
            sendError(res, 404, "Patient ID '" + pid + "' not found");
            return;
        }
        std::ostringstream ss;
        ss << "{\"success\":true,\"queueSize\":" << system.queueSize()
           << ",\"message\":\"Patient scheduled for diagnosis\"}";
        sendJson(res, 200, ss.str());
    });

    // POST /queue/process {"model":"logistic"} -> processes the whole queue, front first
    svr.Post("/queue/process", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        string modelKey = stringField(body, "model", "logistic");
        int model = ModelSet::fromKey(modelKey);
        if (model < 0) {
            sendError(res, 400, "model must be logistic, knn, decision_tree or naive_bayes");
            return;
        }
        if (!system.areModelsTrained()) {
            sendError(res, 400, "Load data first");
            return;
        }
        auto results = system.processQueue(model);
        std::ostringstream ss;
        ss << "{\"model\":" << jsonString(modelKey) << ",\"processed\":" << results.size() << ",\"results\":[";
        for (size_t i = 0; i < results.size(); ++i) {
            const auto& r = results[i];
            if (i) ss << ",";
            ss << "{\"patient_id\":" << jsonString(r.patient->getPatientId())
               << ",\"name\":" << jsonString(r.patient->getName())
               << ",\"riskScore\":" << jsonNumber(r.risk) << ",\"prediction\":" << r.prediction
               << ",\"status\":\"processed\"}";
        }
        ss << "],\"patientCount\":" << system.getPatientCount() << "}";
        sendJson(res, 200, ss.str());
    });

    // GET /kdtree?depth=4 -> the KNN k-d tree down to the given depth
    svr.Get("/kdtree", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        long depth = 4;
        if (req.has_param("depth") && (!parseIntParam(req.get_param_value("depth"), depth) || depth < 1 || depth > 12)) {
            sendError(res, 400, "depth must be a whole number from 1 to 12");
            return;
        }
        if (!system.areModelsTrained()) {
            sendError(res, 400, "Load data first");
            return;
        }
        const KDTree& tree = system.getModels().knn.getTree();
        std::ostringstream ss;
        ss << "{\"points\":" << tree.size() << ",\"dimensions\":" << tree.getDimensions()
           << ",\"height\":" << tree.height() << ",\"depth\":" << depth
           << ",\"root\":" << kdNodeJson(tree, system.getModels().scaler, system.getTrainPatients(),
                                          tree.getRoot(), 0, static_cast<int>(depth)) << "}";
        sendJson(res, 200, ss.str());
    });

    // Shared by /graph and /graph/bfs: reads ?eps= and builds the graph over every patient
    auto buildGraph = [&](const httplib::Request& req, httplib::Response& res, PatientGraph& graph,
                          std::vector<const Patient*>& patients, long& kdVisited) {
        double eps = 0.6;
        if (req.has_param("eps") && (!parseDoubleParam(req.get_param_value("eps"), eps) || eps <= 0.0 || eps > 10.0)) {
            sendError(res, 400, "eps must be a number above 0 and at most 10");
            return false;
        }
        if (!system.areModelsTrained()) {
            sendError(res, 400, "Load data first");
            return false;
        }
        patients = system.patientsInOrder();
        std::vector<std::vector<double>> rows;
        rows.reserve(patients.size());
        for (const Patient* p : patients) rows.push_back(system.getModels().scaler.transform(p->getFeatures()));
        kdVisited = graph.build(rows, eps);
        return true;
    };

    // GET /graph?eps=0.6 -> nodes, edges and connected components
    svr.Get("/graph", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        PatientGraph graph;
        std::vector<const Patient*> patients;
        long visited = 0;
        if (!buildGraph(req, res, graph, patients, visited)) return;

        std::vector<int> comp;
        size_t count = graph.components(comp);
        const int F = FeatureExtractor::NUM_FEATURES;
        std::vector<size_t> size(count, 0), labelled(count, 0), cancer(count, 0);
        std::vector<std::vector<double>> sum(count, std::vector<double>(F, 0.0));
        for (size_t i = 0; i < patients.size(); ++i) {
            size_t c = static_cast<size_t>(comp[i]);
            size[c]++;
            if (patients[i]->isLabelled()) {
                labelled[c]++;
                if (patients[i]->getDiagnosis() == 1) cancer[c]++;
            }
            const std::vector<double>& f = patients[i]->getFeatures();
            for (int j = 0; j < F; ++j) sum[c][static_cast<size_t>(j)] += f[static_cast<size_t>(j)];
        }
        // Largest components first; equal sizes keep their order
        std::vector<size_t> order(count);
        for (size_t c = 0; c < count; ++c) order[c] = c;
        Sorting::mergeSortBy(order, [&size](size_t a, size_t b) { return size[a] > size[b]; });

        std::ostringstream ss;
        ss << "{\"eps\":" << jsonNumber(graph.getEps()) << ",\"edgeSearch\":\"kd-tree radius search\""
           << ",\"kdNodesVisited\":" << visited << ",\"featureNames\":" << featureNamesJson()
           << ",\"nodeCount\":" << graph.nodeCount() << ",\"edgeCount\":" << graph.edgeCount() << ",\"nodes\":[";
        for (size_t i = 0; i < patients.size(); ++i) {
            if (i) ss << ",";
            const Patient* p = patients[i];
            ss << "{\"id\":" << jsonString(p->getPatientId()) << ",\"features\":" << featuresJson(p->getFeatures())
               << ",\"diagnosis\":" << (p->isLabelled() ? std::to_string(p->getDiagnosis()) : string("null"))
               << ",\"component\":" << comp[i] << "}";
        }
        ss << "],\"edges\":[";
        bool first = true;
        for (size_t i = 0; i < graph.nodeCount(); ++i) {
            for (const auto& e : graph.neighbors(i)) {
                if (e.to <= i) continue;
                if (!first) ss << ",";
                first = false;
                ss << "{\"a\":" << jsonString(patients[i]->getPatientId()) << ",\"b\":"
                   << jsonString(patients[e.to]->getPatientId()) << ",\"distance\":" << jsonNumber(e.distance) << "}";
            }
        }
        ss << "],\"components\":{\"count\":" << count << ",\"isolated\":";
        size_t isolated = 0;
        for (size_t c = 0; c < count; ++c) if (size[c] == 1) isolated++;
        ss << isolated << ",\"list\":[";
        for (size_t k = 0; k < count; ++k) {
            size_t c = order[k];
            if (k) ss << ",";
            std::vector<double> mean(F, 0.0);
            for (int j = 0; j < F; ++j) mean[static_cast<size_t>(j)] = sum[c][static_cast<size_t>(j)] / static_cast<double>(size[c]);
            ss << "{\"component\":" << c << ",\"size\":" << size[c] << ",\"labelled\":" << labelled[c]
               << ",\"cancerRate\":" << (labelled[c] ? jsonNumber(static_cast<double>(cancer[c]) / static_cast<double>(labelled[c])) : string("null"))
               << ",\"meanFeatures\":" << featuresJson(mean) << "}";
        }
        ss << "]}}";
        sendJson(res, 200, ss.str());
    });

    // GET /graph/bfs?start=ID&eps=0.6 -> breadth-first visit order with levels
    svr.Get("/graph/bfs", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        string start = req.has_param("start") ? req.get_param_value("start") : "";
        if (start.empty()) {
            sendError(res, 400, "Missing start (a patient ID)");
            return;
        }
        PatientGraph graph;
        std::vector<const Patient*> patients;
        long visited = 0;
        if (!buildGraph(req, res, graph, patients, visited)) return;
        size_t startIndex = patients.size();
        for (size_t i = 0; i < patients.size(); ++i) {
            if (patients[i]->getPatientId() == start) {
                startIndex = i;
                break;
            }
        }
        if (startIndex == patients.size()) {
            sendError(res, 404, "Patient '" + start + "' not found");
            return;
        }
        std::vector<PatientGraph::Visit> order = graph.bfs(startIndex);
        int levels = 0;
        std::ostringstream ss;
        ss << "{\"start\":" << jsonString(start) << ",\"eps\":" << jsonNumber(graph.getEps()) << ",\"order\":[";
        for (size_t i = 0; i < order.size(); ++i) {
            const PatientGraph::Visit& v = order[i];
            const Patient* p = patients[v.node];
            if (v.level + 1 > levels) levels = v.level + 1;
            if (i) ss << ",";
            ss << "{\"id\":" << jsonString(p->getPatientId()) << ",\"level\":" << v.level << ",\"parent\":"
               << (v.parent < 0 ? string("null") : jsonString(patients[static_cast<size_t>(v.parent)]->getPatientId()))
               << ",\"diagnosis\":" << (p->isLabelled() ? std::to_string(p->getDiagnosis()) : string("null")) << "}";
        }
        ss << "],\"reached\":" << order.size() << ",\"levels\":" << levels << ",\"nodeCount\":" << graph.nodeCount() << "}";
        sendJson(res, 200, ss.str());
    });

    // GET /benchmark?n=2000&seed=1 -> timings on synthetic patients (the loaded dataset is not used)
    svr.Get("/benchmark", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        long n = 2000;
        long seed = 1;
        if (req.has_param("n") && (!parseIntParam(req.get_param_value("n"), n) || n < static_cast<long>(Benchmark::MIN_N))) {
            sendError(res, 400, "n must be a whole number of at least 10 (values above 20000 are capped)");
            return;
        }
        if (req.has_param("seed") && (!parseIntParam(req.get_param_value("seed"), seed) || seed < 0 || seed > 4294967295L)) {
            sendError(res, 400, "seed must be a whole number from 0 to 4294967295");
            return;
        }
        bool capped = n > static_cast<long>(Benchmark::MAX_N);
        BenchmarkResult r = Benchmark::run(static_cast<size_t>(n), static_cast<unsigned>(seed));
        std::ostringstream ss;
        ss << "{\"n\":" << r.n << ",\"seed\":" << r.seed << ",\"runs\":" << r.runs
           << ",\"capped\":" << (capped ? "true" : "false") << ",\"timing\":\"best of " << r.runs << ", steady_clock\",\"results\":[";
        for (size_t i = 0; i < r.tasks.size(); ++i) {
            const BenchmarkTask& t = r.tasks[i];
            if (i) ss << ",";
            ss << "{\"task\":" << jsonString(t.task) << ",\"steps\":" << jsonString(t.stepsMean)
               << ",\"queries\":" << t.queries << ",\"sameAnswer\":" << (t.sameAnswer ? "true" : "false") << ",\"variants\":[";
            for (size_t j = 0; j < t.variants.size(); ++j) {
                const BenchmarkVariant& v = t.variants[j];
                long long tenths = std::llround(v.micros * 10.0); // fixed notation, one decimal
                if (j) ss << ",";
                ss << "{\"name\":" << jsonString(v.name) << ",\"steps\":" << v.steps
                   << ",\"micros\":" << tenths / 10 << "." << tenths % 10 << "}";
            }
            ss << "]}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // GET /triage -> the heap array (index order) and the patients in priority order
    svr.Get("/triage", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        auto item = [&](const TriageItem& t) {
            const Patient* p = system.findPatient(t.id);
            return "{\"patient_id\":" + jsonString(t.id) + ",\"name\":" + (p ? jsonString(p->getName()) : string("null")) +
                   ",\"risk\":" + jsonNumber(t.risk) + ",\"arrival\":" + std::to_string(t.arrival) + "}";
        };
        auto heap = system.triageHeapArray();
        auto sorted = system.triageSorted();
        std::ostringstream ss;
        ss << "{\"size\":" << heap.size() << ",\"heap\":[";
        for (size_t i = 0; i < heap.size(); ++i) ss << (i ? "," : "") << item(heap[i]);
        ss << "],\"sorted\":[";
        for (size_t i = 0; i < sorted.size(); ++i) ss << (i ? "," : "") << item(sorted[i]);
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // POST /triage {"patient_id"} -> push into the priority queue by consensus risk
    svr.Post("/triage", [&](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        JsonValue body;
        if (!readBody(req, res, body)) return;
        string pid = stringField(body, "patient_id");
        if (pid.empty()) {
            sendError(res, 400, "Missing patient_id");
            return;
        }
        string error;
        int status = system.triagePush(pid, error);
        if (status != 200) {
            sendError(res, status, error);
            return;
        }
        const Patient* p = system.findPatient(pid);
        sendJson(res, 200, "{\"success\":true,\"patient_id\":" + jsonString(pid) + ",\"risk\":" +
                               jsonNumber(p->getRiskScore()) + ",\"size\":" +
                               std::to_string(system.triageHeapArray().size()) + "}");
    });

    // POST /triage/process -> pops every patient, highest risk first
    svr.Post("/triage/process", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        auto results = system.triageProcess();
        std::ostringstream ss;
        ss << "{\"processed\":" << results.size() << ",\"results\":[";
        for (size_t i = 0; i < results.size(); ++i) {
            const auto& r = results[i];
            if (i) ss << ",";
            ss << "{\"rank\":" << (i + 1) << ",\"patient_id\":" << jsonString(r.patient->getPatientId())
               << ",\"name\":" << jsonString(r.patient->getName()) << ",\"risk\":" << jsonNumber(r.risk)
               << ",\"prediction\":" << r.prediction << "}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    // GET /hashmap -> buckets of the gene hash table (separate chaining)
    svr.Get("/hashmap", [&](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(systemMutex);
        const HashMapper& map = system.getGenes();
        std::ostringstream ss;
        ss << "{\"bucketCount\":" << map.bucketCount() << ",\"size\":" << map.size()
           << ",\"loadFactor\":" << jsonNumber(map.loadFactor()) << ",\"buckets\":[";
        for (size_t i = 0; i < map.bucketCount(); ++i) {
            if (i) ss << ",";
            ss << "{\"index\":" << i << ",\"items\":[";
            bool first = true;
            for (const HashNode* node = map.bucketHead(i); node; node = node->next.get()) {
                if (!first) ss << ",";
                first = false;
                ss << "{\"key\":" << jsonString(node->key) << ",\"value\":" << jsonNumber(node->value)
                   << ",\"hash\":" << HashMapper::hashKey(node->key) << "}";
            }
            ss << "]}";
        }
        ss << "]}";
        sendJson(res, 200, ss.str());
    });

    std::cout << "Starting server on http://localhost:8080 ..." << std::endl;
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

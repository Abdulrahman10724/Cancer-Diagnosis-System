#include "../headers/CancerDiagnosisSystem.h"
#include "../headers/Sampling.h"
#include <cmath>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>

namespace {
const unsigned EVAL_SEED = 42;
const double TEST_RATIO = 0.2;
}

CancerDiagnosisSystem::CancerDiagnosisSystem()
    : head(nullptr), tail(nullptr), patientCount(0), hasDataset(false), triageArrivals(0) {}

// ---------------------------------------------------------------- dataset

bool CancerDiagnosisSystem::loadDataset(const DatasetFiles& f, const std::string& name,
                                        std::vector<std::string>& problems) {
    DatasetContent content;
    if (!DatasetLoader::readFiles(f, content, problems)) return false;
    return loadContent(content, f, name, problems);
}

bool CancerDiagnosisSystem::loadContent(const DatasetContent& content, const DatasetFiles& f,
                                        const std::string& name, std::vector<std::string>& problems) {
    // Parse into a fresh object; the active dataset is only replaced when it is valid
    LoadedDataset data;
    if (!DatasetLoader::parse(content, data, problems)) return false;
    install(data, f, name);
    return true;
}

void CancerDiagnosisSystem::install(LoadedDataset& data, const DatasetFiles& f, const std::string& name) {
    head = nullptr;
    tail = nullptr;
    patientCount = 0;
    genes = std::move(data.genes);
    geneOrder = std::move(data.geneOrder);
    for (const auto& p : data.patients) appendPatient(p);
    files = f;
    datasetName = name;
    hasDataset = true;
    testQueue.clear();
    triage.clear();
    undoStack.clear();
    retrain();
}

void CancerDiagnosisSystem::appendPatient(const Patient& p) {
    auto node = std::make_shared<PatientNode>(p);
    refreshFeatures(node->patient);
    PatientNode* raw = node.get();
    if (tail) tail->next = node;
    else head = node;
    tail = raw;
    patientCount++;
}

void CancerDiagnosisSystem::refreshFeatures(Patient& p) const {
    p.setFeatures(FeatureExtractor::extract(p, genes));
}

bool CancerDiagnosisSystem::hasData() const { return hasDataset; }
const std::string& CancerDiagnosisSystem::getDatasetName() const { return datasetName; }
const DatasetFiles& CancerDiagnosisSystem::getFiles() const { return files; }

// ---------------------------------------------------------------- training

void CancerDiagnosisSystem::retrain() {
    trainPatients.clear();
    Xraw.clear();
    y.clear();
    int classCount[2] = {0, 0};
    for (PatientNode* n = head.get(); n; n = n->next.get()) {
        if (!n->patient.isLabelled()) continue;
        trainPatients.push_back(&n->patient);
        Xraw.push_back(n->patient.getFeatures());
        y.push_back(n->patient.getDiagnosis());
        classCount[n->patient.getDiagnosis()]++;
    }
    models.trained = false;
    if (Xraw.size() >= 2 && classCount[0] > 0 && classCount[1] > 0) {
        try {
            models.train(Xraw, y);
        } catch (const std::exception& e) {
            std::cerr << "Training failed: " << e.what() << std::endl;
            models.trained = false;
        }
    }
    refreshRisks();
}

void CancerDiagnosisSystem::refreshRisks() {
    for (PatientNode* n = head.get(); n; n = n->next.get()) {
        if (!models.trained) {
            n->patient.clearRisk();
            continue;
        }
        std::vector<double> scaled = models.scaler.transform(n->patient.getFeatures());
        double sum = 0.0;
        for (int m = 0; m < ModelSet::NUM_MODELS; ++m) sum += models.riskScaled(m, scaled);
        double mean = sum / ModelSet::NUM_MODELS;
        n->patient.setRisk(mean, mean >= 0.5 ? 1 : 0);
    }
    rebuildIndexes();
    rebuildTriage();
}

void CancerDiagnosisSystem::rebuildTriage() {
    // Risks change after retraining: push every waiting patient again with its new risk
    std::vector<TriageItem> items = triage.toArray();
    triage.clear();
    for (auto& item : items) {
        const Patient* p = findPatient(item.id);
        if (!p || !p->getHasRisk()) continue;
        item.risk = p->getRiskScore();
        triage.push(item);
    }
}

void CancerDiagnosisSystem::rebuildIndexes() {
    idIndex.clear();
    riskIndex.clear();
    for (PatientNode* n = head.get(); n; n = n->next.get()) {
        idIndex.insert(n->patient.getPatientId(), &n->patient);
        if (n->patient.getHasRisk()) {
            riskIndex.insert(RiskKey{n->patient.getRiskScore(), n->patient.getPatientId()}, &n->patient);
        }
    }
}

bool CancerDiagnosisSystem::areModelsTrained() const { return models.trained; }
const ModelSet& CancerDiagnosisSystem::getModels() const { return models; }
size_t CancerDiagnosisSystem::getLabelledCount() const { return trainPatients.size(); }
const std::vector<const Patient*>& CancerDiagnosisSystem::getTrainPatients() const { return trainPatients; }

// ---------------------------------------------------------------- patients

size_t CancerDiagnosisSystem::getPatientCount() const { return patientCount; }

std::vector<const Patient*> CancerDiagnosisSystem::patientsInOrder() const {
    std::vector<const Patient*> out;
    out.reserve(patientCount);
    for (PatientNode* n = head.get(); n; n = n->next.get()) out.push_back(&n->patient);
    return out;
}

const Patient* CancerDiagnosisSystem::findPatient(const std::string& id) const {
    Patient* p = nullptr;
    return idIndex.find(id, &p) ? p : nullptr;
}

const Patient* CancerDiagnosisSystem::findPatientLinear(const std::string& id) const {
    for (PatientNode* n = head.get(); n; n = n->next.get()) {
        if (n->patient.getPatientId() == id) return &n->patient;
    }
    return nullptr;
}

bool CancerDiagnosisSystem::indexLookup(const std::string& id, std::vector<std::string>& path, int& steps,
                                        int& height) const {
    path.clear();
    steps = 0;
    height = idIndex.height();
    return idIndex.find(id, nullptr, &path, &steps);
}

std::vector<const Patient*> CancerDiagnosisSystem::riskRange(double lo, double hi, int& visited) const {
    visited = 0;
    // Smallest and largest possible IDs bound the range on the second key
    RiskKey from{lo, ""};
    RiskKey to{hi, std::string(64, '\xff')};
    std::vector<const Patient*> out;
    for (const auto& entry : riskIndex.rangeQuery(from, to, &visited)) out.push_back(entry.second);
    return out;
}

bool CancerDiagnosisSystem::searchPatientTrace(const std::string& id, std::vector<std::string>& visitedOrder) const {
    visitedOrder.clear();
    for (PatientNode* n = head.get(); n; n = n->next.get()) {
        visitedOrder.push_back(n->patient.getPatientId());
        if (n->patient.getPatientId() == id) return true;
    }
    return false;
}

static bool validId(const std::string& id) {
    if (id.empty() || id.size() > 40) return false;
    for (char c : id) {
        if (c == ',' || c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '"') return false;
    }
    return true;
}

int CancerDiagnosisSystem::addPatient(const NewPatientInput& in, std::vector<GeneReport>& report,
                                      std::string& error) {
    report.clear();
    if (!hasDataset) {
        error = "Load data first";
        return 400;
    }
    if (!validId(in.id)) {
        error = "patient_id must be 1 to 40 characters with no spaces, commas or quotes";
        return 400;
    }
    if (in.name.empty() || in.name.find(',') != std::string::npos || in.name.find('\n') != std::string::npos) {
        error = "name must not be empty and must not contain commas";
        return 400;
    }
    if (in.age < 0 || in.age > 120) {
        error = "age must be a whole number from 0 to 120";
        return 400;
    }
    if (in.genes.empty()) {
        error = "A patient needs at least one gene";
        return 400;
    }
    if (findPatient(in.id)) {
        error = "Patient ID already exists";
        return 409;
    }
    // Check every gene before changing anything
    for (size_t i = 0; i < in.genes.size(); ++i) {
        const NewGene& g = in.genes[i];
        if (!validId(g.geneId)) {
            error = "geneId must be 1 to 40 characters with no spaces, commas or quotes";
            return 400;
        }
        for (size_t j = 0; j < i; ++j) {
            if (in.genes[j].geneId == g.geneId) {
                error = "Gene '" + g.geneId + "' is listed twice";
                return 400;
            }
        }
        double stored = 0.0;
        if (!genes.get(g.geneId, stored)) {
            if (!g.hasScore) {
                error = "Gene '" + g.geneId + "' is new, so it needs a mutationScore";
                return 400;
            }
            if (g.score < 0.0 || g.score > 1.0) {
                error = "mutationScore for '" + g.geneId + "' must be from 0 to 1";
                return 400;
            }
        }
    }

    Patient p(in.id, in.name, in.age, in.diagnosis);
    for (const NewGene& g : in.genes) {
        double stored = 0.0;
        GeneReport r;
        r.geneId = g.geneId;
        r.sentScore = g.hasScore ? g.score : -1.0;
        if (genes.get(g.geneId, stored)) {
            r.existed = true;
            r.usedScore = stored;
            r.scoreIgnored = g.hasScore && std::fabs(g.score - stored) > 1e-12;
        } else {
            genes.put(g.geneId, g.score);
            geneOrder.push_back(g.geneId);
            r.existed = false;
            r.usedScore = g.score;
            r.scoreIgnored = false;
        }
        report.push_back(r);
        p.addGeneId(g.geneId);
    }
    appendPatient(p);
    UndoRecord record;
    record.type = UndoRecord::ADD;
    record.patient = p;
    record.position = patientCount - 1;
    for (const auto& r : report) {
        if (!r.existed) record.newGenes.push_back(r.geneId);
    }
    pushUndo(record);
    afterChange(p.isLabelled());
    return 200;
}

void CancerDiagnosisSystem::afterChange(bool labelledChanged) {
    // Labelled patients change the training data; others only need risks and indexes
    if (labelledChanged) retrain();
    else refreshRisks();
    std::string saveError;
    if (!saveDataset(saveError)) {
        std::cerr << "Warning: " << saveError << std::endl;
    }
}

void CancerDiagnosisSystem::pushUndo(const UndoRecord& record) {
    undoStack.push(record);
    while (undoStack.size() > MAX_UNDO) undoStack.dropBottom();
}

bool CancerDiagnosisSystem::unlinkPatient(const std::string& id, Patient& removed, size_t& position) {
    PatientNode* prev = nullptr;
    position = 0;
    for (PatientNode* n = head.get(); n; n = n->next.get(), ++position) {
        if (n->patient.getPatientId() != id) {
            prev = n;
            continue;
        }
        removed = n->patient;
        if (tail == n) tail = prev; // before unlinking: n may be freed below
        std::shared_ptr<PatientNode> rest = n->next;
        if (prev) prev->next = rest;
        else head = rest;
        patientCount--;
        return true;
    }
    return false;
}

void CancerDiagnosisSystem::insertPatientAt(const Patient& p, size_t position) {
    if (position >= patientCount) {
        appendPatient(p);
        return;
    }
    auto node = std::make_shared<PatientNode>(p);
    refreshFeatures(node->patient);
    if (position == 0) {
        node->next = head;
        head = node;
    } else {
        PatientNode* prev = head.get();
        for (size_t i = 1; i < position; ++i) prev = prev->next.get();
        node->next = prev->next;
        prev->next = node;
    }
    patientCount++;
}

int CancerDiagnosisSystem::deletePatient(const std::string& id, std::string& error) {
    Patient removed;
    size_t position = 0;
    if (!unlinkPatient(id, removed, position)) {
        error = "Patient ID '" + id + "' not found";
        return 404;
    }
    testQueue.removeAll(id);
    UndoRecord record;
    record.type = UndoRecord::DELETE;
    record.patient = removed;
    record.position = position;
    pushUndo(record);
    afterChange(removed.isLabelled());
    return 200;
}

bool CancerDiagnosisSystem::undo(std::string& description) {
    if (undoStack.empty()) return false;
    UndoRecord record = undoStack.pop();
    if (record.type == UndoRecord::ADD) {
        Patient removed;
        size_t position = 0;
        unlinkPatient(record.patient.getPatientId(), removed, position);
        testQueue.removeAll(record.patient.getPatientId());
        // Remove genes that this add created, unless another patient now uses them
        for (const auto& gid : record.newGenes) {
            bool used = false;
            for (PatientNode* n = head.get(); n && !used; n = n->next.get()) {
                for (const auto& g : n->patient.getGeneIds()) {
                    if (g == gid) {
                        used = true;
                        break;
                    }
                }
            }
            if (used) continue;
            genes.erase(gid);
            for (size_t i = 0; i < geneOrder.size(); ++i) {
                if (geneOrder[i] == gid) {
                    geneOrder.erase(geneOrder.begin() + static_cast<long>(i));
                    break;
                }
            }
        }
        description = "add " + record.patient.getPatientId();
    } else {
        insertPatientAt(record.patient, record.position);
        description = "delete " + record.patient.getPatientId();
    }
    afterChange(record.patient.isLabelled());
    return true;
}

size_t CancerDiagnosisSystem::undoDepth() const { return undoStack.size(); }

const HashMapper& CancerDiagnosisSystem::getGenes() const { return genes; }
const std::vector<std::string>& CancerDiagnosisSystem::getGeneOrder() const { return geneOrder; }

// ---------------------------------------------------------------- saving

bool CancerDiagnosisSystem::writeFileSafely(const std::string& path, const std::string& content,
                                            std::string& error) const {
    // Write a temporary file first, then rename it over the old one, so a crash
    // never leaves a half-written CSV behind.
    std::string tmp = path + ".tmp";
    {
        std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
        if (!out.is_open()) {
            error = "Could not write " + tmp;
            return false;
        }
        out << content;
        out.flush();
        if (!out) {
            error = "Could not write " + tmp;
            return false;
        }
    }
    if (std::rename(tmp.c_str(), path.c_str()) != 0) {
        // Windows cannot rename over an existing file: remove it first
        std::remove(path.c_str());
        if (std::rename(tmp.c_str(), path.c_str()) != 0) {
            error = "Could not replace " + path;
            return false;
        }
    }
    return true;
}

bool CancerDiagnosisSystem::saveDataset(std::string& error) const {
    if (!hasDataset) {
        error = "No dataset loaded";
        return false;
    }
    std::ostringstream g;
    g << "Gene_ID,Mutation_Score\n";
    for (const auto& id : geneOrder) {
        double s = 0.0;
        if (genes.get(id, s)) {
            char buf[32];
            std::snprintf(buf, sizeof(buf), "%.4f", s);
            g << id << "," << buf << "\n";
        }
    }
    std::ostringstream p;
    std::ostringstream pg;
    p << "Patient_ID,Name,Age,Diagnosis\n";
    pg << "Patient_ID,Gene_ID\n";
    for (PatientNode* n = head.get(); n; n = n->next.get()) {
        const Patient& pt = n->patient;
        p << pt.getPatientId() << "," << pt.getName() << "," << pt.getAge() << ",";
        if (pt.isLabelled()) p << pt.getDiagnosis();
        p << "\n";
        for (const auto& gid : pt.getGeneIds()) pg << pt.getPatientId() << "," << gid << "\n";
    }
    return writeFileSafely(files.genes, g.str(), error) &&
           writeFileSafely(files.patients, p.str(), error) &&
           writeFileSafely(files.patientGenes, pg.str(), error);
}

// ---------------------------------------------------------------- diagnosis

double CancerDiagnosisSystem::modelRisk(const Patient& patient, int model, int k) const {
    if (!models.trained) return 0.0;
    return models.risk(model, patient.getFeatures(), k);
}

bool CancerDiagnosisSystem::diagnose(const Patient& patient, int k, Diagnosis& out) const {
    if (!models.trained) return false;
    const int F = FeatureExtractor::NUM_FEATURES;
    out.raw = patient.getFeatures();
    out.scaled = models.scaler.transform(out.raw);

    // Logistic regression: z = bias + sum(weight_i * scaled_i)
    std::vector<double> w = models.logistic.getWeights();
    out.lrBias = models.logistic.getBias();
    out.lrZ = out.lrBias;
    out.lrContributions.clear();
    for (int j = 0; j < F; ++j) {
        LogisticContribution c;
        c.feature = j;
        c.weight = w[j];
        c.value = out.scaled[j];
        c.product = w[j] * out.scaled[j];
        out.lrZ += c.product;
        out.lrContributions.push_back(c);
    }
    out.risk[ModelSet::LOGISTIC] = models.logistic.predictProbabilitySingle(out.scaled);

    // KNN: K nearest labelled patients in the standardized space
    long visited = 0;
    auto nearest = models.knn.findNeighbors(out.scaled, k, KNNClassifier::KD_TREE, &visited);
    out.k = static_cast<int>(nearest.size());
    out.neighbors.clear();
    out.votesCancer = 0;
    out.votesSafe = 0;
    for (const auto& n : nearest) {
        NeighborInfo info;
        info.patient = trainPatients[n.second];
        info.distance = n.first;
        out.neighbors.push_back(info);
        if (y[n.second] == 1) out.votesCancer++;
        else out.votesSafe++;
    }
    out.kdNodesVisited = visited;
    out.risk[ModelSet::KNN] = nearest.empty() ? 0.0 : static_cast<double>(out.votesCancer) / nearest.size();

    // Decision tree: the questions on the way to the leaf
    auto path = models.tree.getDecisionPath(out.scaled);
    out.path.clear();
    for (const auto& node : path) {
        if (node->featureIndex == -1) break;
        TreeStepInfo s;
        s.feature = node->featureIndex;
        s.threshold = node->threshold;
        s.thresholdRaw = models.scaler.inverseValue(static_cast<size_t>(node->featureIndex), node->threshold);
        s.value = out.raw[node->featureIndex];
        s.wentLeft = out.scaled[node->featureIndex] <= node->threshold;
        out.path.push_back(s);
    }
    out.leafSamples = path.back()->sampleCount;
    out.leafPositiveFraction = path.back()->positiveFraction;
    out.risk[ModelSet::DECISION_TREE] = models.tree.predictProbabilitySingle(out.scaled);

    // Naive Bayes: class statistics converted back to raw units
    const auto& means = models.scaler.getMeans();
    const auto& stds = models.scaler.getStds();
    for (int c = 0; c < 2; ++c) {
        out.nbPrior[c] = models.bayes.getPrior(c);
        for (int j = 0; j < F; ++j) {
            out.nbMeanRaw[c][j] = models.bayes.getMean(c, j) * stds[j] + means[j];
            out.nbStdRaw[c][j] = models.bayes.getStd(c, j) * stds[j];
        }
    }
    out.risk[ModelSet::NAIVE_BAYES] = models.bayes.predictProbabilitySingle(out.scaled);

    out.cancerVotes = 0;
    double sum = 0.0;
    for (int m = 0; m < ModelSet::NUM_MODELS; ++m) {
        sum += out.risk[m];
        if (out.risk[m] >= 0.5) out.cancerVotes++;
    }
    out.meanRisk = sum / ModelSet::NUM_MODELS;
    return true;
}

// ---------------------------------------------------------------- evaluation

bool CancerDiagnosisSystem::evaluate(EvaluationResult& out) const {
    if (!models.trained) return false;
    std::vector<size_t> trainIdx;
    std::vector<size_t> testIdx;
    Sampling::stratifiedSplit(y, TEST_RATIO, EVAL_SEED, trainIdx, testIdx);
    if (trainIdx.empty() || testIdx.empty()) return false;

    std::vector<std::vector<double>> Xtr;
    std::vector<int> ytr;
    for (size_t i : trainIdx) {
        Xtr.push_back(Xraw[i]);
        ytr.push_back(y[i]);
    }
    // Fresh models trained only on the 80%; the live models are not touched
    ModelSet fresh;
    try {
        fresh.train(Xtr, ytr);
    } catch (const std::exception&) {
        return false;
    }

    EvaluationMetrics metrics;
    out.trainCount = trainIdx.size();
    out.testCount = testIdx.size();
    out.seed = EVAL_SEED;
    out.models.clear();
    std::vector<int> yTest;
    for (size_t i : testIdx) yTest.push_back(y[i]);

    for (int m = 0; m < ModelSet::NUM_MODELS; ++m) {
        ModelEvaluation e;
        e.model = m;
        std::vector<int> yPred;
        for (size_t i : testIdx) {
            double r = fresh.risk(m, Xraw[i]);
            EvalSample s;
            s.patient = trainPatients[i];
            s.label = y[i];
            s.risk = r;
            e.samples.push_back(s);
            yPred.push_back(r >= 0.5 ? 1 : 0);
        }
        e.accuracy = metrics.accuracy(yTest, yPred);
        e.precision = metrics.precision(yTest, yPred);
        e.recall = metrics.recall(yTest, yPred);
        e.f1 = metrics.f1Score(yTest, yPred);
        e.confusion = metrics.getConfusionMatrix(yTest, yPred);
        std::vector<double> risks;
        for (const auto& smp : e.samples) risks.push_back(smp.risk);
        e.roc = EvaluationMetrics::rocCurve(yTest, risks, e.auc);
        out.models.push_back(e);
    }
    return true;
}

bool CancerDiagnosisSystem::crossValidate(int k, CrossValidationResult& out) const {
    if (!models.trained || k < 2 || static_cast<size_t>(k) > y.size()) return false;
    // folds[f] = test indices of fold f (a 2D index array)
    std::vector<std::vector<size_t>> folds = Sampling::stratifiedFolds(y, k, EVAL_SEED);
    out.k = k;
    out.seed = EVAL_SEED;
    out.foldSizes.clear();
    for (int m = 0; m < ModelSet::NUM_MODELS; ++m) out.folds[m].clear();
    EvaluationMetrics metrics;

    for (int f = 0; f < k; ++f) {
        std::vector<char> inTest(y.size(), 0);
        for (size_t i : folds[static_cast<size_t>(f)]) inTest[i] = 1;
        std::vector<std::vector<double>> Xtr;
        std::vector<int> ytr;
        std::vector<int> yTest;
        for (size_t i = 0; i < y.size(); ++i) {
            if (inTest[i]) {
                yTest.push_back(y[i]);
            } else {
                Xtr.push_back(Xraw[i]);
                ytr.push_back(y[i]);
            }
        }
        out.foldSizes.push_back(yTest.size());
        ModelSet fresh;
        try {
            fresh.train(Xtr, ytr);
        } catch (const std::exception&) {
            return false;
        }
        for (int m = 0; m < ModelSet::NUM_MODELS; ++m) {
            std::vector<int> yPred;
            for (size_t i : folds[static_cast<size_t>(f)]) yPred.push_back(fresh.risk(m, Xraw[i]) >= 0.5 ? 1 : 0);
            out.folds[m].push_back({metrics.accuracy(yTest, yPred), metrics.precision(yTest, yPred),
                                    metrics.recall(yTest, yPred), metrics.f1Score(yTest, yPred)});
        }
    }
    // Mean and sample standard deviation over the folds
    for (int m = 0; m < ModelSet::NUM_MODELS; ++m) {
        for (int j = 0; j < 4; ++j) {
            double sum = 0.0;
            for (const auto& fold : out.folds[m]) sum += fold[static_cast<size_t>(j)];
            double mean = sum / k;
            double var = 0.0;
            for (const auto& fold : out.folds[m]) {
                double d = fold[static_cast<size_t>(j)] - mean;
                var += d * d;
            }
            out.mean[m][j] = mean;
            out.stdDev[m][j] = std::sqrt(var / (k - 1));
        }
    }
    return true;
}

bool CancerDiagnosisSystem::featureStats(FeatureStats& out) const {
    if (!models.trained || Xraw.empty()) return false;
    const int F = FeatureStats::F;
    const int B = FeatureStats::BINS;
    const size_t n = Xraw.size();
    out.count[0] = out.count[1] = 0;
    for (int label : y) out.count[label == 1 ? 1 : 0]++;

    auto summarize = [&](int cls, int j) {
        // cls -1 = all labelled patients
        FeatureSummary s{0.0, 0.0, 0.0, 0.0};
        size_t c = 0;
        for (size_t i = 0; i < n; ++i) {
            if (cls >= 0 && y[i] != cls) continue;
            double v = Xraw[i][static_cast<size_t>(j)];
            if (c == 0) s.min = s.max = v;
            if (v < s.min) s.min = v;
            if (v > s.max) s.max = v;
            s.mean += v;
            c++;
        }
        if (c == 0) return s;
        s.mean /= c;
        for (size_t i = 0; i < n; ++i) {
            if (cls >= 0 && y[i] != cls) continue;
            double d = Xraw[i][static_cast<size_t>(j)] - s.mean;
            s.stdDev += d * d;
        }
        s.stdDev = c > 1 ? std::sqrt(s.stdDev / (c - 1)) : 0.0;
        return s;
    };
    for (int j = 0; j < F; ++j) {
        out.overall[j] = summarize(-1, j);
        out.perClass[0][j] = summarize(0, j);
        out.perClass[1][j] = summarize(1, j);
    }

    // Pearson correlation over the 4 features and the diagnosis
    double col[F + 1];
    double means[F + 1];
    double sumSq[F + 1];
    for (int a = 0; a <= F; ++a) {
        means[a] = 0.0;
        sumSq[a] = 0.0;
    }
    for (size_t i = 0; i < n; ++i) {
        for (int a = 0; a < F; ++a) means[a] += Xraw[i][static_cast<size_t>(a)];
        means[F] += y[i];
    }
    for (int a = 0; a <= F; ++a) means[a] /= n;
    double cov[F + 1][F + 1];
    for (int a = 0; a <= F; ++a)
        for (int b = 0; b <= F; ++b) cov[a][b] = 0.0;
    for (size_t i = 0; i < n; ++i) {
        for (int a = 0; a < F; ++a) col[a] = Xraw[i][static_cast<size_t>(a)] - means[a];
        col[F] = y[i] - means[F];
        for (int a = 0; a <= F; ++a)
            for (int b = 0; b <= F; ++b) cov[a][b] += col[a] * col[b];
    }
    for (int a = 0; a <= F; ++a) sumSq[a] = cov[a][a];
    for (int a = 0; a <= F; ++a) {
        for (int b = 0; b <= F; ++b) {
            double denom = std::sqrt(sumSq[a] * sumSq[b]);
            out.correlation[a][b] = denom > 0.0 ? cov[a][b] / denom : (a == b ? 1.0 : 0.0);
        }
    }

    // Feature importance: |logistic weight| normalized, and the tree's Gini decrease
    std::vector<double> w = models.logistic.getWeights();
    double wsum = 0.0;
    for (int j = 0; j < F; ++j) wsum += std::fabs(w[static_cast<size_t>(j)]);
    std::vector<double> treeImp = models.tree.featureImportance();
    for (int j = 0; j < F; ++j) {
        out.importanceLogistic[j] = wsum > 0.0 ? std::fabs(w[static_cast<size_t>(j)]) / wsum : 0.0;
        out.importanceTree[j] = static_cast<size_t>(j) < treeImp.size() ? treeImp[static_cast<size_t>(j)] : 0.0;
    }

    // Histograms: 10 equal-width bins over each feature's range, per class
    for (int j = 0; j < F; ++j) {
        double lo = out.overall[j].min;
        double hi = out.overall[j].max;
        double width = hi > lo ? (hi - lo) / B : 1.0;
        out.binStart[j] = lo;
        out.binWidth[j] = width;
        for (int c = 0; c < 2; ++c)
            for (int b = 0; b < B; ++b) out.histogram[c][j][b] = 0;
        for (size_t i = 0; i < n; ++i) {
            int b = static_cast<int>((Xraw[i][static_cast<size_t>(j)] - lo) / width);
            if (b < 0) b = 0;
            if (b >= B) b = B - 1;
            out.histogram[y[i] == 1 ? 1 : 0][j][b]++;
        }
    }
    return true;
}

// ---------------------------------------------------------------- test queue

bool CancerDiagnosisSystem::enqueue(const std::string& id) {
    if (!findPatient(id)) return false;
    testQueue.push(id);
    return true;
}

size_t CancerDiagnosisSystem::queueSize() const { return testQueue.size(); }

std::vector<std::string> CancerDiagnosisSystem::queuedIds() const { return testQueue.toVector(); }

int CancerDiagnosisSystem::triagePush(const std::string& id, std::string& error) {
    if (!models.trained) {
        error = "Load data first";
        return 400;
    }
    const Patient* p = findPatient(id);
    if (!p) {
        error = "Patient ID '" + id + "' not found";
        return 404;
    }
    for (const auto& item : triage.toArray()) {
        if (item.id == id) {
            error = "Patient '" + id + "' is already in the triage queue";
            return 409;
        }
    }
    // Risks are computed for every patient after training; diagnose now if one is missing
    double risk = p->getHasRisk() ? p->getRiskScore() : 0.0;
    if (!p->getHasRisk()) {
        Diagnosis d;
        diagnose(*p, 0, d);
        risk = d.meanRisk;
    }
    triage.push(TriageItem{risk, triageArrivals++, id});
    return 200;
}

std::vector<TriageItem> CancerDiagnosisSystem::triageHeapArray() const { return triage.toArray(); }

std::vector<TriageItem> CancerDiagnosisSystem::triageSorted() const {
    BinaryHeap<TriageItem, TriageHigher> copy;
    for (const auto& item : triage.toArray()) copy.push(item);
    std::vector<TriageItem> out;
    while (!copy.empty()) out.push_back(copy.pop());
    return out;
}

std::vector<QueueResult> CancerDiagnosisSystem::triageProcess() {
    std::vector<QueueResult> out;
    while (!triage.empty()) {
        TriageItem item = triage.pop();
        const Patient* p = findPatient(item.id);
        if (!p) continue;
        out.push_back(QueueResult{p, item.risk, item.risk >= 0.5 ? 1 : 0});
    }
    return out;
}

std::vector<QueueResult> CancerDiagnosisSystem::processQueue(int model) {
    std::vector<QueueResult> results;
    while (!testQueue.empty()) {
        std::string id = testQueue.pop();
        const Patient* p = findPatient(id);
        if (!p) continue; // deleted while waiting
        QueueResult r;
        r.patient = p;
        r.risk = modelRisk(*p, model);
        r.prediction = r.risk >= 0.5 ? 1 : 0;
        results.push_back(r);
    }
    return results;
}

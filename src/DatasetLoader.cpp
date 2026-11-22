#include "../headers/DatasetLoader.h"
#include <cerrno>
#include <cstdlib>
#include <fstream>
#include <sstream>

namespace {

// Collects problems; keeps at most MAX_PROBLEMS messages and counts the rest
class Problems {
public:
    explicit Problems(std::vector<std::string>& out) : list(out), extra(0) {}
    void add(const std::string& message) {
        if (list.size() < DatasetLoader::MAX_PROBLEMS - 1) list.push_back(message);
        else extra++;
    }
    void finish() {
        if (extra == 1 && list.size() == DatasetLoader::MAX_PROBLEMS - 1) {
            list.push_back("1 more problem not shown");
        } else if (extra > 0) {
            list.push_back(std::to_string(extra) + " more problems not shown");
        }
    }
    bool any() const { return !list.empty(); }
private:
    std::vector<std::string>& list;
    size_t extra;
};

std::string trim(const std::string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return "";
    size_t b = s.find_last_not_of(" \t\r\n");
    return s.substr(a, b - a + 1);
}

std::string lower(const std::string& s) {
    std::string out = s;
    for (char& c : out) {
        if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
    }
    return out;
}

std::vector<std::string> splitFields(const std::string& line) {
    std::vector<std::string> fields;
    std::string current;
    for (char c : line) {
        if (c == ',') {
            fields.push_back(trim(current));
            current.clear();
        } else {
            current.push_back(c);
        }
    }
    fields.push_back(trim(current));
    return fields;
}

struct Line {
    int number;
    std::vector<std::string> fields;
};

// Split text into non-empty lines with their 1-based line numbers
std::vector<Line> readLines(const std::string& text) {
    std::vector<Line> lines;
    std::string current;
    int number = 1;
    for (size_t i = 0; i <= text.size(); ++i) {
        if (i == text.size() || text[i] == '\n') {
            if (!trim(current).empty()) lines.push_back({number, splitFields(current)});
            current.clear();
            number++;
        } else {
            current.push_back(text[i]);
        }
    }
    return lines;
}

bool parseDouble(const std::string& s, double& out) {
    if (s.empty()) return false;
    char* end = nullptr;
    errno = 0;
    double v = std::strtod(s.c_str(), &end);
    if (end != s.c_str() + s.size() || errno == ERANGE) return false;
    if (v != v) return false; // NaN
    out = v;
    return true;
}

bool parseInt(const std::string& s, long& out) {
    if (s.empty()) return false;
    char* end = nullptr;
    errno = 0;
    long v = std::strtol(s.c_str(), &end, 10);
    if (end != s.c_str() + s.size() || errno == ERANGE) return false;
    out = v;
    return true;
}

std::string at(const std::string& file, int line) {
    return file + " line " + std::to_string(line) + ": ";
}

} // namespace

bool DatasetLoader::readFile(const std::string& path, std::string& out) {
    std::ifstream in(path, std::ios::binary);
    if (!in.is_open()) return false;
    std::ostringstream ss;
    ss << in.rdbuf();
    out = ss.str();
    return true;
}

bool DatasetLoader::readFiles(const DatasetFiles& files, DatasetContent& out, std::vector<std::string>& problems) {
    bool ok = true;
    if (!readFile(files.patients, out.patientsCsv)) {
        problems.push_back("patients.csv: file not found (" + files.patients + ")");
        ok = false;
    }
    if (!readFile(files.genes, out.genesCsv)) {
        problems.push_back("genes.csv: file not found (" + files.genes + ")");
        ok = false;
    }
    if (!readFile(files.patientGenes, out.patientGenesCsv)) {
        problems.push_back("patient_genes.csv: file not found (" + files.patientGenes + ")");
        ok = false;
    }
    return ok;
}

bool DatasetLoader::parse(const DatasetContent& content, LoadedDataset& out, std::vector<std::string>& problemList) {
    Problems problems(problemList);
    out = LoadedDataset();

    // ---- genes.csv: Gene_ID,Mutation_Score[,ignored] ----
    HashMapper geneLine; // Gene_ID -> line number, to find duplicates
    std::vector<Line> geneLines = readLines(content.genesCsv);
    if (geneLines.empty()) {
        problems.add("genes.csv: the file is empty");
    } else {
        const auto& h = geneLines[0].fields;
        if (h.size() < 2 || lower(h[0]) != "gene_id" || lower(h[1]) != "mutation_score") {
            problems.add(at("genes.csv", geneLines[0].number) + "expected the header Gene_ID,Mutation_Score");
        } else {
            for (size_t i = 1; i < geneLines.size(); ++i) {
                const Line& l = geneLines[i];
                if (l.fields.size() < 2) {
                    problems.add(at("genes.csv", l.number) + "expected 2 columns, found " + std::to_string(l.fields.size()));
                    continue;
                }
                const std::string& id = l.fields[0];
                double score = 0.0;
                if (id.empty()) {
                    problems.add(at("genes.csv", l.number) + "Gene_ID is empty");
                    continue;
                }
                double firstLine = 0.0;
                if (geneLine.get(id, firstLine)) {
                    problems.add(at("genes.csv", l.number) + "duplicate Gene_ID '" + id + "' (first on line " +
                                 std::to_string(static_cast<int>(firstLine)) + ")");
                    continue;
                }
                geneLine.put(id, l.number);
                if (!parseDouble(l.fields[1], score)) {
                    problems.add(at("genes.csv", l.number) + "mutation score '" + l.fields[1] + "' is not a number");
                    continue;
                }
                if (score < 0.0 || score > 1.0) {
                    problems.add(at("genes.csv", l.number) + "mutation score " + l.fields[1] + " is outside 0 to 1");
                    continue;
                }
                out.genes.put(id, score);
                out.geneOrder.push_back(id);
            }
        }
    }

    // ---- patients.csv: Patient_ID,Name,Age,Diagnosis ----
    HashMapper patientIndex; // Patient_ID -> index in out.patients
    std::vector<int> patientLineNo;
    std::vector<Line> patientLines = readLines(content.patientsCsv);
    if (patientLines.empty()) {
        problems.add("patients.csv: the file is empty");
    } else {
        const auto& h = patientLines[0].fields;
        bool headerOk = h.size() >= 4 && lower(h[0]) == "patient_id" && lower(h[1]) == "name" &&
                        lower(h[2]) == "age" && lower(h[3]) == "diagnosis";
        if (!headerOk) {
            problems.add(at("patients.csv", patientLines[0].number) +
                         "expected the header Patient_ID,Name,Age,Diagnosis");
        } else {
            HashMapper patientLine;
            for (size_t i = 1; i < patientLines.size(); ++i) {
                const Line& l = patientLines[i];
                // A missing last column means an unknown diagnosis
                if (l.fields.size() != 4 && l.fields.size() != 3) {
                    problems.add(at("patients.csv", l.number) + "expected 4 columns, found " +
                                 std::to_string(l.fields.size()) + " (names cannot contain commas)");
                    continue;
                }
                const std::string& id = l.fields[0];
                const std::string& name = l.fields[1];
                bool rowOk = true;
                if (id.empty()) {
                    problems.add(at("patients.csv", l.number) + "Patient_ID is empty");
                    continue;
                }
                double firstLine = 0.0;
                if (patientLine.get(id, firstLine)) {
                    problems.add(at("patients.csv", l.number) + "duplicate Patient_ID '" + id + "' (first on line " +
                                 std::to_string(static_cast<int>(firstLine)) + ")");
                    continue;
                }
                patientLine.put(id, l.number);
                if (name.empty()) {
                    problems.add(at("patients.csv", l.number) + "name is empty");
                    rowOk = false;
                }
                long age = 0;
                if (!parseInt(l.fields[2], age)) {
                    problems.add(at("patients.csv", l.number) + "age '" + l.fields[2] + "' is not a whole number");
                    rowOk = false;
                } else if (age < 0 || age > 120) {
                    problems.add(at("patients.csv", l.number) + "age " + l.fields[2] + " is outside 0 to 120");
                    rowOk = false;
                }
                int diagnosis = Patient::UNKNOWN;
                std::string d = l.fields.size() == 4 ? l.fields[3] : "";
                if (d == "1") diagnosis = 1;
                else if (d == "0") diagnosis = 0;
                else if (!d.empty()) {
                    problems.add(at("patients.csv", l.number) + "diagnosis '" + d + "' must be 0, 1 or empty");
                    rowOk = false;
                }
                if (!rowOk) continue;
                patientIndex.put(id, static_cast<double>(out.patients.size()));
                patientLineNo.push_back(l.number);
                out.patients.push_back(Patient(id, name, static_cast<int>(age), diagnosis));
            }
        }
    }

    // ---- patient_genes.csv: Patient_ID,Gene_ID ----
    std::vector<Line> linkLines = readLines(content.patientGenesCsv);
    if (linkLines.empty()) {
        problems.add("patient_genes.csv: the file is empty");
    } else {
        const auto& h = linkLines[0].fields;
        if (h.size() < 2 || lower(h[0]) != "patient_id" || lower(h[1]) != "gene_id") {
            problems.add(at("patient_genes.csv", linkLines[0].number) + "expected the header Patient_ID,Gene_ID");
        } else {
            HashMapper seenLinks;
            for (size_t i = 1; i < linkLines.size(); ++i) {
                const Line& l = linkLines[i];
                if (l.fields.size() != 2) {
                    problems.add(at("patient_genes.csv", l.number) + "expected 2 columns, found " +
                                 std::to_string(l.fields.size()));
                    continue;
                }
                const std::string& pid = l.fields[0];
                const std::string& gid = l.fields[1];
                double idx = 0.0;
                double unused = 0.0;
                bool patientKnown = patientIndex.get(pid, idx);
                bool geneKnown = out.genes.get(gid, unused);
                if (!patientKnown) {
                    problems.add(at("patient_genes.csv", l.number) + "unknown patient '" + pid + "'");
                }
                if (!geneKnown) {
                    problems.add(at("patient_genes.csv", l.number) + "unknown gene '" + gid + "'");
                }
                if (!patientKnown || !geneKnown) continue;
                std::string linkKey = pid + '\x1f' + gid;
                if (!seenLinks.put(linkKey, 1.0)) {
                    problems.add(at("patient_genes.csv", l.number) + "patient '" + pid + "' already has gene '" + gid + "'");
                    continue;
                }
                out.patients[static_cast<size_t>(idx)].addGeneId(gid);
            }
        }
    }

    // ---- whole-dataset checks ----
    for (size_t i = 0; i < out.patients.size(); ++i) {
        if (out.patients[i].getGeneIds().empty()) {
            problems.add(at("patients.csv", patientLineNo[i]) + "patient '" + out.patients[i].getPatientId() +
                         "' has no genes in patient_genes.csv");
        }
        if (out.patients[i].isLabelled()) {
            out.labelledCount++;
            if (out.patients[i].getDiagnosis() == 1) out.cancerCount++;
        }
    }
    if (!patientLines.empty() && out.labelledCount < MIN_LABELLED) {
        problems.add("patients.csv: at least " + std::to_string(MIN_LABELLED) +
                     " patients need a diagnosis (0 or 1); found " + std::to_string(out.labelledCount));
    } else if (out.labelledCount > 0 && (out.cancerCount == 0 || out.cancerCount == out.labelledCount)) {
        problems.add("patients.csv: the labelled patients need both diagnoses (some 0 and some 1)");
    }

    problems.finish();
    return !problems.any();
}

#include "../headers/DatasetStore.h"
#include <filesystem>
#include <fstream>

namespace fs = std::filesystem;

const char* DatasetStore::UPLOAD_ROOT = "data/uploads";

bool DatasetStore::validName(const std::string& name) {
    if (name.empty() || name.size() > 40) return false;
    for (char c : name) {
        bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-';
        if (!ok) return false;
    }
    return name != "default";
}

DatasetFiles DatasetStore::filesFor(const std::string& name) {
    if (name == "default") return DatasetFiles{"data/patients.csv", "data/genes.csv", "data/patient_genes.csv"};
    std::string dir = std::string(UPLOAD_ROOT) + "/" + name;
    return DatasetFiles{dir + "/patients.csv", dir + "/genes.csv", dir + "/patient_genes.csv"};
}

bool DatasetStore::exists(const std::string& name) {
    if (name == "default") return true;
    if (!validName(name)) return false;
    std::error_code ec;
    return fs::is_directory(fs::path(UPLOAD_ROOT) / name, ec);
}

std::vector<std::string> DatasetStore::uploadNames() {
    std::vector<std::string> names;
    std::error_code ec;
    if (!fs::is_directory(UPLOAD_ROOT, ec)) return names;
    for (const auto& entry : fs::directory_iterator(UPLOAD_ROOT, ec)) {
        if (!entry.is_directory(ec)) continue;
        std::string n = entry.path().filename().string();
        if (!validName(n)) continue;
        // Insertion sort keeps the list in name order (a handful of folders)
        size_t i = names.size();
        names.push_back(n);
        while (i > 0 && names[i - 1] > n) {
            names[i] = names[i - 1];
            i--;
        }
        names[i] = n;
    }
    return names;
}

bool DatasetStore::writeUpload(const std::string& name, const DatasetContent& content, std::string& error) {
    std::error_code ec;
    fs::path dir = fs::path(UPLOAD_ROOT) / name;
    fs::create_directories(dir, ec);
    if (ec) {
        error = "Could not create " + dir.string();
        return false;
    }
    DatasetFiles f = filesFor(name);
    const std::string* texts[3] = {&content.patientsCsv, &content.genesCsv, &content.patientGenesCsv};
    const std::string* paths[3] = {&f.patients, &f.genes, &f.patientGenes};
    for (int i = 0; i < 3; ++i) {
        std::string tmp = *paths[i] + ".tmp";
        {
            std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
            if (!out) {
                error = "Could not write " + tmp;
                return false;
            }
            out << *texts[i];
        }
        fs::rename(tmp, *paths[i], ec);
        if (ec) {
            error = "Could not write " + *paths[i];
            return false;
        }
    }
    return true;
}

DatasetInfo DatasetStore::describe(const std::string& name) {
    DatasetInfo info{name, false, 0, 0, 0};
    DatasetContent content;
    std::vector<std::string> problems;
    if (!DatasetLoader::readFiles(filesFor(name), content, problems)) return info;
    LoadedDataset data;
    info.valid = DatasetLoader::parse(content, data, problems);
    info.patients = data.patients.size();
    info.labelled = static_cast<size_t>(data.labelledCount);
    info.genes = data.genes.size();
    return info;
}

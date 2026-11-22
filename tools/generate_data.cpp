// cds_datagen: writes a synthetic patient dataset (genes.csv, patients.csv, patient_genes.csv)
//
//   cds_datagen --patients 400 --genes 800 --seed 42 --noise 0.10 --out data [--force]
//
// Every patient gets 3-8 distinct genes. Each patient has a hidden tendency u in [0,1]
// and picks genes whose scores lie near u, so the patient features carry a real signal.
// The diagnosis follows
//   p = sigmoid(-6 + 5*avg + 2.5*max + 0.6*highRisk + 0.03*(age - 50)),  diagnosis = (rand < p)
// and then a --noise fraction of the labels is flipped, so the classes overlap.
// Random numbers come straight from std::mt19937 (its output is fixed by the C++
// standard), so the same seed gives identical files on every compiler.

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <random>
#include <string>
#include <vector>
#include "../headers/FeatureExtractor.h"

namespace {

struct Options {
    int patients = 400;
    int genes = 800;
    unsigned seed = 42;
    double noise = 0.10;
    std::string out = "data";
    bool force = false;
};

class Random {
public:
    explicit Random(unsigned seed) : rng(seed) {}
    double uniform() { return static_cast<double>(rng()) / 4294967296.0; } // [0, 1)
    int between(int lo, int hi) { return lo + static_cast<int>(uniform() * (hi - lo + 1)); } // [lo, hi]
private:
    std::mt19937 rng;
};

bool parseArgs(int argc, char** argv, Options& o) {
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        auto next = [&](std::string& v) {
            if (i + 1 >= argc) return false;
            v = argv[++i];
            return true;
        };
        std::string v;
        char* end = nullptr;
        if (a == "--force") {
            o.force = true;
        } else if (a == "--patients" && next(v)) {
            o.patients = static_cast<int>(std::strtol(v.c_str(), &end, 10));
            if (*end || o.patients < 10 || o.patients > 100000) return false;
        } else if (a == "--genes" && next(v)) {
            o.genes = static_cast<int>(std::strtol(v.c_str(), &end, 10));
            if (*end || o.genes < 8 || o.genes > 1000000) return false;
        } else if (a == "--seed" && next(v)) {
            o.seed = static_cast<unsigned>(std::strtoul(v.c_str(), &end, 10));
            if (*end) return false;
        } else if (a == "--noise" && next(v)) {
            o.noise = std::strtod(v.c_str(), &end);
            if (*end || o.noise < 0.0 || o.noise > 0.5) return false;
        } else if (a == "--out" && next(v)) {
            o.out = v;
        } else {
            return false;
        }
    }
    return true;
}

bool exists(const std::string& path) {
    std::ifstream f(path);
    return f.good();
}

std::string pad(int value, int width) {
    std::string s = std::to_string(value);
    while (static_cast<int>(s.size()) < width) s = "0" + s;
    return s;
}

int digits(int n) {
    int d = 1;
    while (n >= 10) {
        n /= 10;
        d++;
    }
    return d < 3 ? 3 : d;
}

} // namespace

int main(int argc, char** argv) {
    Options o;
    if (!parseArgs(argc, argv, o)) {
        std::cerr << "Usage: cds_datagen --patients 400 --genes 800 --seed 42 --noise 0.10 --out data [--force]\n"
                  << "  --patients 10..100000, --genes 8..1000000, --noise 0..0.5" << std::endl;
        return 2;
    }
    std::string genesPath = o.out + "/genes.csv";
    std::string patientsPath = o.out + "/patients.csv";
    std::string linksPath = o.out + "/patient_genes.csv";
    if (!o.force && (exists(genesPath) || exists(patientsPath) || exists(linksPath))) {
        std::cerr << "Files already exist in " << o.out << ". Use --force to overwrite them." << std::endl;
        return 1;
    }

    Random rnd(o.seed);

    // Genes: scores spread over [0, 1]
    std::vector<double> geneScore(static_cast<size_t>(o.genes));
    for (double& s : geneScore) s = std::round(rnd.uniform() * 10000.0) / 10000.0;
    int gw = digits(o.genes);
    int pw = digits(o.patients);

    static const char* FIRST[] = {"Ali", "Sara", "Omar", "Ayesha", "Bilal", "Fatima", "Hassan", "Zainab", "Usman", "Maryam",
                                  "Ahmed", "Hira", "Imran", "Sana", "Kamran", "Nida", "Tariq", "Amna", "Faisal", "Rabia",
                                  "John", "Emma", "David", "Olivia", "Daniel", "Sofia", "James", "Laila", "Yusuf", "Noor"};
    static const char* LAST[] = {"Khan", "Ahmed", "Malik", "Hussain", "Raza", "Iqbal", "Siddiqui", "Sheikh", "Butt", "Chaudhry",
                                 "Smith", "Brown", "Wilson", "Taylor", "Clarke", "Ali", "Shah", "Qureshi", "Mirza", "Javed"};

    std::ofstream genesOut(genesPath), patientsOut(patientsPath), linksOut(linksPath);
    if (!genesOut || !patientsOut || !linksOut) {
        std::cerr << "Could not write to " << o.out << " (does the folder exist?)" << std::endl;
        return 1;
    }
    genesOut << "Gene_ID,Mutation_Score\n";
    for (int g = 0; g < o.genes; ++g) {
        char buf[32];
        std::snprintf(buf, sizeof(buf), "%.4f", geneScore[static_cast<size_t>(g)]);
        genesOut << "GENE_" << pad(g + 1, gw) << "," << buf << "\n";
    }

    patientsOut << "Patient_ID,Name,Age,Diagnosis\n";
    linksOut << "Patient_ID,Gene_ID\n";
    int cancer = 0;
    int flipped = 0;
    std::vector<char> used(static_cast<size_t>(o.genes), 0);
    for (int i = 0; i < o.patients; ++i) {
        std::string id = "P" + pad(i + 1, pw);
        std::string name = std::string(FIRST[rnd.between(0, 29)]) + " " + LAST[rnd.between(0, 19)];
        int age = rnd.between(20, 85);
        double tendency = rnd.uniform();
        int geneCount = rnd.between(3, 8);

        std::vector<int> chosen;
        std::vector<double> scores;
        while (static_cast<int>(chosen.size()) < geneCount) {
            // Best of 3 random genes: the one whose score is closest to the tendency
            int best = -1;
            for (int t = 0; t < 3; ++t) {
                int g = rnd.between(0, o.genes - 1);
                if (used[static_cast<size_t>(g)]) continue;
                if (best < 0 || std::fabs(geneScore[static_cast<size_t>(g)] - tendency) <
                                std::fabs(geneScore[static_cast<size_t>(best)] - tendency)) best = g;
            }
            if (best < 0) continue;
            used[static_cast<size_t>(best)] = 1;
            chosen.push_back(best);
            scores.push_back(geneScore[static_cast<size_t>(best)]);
        }
        for (int g : chosen) used[static_cast<size_t>(g)] = 0;

        std::vector<double> f = FeatureExtractor::fromScores(scores, age);
        double z = -6.0 + 5.0 * f[FeatureExtractor::AVG_MUTATION] + 2.5 * f[FeatureExtractor::MAX_MUTATION] +
                   0.6 * f[FeatureExtractor::HIGH_RISK_GENES] + 0.03 * (age - 50);
        double p = 1.0 / (1.0 + std::exp(-z));
        int diagnosis = rnd.uniform() < p ? 1 : 0;
        if (rnd.uniform() < o.noise) {
            diagnosis = 1 - diagnosis;
            flipped++;
        }
        cancer += diagnosis;

        patientsOut << id << "," << name << "," << age << "," << diagnosis << "\n";
        for (int g : chosen) linksOut << id << ",GENE_" << pad(g + 1, gw) << "\n";
    }

    std::cout << "Wrote " << o.genes << " genes and " << o.patients << " patients to " << o.out << "\n"
              << "  cancer: " << cancer << " (" << (100.0 * cancer / o.patients) << "%), no cancer: "
              << (o.patients - cancer) << "\n"
              << "  labels flipped as noise: " << flipped << "\n"
              << "  seed " << o.seed << ", noise " << o.noise << std::endl;
    return 0;
}

# 🔬 Cancer Diagnosis System - Setup Guide

Welcome to the Cancer Diagnosis System! This guide will help you set up and run the project on your local machine.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **CMake** (version 3.10 or higher)
  - Download: https://cmake.org/download/
  - Verify installation: `cmake --version`

- **C++ Compiler**
  - **Windows**: Visual Studio 2019 or later (with C++ workload)
  - **Linux**: GCC (install via `sudo apt-get install build-essential`)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)

- **Node.js 18 or newer** (for the React frontend; npm comes with it)
  - Download: https://nodejs.org/
  - Verify: `node --version` and `npm --version`

## 🚀 Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/Abdulrahman10724/Cancer-Diagnosis-System.git
cd Cancer-Diagnosis-System
```

### Step 2: Build the Server

#### Windows:

```powershell
# Create build directory
mkdir build
cd build

# Configure with CMake (adjust generator if needed)
cmake .. -G "Visual Studio 16 2019"
# Or for newer Visual Studio versions:
# cmake .. -G "Visual Studio 17 2022"

# Build the project
cmake --build . --config Release

# Return to project root
cd ..
```

#### Windows with MinGW (MSYS2):

```bash
mkdir build
cd build
cmake .. -G "MinGW Makefiles"
cmake --build .
cd ..
```

The executable is created at `build\cds_server.exe`.

#### Linux/macOS:

```bash
# Create build directory
mkdir -p build
cd build

# Configure with CMake
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build the project
cmake --build . --config Release

# Return to project root
cd ..
```

### Step 3: Run the Server

**IMPORTANT:** Always run the server from the **project root directory** (where `CMakeLists.txt` is located), not from the `build/` folder. This ensures the server can find the `data/` folder.

#### Windows:

```powershell
# From project root directory
.\build\Release\cds_server.exe   # Visual Studio build
.\build\cds_server.exe           # MinGW build
```

#### Linux/macOS:

```bash
# From project root directory
./build/cds_server
```

You should see:
```
Starting server on http://localhost:8080 ...
```

**Keep this terminal window open!** The server must remain running to use the application.

### Step 4: Start the Web Interface

Open a **new terminal window** in the project root and run:

```bash
cd frontend
npm install
npm run dev
```

`npm install` is only needed the first time. Vite prints a local address, normally:
```
http://localhost:5173
```

Open it in your browser. The frontend connects to `http://localhost:8080` by default.

Other frontend scripts:
- `npm run build`: production build in `frontend/dist/`
- `npm run lint`: ESLint

### Step 5: Load Data

1. The app opens on **Home** with three steps. If the server is not reachable, a red
   banner says so.
2. Choose **Load data** (step 1, or the **Start** screen). The server reads
   `data/genes.csv`, `data/patients.csv` and `data/patient_genes.csv` and trains the four
   models; a checklist ticks off each stage.
3. The page says "Loaded … genes and … patients. All 4 models are trained." and the event is
   listed under **Activity** (top right).
4. Continue with **Add patient** or **Check risk**.

## 📂 Project Structure

```
Cancer-Diagnosis-System/
├── data/                      # Data files (CSV format)
│   ├── genes.csv             # Genetic mutation data
│   ├── patients.csv          # Patient information
│   ├── patient_genes.csv     # Which genes belong to which patient
│   ├── test_genes.csv        # Test dataset
│   └── test_patients.csv     # Test dataset
├── headers/                   # C++ header files (models, data structures, system)
├── src/                       # C++ source files
│   ├── Server.cpp            # HTTP server implementation
│   ├── CancerDiagnosisSystem.cpp
│   ├── HashMapper.cpp        # Separate-chaining hash table
│   └── ...
├── frontend/                  # React web interface (Vite)
│   ├── package.json
│   └── src/
│       ├── api/client.js     # All calls to the server
│       ├── screens/          # Home, Start, Add patient, Check risk, Model accuracy, Waiting list, …
│       ├── components/       # Shared components
│       └── styles/tokens.css # Design tokens (colors, type, spacing)
├── third_party/
│   └── httplib.h             # HTTP server library
├── docs/screenshots/          # Screenshots used in the README
├── build/                     # Build directory (created by CMake, not committed)
├── CMakeLists.txt            # CMake configuration
└── SETUP_GUIDE.md           # This file
```

## 🔧 Configuration

### Changing the Server Port

If port 8080 is already in use, you can change it by editing `src/Server.cpp`:

Find this line:
```cpp
svr.listen("localhost", 8080);
```

Change `8080` to your desired port (e.g., `8081`), then rebuild the project.

### Changing the API Endpoint in the Frontend

If you changed the server port, either:

1. Open **Start / Settings**, open **Advanced: server address**, enter the new address and
   choose **Save and reconnect** (saved in this browser only), or
2. Start the frontend with the address set:
   ```bash
   VITE_API_URL=http://localhost:8081 npm run dev
   ```

## 🐛 Troubleshooting

### Problem: "Server not reachable at localhost:8080"

**Cause:** Server is not running or not accessible.

**Solution:**
1. Check if the server terminal shows: `Starting server on http://localhost:8080 ...`
2. If not, restart the server from the project root directory
3. Verify the server is accessible by opening: http://localhost:8080/status in your browser
4. The app checks again every few seconds and reconnects by itself once the server is up

### Problem: `npm install` or `npm run dev` fails

**Cause:** Node.js is missing or too old.

**Solution:**
1. Check `node --version` shows 18 or newer
2. Run the commands inside the `frontend/` folder
3. Delete `frontend/node_modules` and run `npm install` again

### Problem: "Error: Could not open file data/genes.csv"

**Cause:** Server is running from the wrong directory.

**Solution:**
- **❌ WRONG:** Running from `build/` directory
- **✅ CORRECT:** Run from project root directory (where `CMakeLists.txt` is located)

```bash
# Make sure you're in the project root
cd Cancer-Diagnosis-System
./build/Release/cds_server.exe  # Windows
# or
./build/cds_server              # Linux/macOS
```

### Problem: Port 8080 already in use

**Cause:** Another application is using port 8080.

**Solution:**
1. Find and close the application using port 8080
2. Or change the server port (see Configuration section above)

### Problem: CMake configuration fails

**Cause:** Missing dependencies or wrong generator.

**Solution:**
- **Windows:** Make sure Visual Studio is installed with C++ workload
- **Linux:** Install build essentials: `sudo apt-get install build-essential`
- **macOS:** Install Xcode Command Line Tools: `xcode-select --install`
- Try a different CMake generator if needed

### Problem: Build fails

**Cause:** Compiler issues or missing dependencies.

**Solution:**
1. Verify your C++ compiler is installed correctly
2. Check CMake output for specific error messages
3. Ensure you're using C++17 compatible compiler
4. Try cleaning the build directory and rebuilding:
   ```bash
   rm -rf build  # or rmdir /s build on Windows
   mkdir build
   cd build
   cmake ..
   cmake --build . --config Release
   ```

### Problem: Data files not loading

**Cause:** Incorrect CSV format or missing files.

**Solution:**
1. Verify `data/genes.csv` and `data/patients.csv` exist
2. Check CSV headers match exactly:
   - `genes.csv`: `Gene_ID,Mutation_Score,Label`
   - `patients.csv`: `Patient_ID,Name,Age`
3. Ensure files are in the `data/` folder relative to project root

## 📊 Data Format Requirements

### genes.csv Format

```csv
Gene_ID,Mutation_Score,Label
GENE_001,0.85,1
GENE_002,0.72,1
GENE_003,0.45,0
```

- `Gene_ID`: Unique identifier for the gene
- `Mutation_Score`: Numeric score (0.0 to 1.0+)
- `Label`: Binary classification (0 = no cancer, 1 = cancer)

### patients.csv Format

```csv
Patient_ID,Name,Age
P001,John Doe,45
P002,Jane Smith,52
P003,Mike Johnson,38
```

- `Patient_ID`: Unique identifier for the patient
- `Name`: Patient name
- `Age`: Patient age (numeric)

### patient_genes.csv Format

```csv
Patient_ID,Gene_ID
P001,GENE_001
P001,GENE_002
```

- Links each patient to its own genes (`Gene_ID` from `genes.csv`)
- Written automatically by the server whenever data is saved
- If the file is missing, each patient gets 5 consecutive genes from `genes.csv` (fallback)

### API: New Endpoints

Load data first; otherwise model endpoints return HTTP 400 `{"error":"Load data first"}`.
The full reference is in the [README](README.md#-api-documentation).

- `GET /diagnose?patient_id=P007&model=all&k=5`: all four models in one response, with the
  numbers behind each prediction. `k` (odd, 1–15) sets the KNN K for this request only.
- `GET /evaluate`: accuracy, precision, recall and F1 for all 4 models on a held-out 20% of
  the genetic data (stratified, fixed seed), plus a confusion matrix and the predicted risk
  for every test sample.
- `GET /hashmap`: the buckets of the mutation hash table. `HashMapper` is a separate-chaining
  hash table implemented in this project (rolling hash `h = h * 31 + c`, doubles its buckets
  when the load factor passes 0.75).
- `GET /patients/search?id=P007`: linear search of the patient linked list, with the IDs
  visited in order.

## 🧪 Testing the Setup

### Test 1: Server Status

Open your browser and navigate to:
```
http://localhost:8080/status
```

You should see JSON response:
```json
{"modelsTrained":false,"geneticCount":0,"patientCount":0}
```

### Test 2: Load Data and Diagnose with curl

```bash
curl -X POST http://localhost:8080/load -d '{"genesFile":"data/genes.csv","patientsFile":"data/patients.csv"}'
```

```bash
curl "http://localhost:8080/diagnose?patient_id=P007&model=all"
```

The first command returns `"modelsTrained":true`; the second returns all four models for
patient P007.

## 🎯 Key Points to Remember

- ✅ Always run the server from the **project root directory**
- ✅ Keep the server terminal window open while using the application
- ✅ Server runs on `http://localhost:8080` by default
- ✅ The frontend runs with `npm run dev` in `frontend/` (normally on port 5173)
- ✅ Data files must be in `data/` folder with correct CSV format
- ✅ Check browser console (F12) for detailed error messages

## 📚 Additional Resources

- **CMake Documentation**: https://cmake.org/documentation/
- **cpp-httplib Library**: https://github.com/yhirose/cpp-httplib
- **Project Repository**: https://github.com/Abdulrahman10724/Cancer-Diagnosis-System

## 💡 Features

This system includes:

- **Multiple ML Models**: Decision Tree, KNN, Logistic Regression, Naive Bayes
- **Check risk**: all four models side by side, with an explanation for every prediction
- **Model Evaluation**: metrics on held-out data, with an adjustable threshold
- **Waiting list**: patients checked first in, first out (a queue)
- **Data Structures**: the patient list (linked list) and gene lookup (hash table) shown step by step

## 📞 Need Help?

If you encounter issues not covered in this guide:

1. Check the browser console (F12) for error messages
2. Verify all prerequisites are installed correctly
3. Ensure you're running commands from the correct directories
4. Review the troubleshooting section above
5. Check the project's GitHub issues page

---

**Happy coding! 🚀**

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

- **Python 3** (for serving the UI - optional, you can also open HTML directly)
  - Verify: `python --version` or `python3 --version`

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

### Step 4: Open the Web Interface

You have two options:

#### Option A: Using Python HTTP Server (Recommended)

Open a **new terminal window** and run:

```bash
cd CancerDiagnosisSystem/ui
python -m http.server 8000
# Or on some systems:
python3 -m http.server 8000
```

Then open your browser and navigate to:
```
http://localhost:8000/index.html
```

#### Option B: Open HTML File Directly

Simply double-click `ui/index.html` or open it directly in your browser. Note: Some browsers may have CORS restrictions when opening files directly.

### Step 5: Load Data

1. In the web interface, navigate to the **"Load Data"** section
2. Click the **"Load Data on Server"** button
3. Wait 3-5 seconds for the data to load
4. You should see a success message
5. Check the **Dashboard** section to verify data was loaded

## 📂 Project Structure

```
CancerDiagnosisSystem/
├── data/                      # Data files (CSV format)
│   ├── genes.csv             # Genetic mutation data
│   ├── patients.csv          # Patient information
│   ├── patient_genes.csv     # Which genes belong to which patient
│   ├── test_genes.csv        # Test dataset
│   └── test_patients.csv     # Test dataset
├── headers/                   # C++ header files
│   ├── CancerDiagnosisSystem.h
│   ├── DecisionTreeClassifier.h
│   ├── KNNClassifier.h
│   ├── LogisticRegressionModel.h
│   ├── NaiveBayesClassifier.h
│   └── ...
├── src/                       # C++ source files
│   ├── Server.cpp            # HTTP server implementation
│   ├── CancerDiagnosisSystem.cpp
│   └── ...
├── ui/                        # Web interface
│   ├── index.html            # Main HTML file
│   ├── script.js             # Frontend JavaScript
│   └── styles.css            # Styling
├── third_party/               # Third-party libraries
│   └── httplib.h             # HTTP server library
├── build/                     # Build directory (created by CMake)
│   └── Release/              # Compiled executable
│       └── cds_server.exe    # Server executable (Windows)
│       └── cds_server        # Server executable (Linux/macOS)
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

### Changing the API Endpoint in UI

If you changed the server port, update the UI configuration:

1. Open `ui/index.html` or use the Settings section in the web interface
2. Update the `apiEndpoint` in `script.js` (line 7) or use the Settings UI
3. Refresh the browser

## 🐛 Troubleshooting

### Problem: "Server load failed" or "Failed to fetch"

**Cause:** Server is not running or not accessible.

**Solution:**
1. Check if the server terminal shows: `Starting server on http://localhost:8080 ...`
2. If not, restart the server from the project root directory
3. Verify the server is accessible by opening: http://localhost:8080/status in your browser

### Problem: "Error: Could not open file data/genes.csv"

**Cause:** Server is running from the wrong directory.

**Solution:**
- **❌ WRONG:** Running from `build/` directory
- **✅ CORRECT:** Run from project root directory (where `CMakeLists.txt` is located)

```bash
# Make sure you're in the project root
cd CancerDiagnosisSystem
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

### API: Model Evaluation

`GET http://localhost:8080/evaluate` returns accuracy, precision, recall and F1 for all 4 models,
measured on a held-out 20% of the genetic data (stratified, fixed seed). Load data first,
otherwise the server returns HTTP 400 `{"error":"Load data first"}`.

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

### Test 2: Load Data via Browser Console

1. Open the web interface
2. Press `F12` to open browser console
3. Run this command:

```javascript
fetch('http://localhost:8080/load', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    genesFile: 'data/genes.csv',
    patientsFile: 'data/patients.csv'
  })
})
.then(r => r.json())
.then(d => console.log('✓ Data loaded:', d))
.catch(e => console.error('✗ Load failed:', e));
```

If successful, you'll see a success message in the console.

## 🎯 Key Points to Remember

- ✅ Always run the server from the **project root directory**
- ✅ Keep the server terminal window open while using the application
- ✅ Server runs on `http://localhost:8080` by default
- ✅ UI can be accessed via Python server on port 8000 or opened directly
- ✅ Data files must be in `data/` folder with correct CSV format
- ✅ Check browser console (F12) for detailed error messages

## 📚 Additional Resources

- **CMake Documentation**: https://cmake.org/documentation/
- **cpp-httplib Library**: https://github.com/yhirose/cpp-httplib
- **Project Repository**: https://github.com/Abdulrahman10724/Cancer-Diagnosis-System

## 💡 Features

This system includes:

- **Multiple ML Models**: Decision Tree, KNN, Logistic Regression, Naive Bayes
- **Real-time Diagnosis**: Web-based interface for instant results
- **Model Evaluation**: Compare performance metrics across models
- **Data Visualization**: Charts and graphs for analysis
- **Queue System**: Batch processing for multiple patients

## 📞 Need Help?

If you encounter issues not covered in this guide:

1. Check the browser console (F12) for error messages
2. Verify all prerequisites are installed correctly
3. Ensure you're running commands from the correct directories
4. Review the troubleshooting section above
5. Check the project's GitHub issues page

---

**Happy coding! 🚀**

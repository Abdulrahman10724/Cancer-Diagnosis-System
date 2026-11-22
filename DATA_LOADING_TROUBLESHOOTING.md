# Data Loading Troubleshooting Guide

## Problem: Data Not Loading on Server

The data loading fails when choosing **Load data** on the **Setup** screen. Here are the common causes and solutions:

---

## **Issue 1: Server Not Running**

### Symptom:
- Setup shows: **Server not running** — "Server not reachable at localhost:8080. Start cds_server and try again."
- Error appears immediately (no timeout)

### Solution:
1. Build the C++ server:
```bash
cd Cancer-Diagnosis-System
mkdir -p build
cd build
cmake ..
cmake --build . --config Release
```

2. Run the server **from the project root directory** (important!):
```bash
cd Cancer-Diagnosis-System
./build/Release/cds_server.exe
# or on Linux/Mac:
# ./build/cds_server
```

You should see:
```
Starting server on http://localhost:8080 ...
```

3. Keep the server terminal open while using the web interface.

---

## **Issue 2: Working Directory Mismatch (Most Common)**

### Symptom:
- Server shows error: `Error: Could not open file data/genes.csv`
- Setup shows **Data not loaded** or the models stay **Not trained yet**

### Root Cause:
The server looks for `data/genes.csv` **relative to where the server executable is running**, not where the executable is located.

### Solution:
**Always run the server from the project root:**
```bash
cd Cancer-Diagnosis-System
./build/Release/cds_server.exe
```

**NOT from build/ directory:**
```bash
# ❌ WRONG - will fail to find data files
cd Cancer-Diagnosis-System/build
./Release/cds_server.exe
```

---

## **Issue 3: Network/CORS Issues**

### Symptom:
- Browser console shows CORS error
- Network tab shows OPTIONS request failing

### Solution:
The server already has CORS headers. If still failing:
1. Check browser console (F12 > Console)
2. Verify the server address on the **Setup** screen matches where the server is running (default: `http://localhost:8080`)
3. Make sure server is actually listening (check terminal output)

---

## **Issue 4: File Format Issues**

### Symptom:
- Server loads but shows: `"No genetic data loaded! Cannot train models"`

### Root Cause:
CSV format is incorrect. The files expect:

**genes.csv format:**
```
Gene_ID,Mutation_Score,Label
GENE_001,0.85,1
GENE_002,0.72,1
```

**patients.csv format:**
```
Patient_ID,Name,Age
P001,John Doe,45
P002,Jane Smith,52
```

### Solution:
1. Verify CSV headers match exactly (case-sensitive)
2. Check that data is comma-separated (no extra spaces)
3. Replace data files with valid CSV format

---

## **Step-by-Step: Correct Data Loading Process**

### 1. Start the Server
```bash
cd Cancer-Diagnosis-System
./build/Release/cds_server.exe
```

Expected output:
```
Starting server on http://localhost:8080 ...
```

### 2. Start the Web Interface
```bash
cd frontend
npm install
npm run dev
# Open the address Vite prints, normally http://localhost:5173
```

### 3. Check the Server Address
- The app opens on **Setup**
- Under **Server address**, the API URL should be `http://localhost:8080`
- If you change it, choose **Save and reconnect**

### 4. Load Data
- On **Setup**, choose **Load data**
- Wait a few seconds for the models to train

### 5. Verify Success
- **Server status** shows **Trained** with the gene and patient counts
- The **Lab notebook** on the right records "Data loaded: … Models trained."
- Check the browser console (F12) for any errors

---

## **Debugging Tips**

### Check Server Console Output
The server outputs loading progress:
```
=== Loading Data ===
Loaded 20 genetic data records.
=== Data Summary ===
Genetic records loaded: 20
Patient records loaded: 10

=== Training Models ===
Training Logistic Regression...
✓ System ready for diagnosis!
```

If you don't see this, the data loading failed on the server side.

### Check Browser Network Tab
1. Open DevTools (F12)
2. Go to **Network** tab
3. Choose **Load data** on Setup
4. Look for `POST /load` request
5. Check response (should show geneticCount and patientCount > 0)

### Test the Server Directly
```bash
curl -X POST http://localhost:8080/load -d '{"genesFile":"data/genes.csv","patientsFile":"data/patients.csv"}'
```
The response should show `"modelsTrained":true` with `geneticCount` and `patientCount` above 0.

---

## **Quick Checklist**

- [ ] Server built with `cmake --build . --config Release`
- [ ] Server running from project root (not from build/ folder)
- [ ] Server shows "Starting server on http://localhost:8080"
- [ ] Server address on the Setup screen is `http://localhost:8080`
- [ ] CSV files exist in `data/` folder with correct headers
- [ ] Browser console shows no errors (F12 > Console)
- [ ] Network request shows 200 response (F12 > Network)

---

## **Still Not Working?**

Run this diagnostic in browser console:
```javascript
// Test if server is reachable
fetch('http://localhost:8080/status')
  .then(r => r.json())
  .then(data => console.log('✓ Server is reachable:', data))
  .catch(e => console.error('✗ Server error:', e.message));

// Test load endpoint
fetch('http://localhost:8080/load', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({genesFile: 'data/genes.csv', patientsFile: 'data/patients.csv'})
})
  .then(r => r.json())
  .then(data => console.log('✓ Data load result:', data))
  .catch(e => console.error('✗ Load error:', e.message));
```

Check console output - this will tell you exactly where the failure is.


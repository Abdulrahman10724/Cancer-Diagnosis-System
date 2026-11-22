# API reference

The C++ server (`cds_server`) listens on `http://localhost:8080`. Start it from the
repository root so it finds `data/`. On start it loads the default dataset
(`data/patients.csv`, `data/genes.csv`, `data/patient_genes.csv`) and trains the four models.

## Conventions

- All responses are JSON and carry `Access-Control-Allow-Origin: *`, including errors.
  `OPTIONS` on any path answers the CORS preflight (`GET, POST, DELETE, OPTIONS`).
- Request bodies are JSON. An empty body counts as `{}`. Maximum body size is 5 MB.
- Errors:

  | Status | When | Body |
  |---|---|---|
  | 400 | bad input, no data loaded, invalid dataset | `{"error":"..."}` (invalid datasets add `"problems":[...]`) |
  | 404 | unknown patient or dataset | `{"error":"..."}` |
  | 409 | duplicate patient ID, dataset name or triage entry | `{"error":"..."}` |
  | 500 | a file could not be written | `{"error":"..."}` |

- An invalid dataset (on `/load`, `/upload` or `/datasets/select`) returns
  `400 {"error":"Dataset is invalid","problems":["patients.csv line 4: age 'abc' is not a whole number", ...]}`
  with at most 50 problems. The previously active dataset stays loaded.
- Feature objects always use the four names `avgMutation`, `maxMutation`, `highRiskGenes`, `age`.
- Risk is a probability from 0 to 1; prediction is `risk >= 0.5`.
- Model keys: `logistic`, `knn`, `decision_tree`, `naive_bayes`.
- The models are retrained after a load, an upload, a dataset switch, adding a labelled patient,
  deleting a labelled patient and undoing either. Changes to patients are saved to the
  active dataset's own CSV files (written to a `.tmp` file, then renamed).

## Status and datasets

### `GET /status`
```json
{"modelsTrained":true,"dataset":"default","patientCount":400,"labelledCount":400,"geneCount":800,
 "featureNames":["avgMutation","maxMutation","highRiskGenes","age"]}
```
The same object is returned by every call that loads data, and as `status` inside the
responses of `POST /patients`, `DELETE /patients/{id}` and `POST /undo`.

### `POST /load`
Body: `{"patientsFile":"data/patients.csv","genesFile":"data/genes.csv","patientGenesFile":"data/patient_genes.csv"}`.
Missing fields use the default paths. The dataset is called `default` when all three paths are
the defaults, otherwise `custom`. Returns the status object.

### `POST /upload`
Body: `{"name":"my-data","patientsCsv":"...","genesCsv":"...","patientGenesCsv":"..."}` (the file contents as text).

- `name`: 1 to 40 characters from `a-z`, `0-9`, `-`; not `default`. Otherwise 400.
- An existing name gives 409.
- The CSVs are validated first. Nothing is written for an invalid upload (400 with `problems`).
- A valid upload is saved to `data/uploads/<name>/`, loaded and becomes the active dataset.
  Returns the status object.

### `GET /datasets`
```json
{"active":"default","datasets":[
  {"name":"default","valid":true,"patientCount":400,"labelledCount":400,"geneCount":800},
  {"name":"my-data","valid":true,"patientCount":29,"labelledCount":29,"geneCount":800}]}
```
`default` comes first, then each folder of `data/uploads/` in name order.

### `POST /datasets/select`
Body: `{"name":"my-data"}`. 400 when the name is missing, 404 when the dataset does not exist,
400 with `problems` when its files are invalid. Returns the status object.

## Patients

### `GET /patients`
All patients in insertion order (linked list):
```json
[{"patient_id":"P001","name":"Hira Malik","age":79,"diagnosis":0,
  "features":{"avgMutation":0.545783,"maxMutation":0.6963,"highRiskGenes":0,"age":79},
  "riskScore":0.256468,"prediction":0,"geneIds":["GENE_312","GENE_239","GENE_080"]}]
```
`diagnosis` is `0`, `1` or `null` (unknown). `riskScore` is the mean risk of the four models.

### `POST /patients`
```json
{"patient_id":"P900","name":"Sara Khan","age":61,"diagnosis":null,
 "genes":[{"geneId":"GENE_003"},{"geneId":"NEW_1","mutationScore":0.81}]}
```
- `patient_id`: 1 to 40 characters, no spaces, commas or quotes. `name`: not empty, no commas.
  `age`: whole number 0 to 120. `diagnosis`: `0`, `1`, `null` or left out.
- `genes`: at least one. A known gene uses its stored score (a sent score is ignored and
  reported); a new gene needs `mutationScore` from 0 to 1 and is added to `genes.csv`.
- 409 when the ID exists.

Response:
```json
{"success":true,"patient":{...same shape as GET /patients...},
 "genes":[{"geneId":"GENE_003","mutationScore":0.9507,"existing":true,"sentScoreIgnored":false},
          {"geneId":"NEW_1","mutationScore":0.81,"existing":false,"sentScoreIgnored":false}],
 "status":{...}}
```

### `DELETE /patients/{id}`
`{"deleted":"P002","undoAvailable":2,"status":{...}}`. 404 for an unknown ID. The patient's
waiting-list and triage entries are removed too.

### `POST /undo`
Reverts the last add or delete (up to 50 are kept). A deleted patient goes back to the same
position; undoing an add also removes genes that the add created.
`{"undone":"delete P002","undoAvailable":1,"status":{...}}`. 400 `Nothing to undo` when empty.

### `GET /patients/search?id=P250`
Linear search of the linked list:
`{"found":true,"hops":250,"order":["P001","P002",...,"P250"]}`.

### `GET /patients/index?id=P250`
AVL ID index lookup:
`{"found":true,"steps":8,"path":["P256","P128","P192","P224","P240","P248","P252","P250"],"height":9,"size":400}`.

### `GET /patients/range?min=0.9&max=1`
Patients whose consensus risk is in `[min, max]`, lowest first, from the AVL risk index.
`0 <= min <= max <= 1`.
```json
{"min":0.9,"max":1,"count":53,"visited":57,
 "patients":[{"patient_id":"P253","name":"Olivia Shah","risk":0.900959}]}
```

### `GET /genetic`
Every gene in file order: `[{"gene_id":"GENE_001","mutation_score":0.3745}]`.

## Models

### `GET /diagnose?patient_id=P004&model=logistic&k=5`
`model` is a model key (default `logistic`) or `all`. `k` (odd, 1 to 15) changes K for KNN on
this call only. 404 for an unknown patient.

One model: `{"patient_id":"P004","riskScore":0.90518,"prediction":1}`

`model=all`:
```json
{"patient_id":"P004",
 "features":{"avgMutation":0.7593,"maxMutation":0.9624,"highRiskGenes":4,"age":74},
 "featuresScaled":{"avgMutation":1.2733,"maxMutation":1.23275,"highRiskGenes":1.56525,"age":1.19586},
 "threshold":0.5,
 "models":{
   "logistic":{"risk":0.905,"prediction":1,"explain":{"bias":-0.58,"z":2.256,
      "contributions":[{"feature":"avgMutation","weight":0.68,"value":1.27,"product":0.87}]}},
   "knn":{"risk":1,"prediction":1,"k":5,"explain":{"neighbors":[{"patient_id":"P...","features":{...},"diagnosis":1,"distance":0.12}],
      "votesCancer":5,"votesSafe":0,"kdNodesVisited":31}},
   "decision_tree":{"risk":0.95,"prediction":1,"explain":{"path":[{"feature":"avgMutation","threshold":0.358,"thresholdRaw":0.573,"value":0.7593,"wentLeft":false}],"leafSamples":40,"leafPositiveFraction":0.95}},
   "naive_bayes":{"risk":0.97,"prediction":1,"explain":{"prior":[0.605,0.395],"perFeature":[{"feature":"avgMutation","mean":[0.406,0.645],"std":[0.168,0.164],"value":0.7593}]}}},
 "consensus":{"cancer":4,"safe":0,"meanRisk":0.976}}
```

### `GET /evaluate`
Metrics on a stratified 80/20 split (seed 42), the models trained on the 80%.
```json
{"split":{"train":320,"test":80,"seed":42},"testSamples":80,
 "models":[{"key":"logistic","name":"Logistic Regression","accuracy":0.8,"precision":0.833,"recall":0.625,"f1":0.714,
   "confusion":{"tp":20,"fp":4,"tn":44,"fn":12},
   "roc":{"points":[[0,0],[0,0.03125],...,[1,1]],"auc":0.828},
   "samples":[{"patient_id":"P010","features":{...},"diagnosis":1,"risk":0.102}]}]}
```

### `GET /crossval?k=5`
Stratified k-fold cross-validation (k 2 to 10, seed 42). Each metric has `mean`, `std` and `folds`:
```json
{"k":5,"seed":42,"foldSizes":[80,80,80,80,80],
 "models":[{"key":"logistic","name":"Logistic Regression",
   "accuracy":{"mean":0.805,"std":0.0401,"folds":[0.75,0.8375,0.85,0.7875,0.8]},
   "precision":{...},"recall":{...},"f1":{...}}]}
```

### `GET /features`
Per feature: overall and per-class mean/std/min/max, importance (logistic |weight| share and
decision tree Gini importance) and a 10-bin histogram per class; plus the 5×5 Pearson
correlation matrix of the four features and the diagnosis.
```json
{"featureNames":[...],"labelled":{"noCancer":242,"cancer":158},
 "features":[{"name":"avgMutation","overall":{"mean":0.5,"std":0.2,"min":0.097,"max":0.96},
   "noCancer":{...},"cancer":{...},"importance":{"logistic":0.33,"tree":0.69},
   "histogram":{"binStart":0.097,"binWidth":0.086,"noCancer":[15,43,...],"cancer":[3,4,...]}}],
 "correlation":{"labels":["avgMutation","maxMutation","highRiskGenes","age","diagnosis"],"matrix":[[1,...],...]}}
```

### `GET /tree`
The decision tree as nested nodes. Internal nodes have `feature`, `threshold` (scaled),
`thresholdRaw`, `samples`, `positiveFraction`, `prediction`, `left`, `right`; leaves have `feature: null`.
`{"depth":5,"nodeCount":51,"root":{...}}`

### `GET /kdtree?depth=4`
The KNN KD-tree down to `depth` (1 to 12). Nodes have `axis`, `feature`, `split`, `splitRaw`,
`size`, `patient_id`, and `truncated:true` where the output stops.
`{"points":400,"dimensions":4,"height":9,"depth":2,"root":{...}}`

## Queues

### `GET /queue`, `POST /queue`, `POST /queue/process`
FIFO waiting list (linked queue).
- `GET /queue` → `{"queueSize":1,"patients":["P001"]}`
- `POST /queue {"patient_id":"P001"}` → `{"success":true,"queueSize":1,"message":"Patient scheduled for diagnosis"}`; 404 unknown ID.
- `POST /queue/process {"model":"knn"}` (default `logistic`) → diagnoses front first:
  `{"model":"knn","processed":1,"results":[{"patient_id":"P001","name":"Hira Malik","riskScore":0.4,"prediction":0,"status":"processed"}],"patientCount":400}`

### `GET /triage`, `POST /triage`, `POST /triage/process`
Priority queue (binary max-heap) by consensus risk; equal risk → earlier arrival first.
- `POST /triage {"patient_id":"P004"}` → `{"success":true,"patient_id":"P004","risk":0.976201,"size":1}`.
  404 unknown ID, 409 already in triage.
- `GET /triage` → `{"size":2,"heap":[...array order...],"sorted":[...priority order...]}`, items
  `{"patient_id","name","risk","arrival"}`.
- `POST /triage/process` → pops everything:
  `{"processed":2,"results":[{"rank":1,"patient_id":"P004","name":"Hira Ahmed","risk":0.976201,"prediction":1}]}`

## Graph

### `GET /graph?eps=0.6`
Similarity graph over every patient: an edge joins two patients whose standardized feature
rows are at Euclidean distance `<= eps` (0 < eps <= 10, default 0.6). Edges are found with a
KD-tree radius search per patient.
```json
{"eps":0.6,"edgeSearch":"kd-tree radius search","kdNodesVisited":34159,
 "featureNames":[...],"nodeCount":400,"edgeCount":1718,
 "nodes":[{"id":"P001","features":{...},"diagnosis":0,"component":0}],
 "edges":[{"a":"P001","b":"P099","distance":0.41}],
 "components":{"count":22,"isolated":13,"list":[
   {"component":0,"size":189,"labelled":189,"cancerRate":0.116,"meanFeatures":{...}}]}}
```
`components.list` is largest first; `cancerRate` is among labelled members (`null` if none).

### `GET /graph/bfs?start=P001&eps=0.6`
Breadth-first order from `start` (404 unknown patient):
```json
{"start":"P001","eps":0.6,"order":[{"id":"P001","level":0,"parent":null,"diagnosis":0},
  {"id":"P099","level":1,"parent":"P001","diagnosis":0}],"reached":189,"levels":10,"nodeCount":400}
```

## Data structures

### `GET /hashmap`
The gene hash table: `{"bucketCount":2048,"size":800,"loadFactor":0.39,"buckets":[{"index":14,"items":[{"key":"GENE_800","value":0.2382,"hash":2016933038094}]}]}`
(every bucket is listed, empty ones with `items: []`).

### `GET /benchmark?n=2000&seed=1`
Times each structure against simpler alternatives on `n` synthetic patients built in memory
(the loaded dataset is not touched). `n >= 10`; values above 20000 are capped (`"capped":true`).
Each variant runs 3 times and the fastest `steady_clock` time is reported in microseconds.
`sameAnswer` confirms all variants produced the same result. n = 20000 takes about 20 seconds
(mostly the naive decision-tree split search).
```json
{"n":2000,"seed":1,"runs":3,"capped":false,"timing":"best of 3, steady_clock",
 "results":[{"task":"Find patient by ID","steps":"nodes or chain entries compared","queries":200,"sameAnswer":true,
   "variants":[{"name":"Linked list","steps":198953,"micros":498.2},
               {"name":"AVL tree","steps":2027,"micros":23.3},
               {"name":"Hash table","steps":301,"micros":3.0}]}]}
```
Tasks: `Find patient by ID`, `Find 5 nearest neighbours`, `Train decision tree`, `Order triage queue`.
See [DSA.md](DSA.md) for measured numbers.

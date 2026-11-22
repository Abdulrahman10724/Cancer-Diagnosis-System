# Data structures and algorithms

Every structure below is written by hand in C++17. `src/` and `headers/` do not use
`std::sort`, `std::map`, `std::set`, `std::unordered_*`, `std::list`, `std::queue`,
`std::stack`, `std::deque`, `std::priority_queue`, `std::make_heap` or `std::nth_element`.

## Where they sit in the pipeline

```
CSV files ──DatasetLoader──▶ Patients (linked list) + genes (hash table)
                                   │
                         FeatureExtractor (4 features per patient)
                                   │
                         DataPreprocessor (z-scores per feature)
                                   │
        ┌──────────────┬───────────┴────────┬────────────────┐
   Logistic        KNN (KD-tree        Decision tree      Naive Bayes
   regression      + heap top-K)       (merge sort +      (arrays [2][4])
                                        prefix sums)
        └──────────────┴───────────┬────────┴────────────────┘
                          consensus risk per patient
                                   │
     AVL ID index · AVL risk index · triage heap · similarity graph (BFS)
     undo stack · FIFO waiting list · ROC/AUC · cross-validation
```

## The structures

### Linked list of patients — `headers/CancerDiagnosisSystem.h`
- **Used for:** the master patient list in insertion order. `GET /patients` and the saved CSV follow it.
- **Why:** keeps the file order, O(1) append with a tail pointer, and is the baseline the AVL index is compared against.
- **Operations:** append O(1), linear search O(n) (`/patients/search`), unlink by ID O(n), insert at a position O(n) (undo of a delete).

### Hash table (separate chaining) — `headers/HashMapper.h`, `src/HashMapper.cpp`
- **Used for:** gene ID → mutation score. Every feature extraction looks up each of the patient's genes. The loader also uses it as a set to find duplicate IDs.
- **Why:** constant average lookup. Thousands of lookups happen per load.
- **Operations:** put / get / erase O(1) average, O(n) worst; rehash O(n + m) when the load factor passes 0.75 (bucket count doubles); keys O(n + m).
- **Details:** polynomial hash ×31; each bucket holds a hand-written chain of `HashNode` (`unique_ptr` links).

### Binary heap — `headers/BinaryHeap.h`
- **Used for:** (1) KNN top-K: a size-K max-heap of the best candidates so far; (2) the triage priority queue (highest consensus risk first, equal risk → earlier arrival).
- **Why:** top-K in O(n log K) instead of sorting all n distances; triage needs repeated "give me the most urgent".
- **Operations:** push O(log n), pop O(log n), top O(1), heap array O(n). The comparator `Higher(a, b)` makes it a max-heap or a min-heap.

### KD-tree — `headers/KDTree.h`, `src/KDTree.cpp`
- **Used for:** KNN neighbour search on the standardized 4-feature rows (`/diagnose`, `/evaluate`, `/crossval`), and the radius search that finds the similarity-graph edges.
- **Why:** prunes most of the training set. At n = 20000 a 5-NN query visits about 122 nodes instead of computing 20000 distances.
- **Operations:** build O(n log² n) (median by merge sort on each level); k-nearest O(log n + K log K) average, O(n log K) worst; radius search O(n^(1-1/d) + m) typical.
- **Exactness:** subtrees are skipped only when `(q[axis] − split)² > K-th best distance²`, and ties are broken by row index, so results equal brute force exactly (tested on 200 random queries with many ties).

### Merge sort — `headers/Sorting.h`, `src/Sorting.cpp`
- **Used for:** decision-tree split search (sort each feature once per node), KD-tree medians, ordering graph components in the server, ROC thresholds, benchmark baselines.
- **Why:** O(n log n) worst case and **stable**, which keeps ties in a predictable order (the KD-tree and the split search rely on it).
- **Operations:** `mergeSortBy(vec, less)` O(n log n) time, O(n) extra memory; `argsortMergeSort` returns the stable order of indices.

### Decision-tree split search with prefix sums — `src/DecisionTreeClassifier.cpp`
- **Used for:** training the decision tree (depth 5, min split 4).
- **Why:** after sorting a node's rows by a feature, a running count of positives on the left gives the Gini impurity of every threshold in O(1) each.
- **Operations:** fast split O(F · n log n) per node vs naive O(F · n²) (`findBestSplitNaive`, kept for tests and the benchmark). Both return the same split (tested on 100 random cases plus whole trees).

### AVL trees — `headers/AVLTree.h`
- **Used for:** (1) ID index: patient ID → patient (`/patients/index`, all ID lookups in the server); (2) risk index: (consensus risk, ID) → patient for `/patients/range`.
- **Why:** O(log n) lookups and ordered range queries; a hash table cannot answer "all patients with risk between 0.4 and 0.6".
- **Operations:** insert / erase / find O(log n) with LL, LR, RR, RL rotations; range query O(log n + m) for m results; in-order O(n). Height ≤ 1.44 log₂(n + 2) (P250 is found in 8 steps out of 400 patients, against 250 linked-list hops).

### Stack — `headers/Stack.h`
- **Used for:** undo of add and delete (`POST /undo`), up to 50 entries (the oldest is dropped).
- **Why:** undo is last-in, first-out.
- **Operations:** push / pop / top O(1), drop bottom O(n) (only when the cap is reached).

### FIFO queue — `headers/LinkedQueue.h`
- **Used for:** the waiting list (`/queue`) and BFS.
- **Operations:** push / pop / front O(1), remove all copies of a value O(n) (when a patient is deleted).

### Patient similarity graph + BFS — `headers/PatientGraph.h`, `src/PatientGraph.cpp`
- **Used for:** `/graph` (clusters of similar patients and their cancer rates) and `/graph/bfs` (how a patient connects to others, level by level).
- **Edges:** standardized feature distance ≤ eps (default 0.6). **They are found with a KD-tree radius search per patient**, not an O(n²) scan. `buildBruteForce` does the O(n²) scan and is used by the tests to confirm the same graph.
- **Operations:** build about O(V · (V^(1−1/d) + degree)) typical, O(V²) worst; BFS O(V + E); connected components O(V + E). Adjacency lists are sorted by node index, so BFS order is deterministic.
- On the default data (400 patients, eps 0.6): 1718 edges, 22 components, 13 isolated patients. The largest component (189 patients) has a cancer rate of 12%; the second (107) has 47%.

### ROC curve and AUC — `src/EvaluationMetrics.cpp`
- **Used for:** `/evaluate`.
- **How:** sort test risks (merge sort), walk thresholds from high to low, grouping equal risks into one step, and integrate with the trapezoid rule. O(n log n).

### Other algorithms
- **Stratified split and folds** (`src/Sampling.cpp`): Fisher–Yates shuffle per class with `mt19937` (seed 42), 80/20 split and k folds. O(n).
- **Cross-validation:** k model sets trained on k−1 folds each; mean and standard deviation per metric.
- **Pearson correlation:** the 5×5 matrix of the four features and the diagnosis, O(n).

## Benchmark results

From `GET /benchmark?n=2000&seed=1` and `GET /benchmark?n=20000&seed=1` on the development
container (GCC, Release build, best of 3 runs, `steady_clock`). Every task reported
`sameAnswer: true`. Times depend on the machine; step counts do not.

### n = 2000

| Task | Variant | Steps | Time (µs) |
|---|---|---:|---:|
| Find patient by ID (200 lookups) | Linked list | 198,953 | 498.2 |
| | AVL tree | 2,027 | 23.3 |
| | Hash table | 301 | 3.0 |
| Find 5 nearest neighbours (100 queries) | Brute force + full sort | 2,139,390 | 18,717.7 |
| | Brute force + heap | 412,707 | 880.3 |
| | KD-tree (nodes visited) | 11,199 | 234.1 |
| Train decision tree | Naive split search | 16,310,673 | 55,428.7 |
| | Merge sort + prefix sums | 342,402 | 3,453.9 |
| Order triage queue | Repeated selection scan | 1,999,000 | 3,947.1 |
| | Binary heap | 38,575 | 190.4 |

### n = 20000

| Task | Variant | Steps | Time (µs) |
|---|---|---:|---:|
| Find patient by ID (200 lookups) | Linked list | 1,997,073 | 13,203.1 |
| | AVL tree | 2,724 | 51.4 |
| | Hash table | 461 | 8.0 |
| Find 5 nearest neighbours (100 queries) | Brute force + full sort | 28,089,302 | 205,109.0 |
| | Brute force + heap | 4,017,929 | 8,659.8 |
| | KD-tree (nodes visited) | 12,231 | 356.6 |
| Train decision tree | Naive split search | 1,544,475,337 | 6,173,620 |
| | Merge sort + prefix sums | 4,728,693 | 34,391.9 |
| Order triage queue | Repeated selection scan | 199,990,000 | 255,519.0 |
| | Binary heap | 518,689 | 2,012.4 |

What the numbers show:
- Lookup: going from 2000 to 20000 patients makes the linked list 10× slower; the AVL tree needs only 3–4 more steps per lookup, and the hash table stays at about 2 entries per lookup.
- KNN: the KD-tree's work barely grows (11,199 → 12,231 nodes for 100 queries), while brute force grows 10×. The heap alone already beats a full sort by 20×.
- Decision tree: the prefix-sum split is 16× faster at n = 2000 and 180× faster at n = 20000.
- Triage: the heap does O(n log n) comparisons; the selection scan does n(n−1)/2.

## Model results on the default dataset

400 patients (158 cancer), 800 genes, generated with `cds_datagen --patients 400 --genes 800 --seed 42 --noise 0.10`.

| Model | Test accuracy (80/20) | Test AUC | 5-fold accuracy (mean ± std) |
|---|---:|---:|---:|
| Logistic regression | 0.800 | 0.828 | 0.805 ± 0.040 |
| KNN (K = 5, KD-tree) | 0.762 | 0.820 | 0.790 ± 0.026 |
| Decision tree (depth 5) | 0.838 | 0.839 | 0.748 ± 0.039 |
| Naive Bayes | 0.787 | 0.841 | 0.795 ± 0.033 |

The generator flips 10% of the labels, so no model can be perfect; the mutation features
correlate with the diagnosis at about 0.55–0.58, age at about 0.08.

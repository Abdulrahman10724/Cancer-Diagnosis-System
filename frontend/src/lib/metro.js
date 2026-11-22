// The metro: 8 stations (pipeline steps) and the lines (data structures) that stop at them.

export const STATIONS = [
  { id: 'data', n: 1, name: 'Data', short: 'Load three CSV files and check every line.' },
  { id: 'features', n: 2, name: 'Features', short: 'Turn each patient’s genes into four numbers.' },
  { id: 'scale', n: 3, name: 'Scale', short: 'Put the four numbers on one ruler.' },
  { id: 'split', n: 4, name: 'Split', short: 'Hide 20% of patients for a fair test.' },
  { id: 'train', n: 5, name: 'Train', short: 'Four models learn from the training patients.' },
  { id: 'predict', n: 6, name: 'Predict', short: 'Each model gives a risk, then they vote.' },
  { id: 'evaluate', n: 7, name: 'Evaluate', short: 'Count how often each model was right.' },
  { id: 'benchmark', n: 8, name: 'Benchmark', short: 'Time our structures against the simple way.' },
];

export const stationIndex = (id) => STATIONS.findIndex((s) => s.id === id);
export const stationById = (id) => STATIONS.find((s) => s.id === id);

// key -> CSS variable suffix; `night` / `day` are the two tuned colours
export const LINES = [
  {
    key: 'hash',
    name: 'Hash table',
    night: 'var(--n-hash)',
    day: 'var(--line-hash)',
    stops: ['data', 'features', 'benchmark'],
    what: 'Jumps straight to a gene’s score from its ID, instead of reading the whole gene list.',
    uses: {
      data: 'checks every ID for duplicates while the CSV files are read',
      features: 'looks up the score of every gene a patient has',
      benchmark: 'finds patients by ID against a linked list and an AVL tree',
    },
    complexity: ['find O(1) average', 'insert O(1) average', 'rehash O(n) when 75% full'],
    file: 'headers/HashMapper.h',
  },
  {
    key: 'merge',
    name: 'Merge sort',
    night: 'var(--n-merge)',
    day: 'var(--line-merge)',
    stops: ['train', 'evaluate', 'benchmark'],
    what: 'Sorts by splitting the list in halves and merging them back in order. Equal values keep their order.',
    uses: {
      train: 'sorts each feature once per tree node; prefix sums then score every split',
      evaluate: 'sorts risks to draw the ROC curve',
      benchmark: 'the full-sort way to find nearest neighbours',
    },
    complexity: ['sort O(n log n) always', 'extra memory O(n)', 'split search O(n log n) instead of O(n²)'],
    file: 'headers/Sorting.h',
  },
  {
    key: 'kd',
    name: 'KD-tree',
    night: 'var(--n-kd)',
    day: 'var(--line-kd)',
    stops: ['train', 'predict', 'benchmark'],
    what: 'Splits patients into boxes, one feature at a time, so a search can skip boxes that are too far away.',
    uses: {
      train: 'is built from the training patients for KNN',
      predict: 'finds the K most similar patients, and the graph’s edges',
      benchmark: 'nearest-neighbour search against brute force',
    },
    complexity: ['build O(n log² n)', 'search O(log n) average', 'worst case O(n)'],
    file: 'headers/KDTree.h',
  },
  {
    key: 'heap',
    name: 'Heap',
    night: 'var(--n-heap)',
    day: 'var(--line-heap)',
    stops: ['train', 'predict', 'benchmark'],
    what: 'Keeps the most important item on top, so taking it out is fast.',
    uses: {
      train: 'keeps the K best candidates during a KNN search',
      predict: 'orders the triage list, highest risk first',
      benchmark: 'orders triage against a repeated scan',
    },
    complexity: ['push O(log n)', 'pop O(log n)', 'top O(1)'],
    file: 'headers/BinaryHeap.h',
  },
  {
    key: 'avl',
    name: 'AVL tree',
    night: 'var(--n-avl)',
    day: 'var(--line-avl)',
    stops: ['predict', 'benchmark'],
    what: 'A sorted tree that rebalances itself, so it never grows tall and lookups stay short.',
    uses: {
      predict: 'finds a patient by ID, and lists patients in a risk range',
      benchmark: 'finds patients by ID against a linked list',
    },
    complexity: ['find O(log n)', 'insert / delete O(log n)', 'range query O(log n + m)'],
    file: 'headers/AVLTree.h',
  },
  {
    key: 'graph',
    name: 'Graph\u00a0·\u00a0BFS',
    night: 'var(--n-graph)',
    day: 'var(--line-graph)',
    stops: ['predict'],
    what: 'Links patients whose features are close, then walks outward level by level to find groups.',
    uses: {
      predict: 'shows groups of similar patients and how one patient connects to the rest',
    },
    complexity: ['breadth-first search O(V + E)', 'groups O(V + E)', 'edges found with the KD-tree'],
    file: 'headers/PatientGraph.h',
  },
];

export const CORE = {
  key: 'core',
  name: 'Core line',
  night: 'var(--rail)',
  day: 'var(--rail)',
  stops: STATIONS.map((s) => s.id),
  what: 'The everyday structures every step stands on: a linked list of patients, a queue, an undo stack, arrays and a shuffle.',
  uses: {
    data: 'stores patients in a linked list, in file order',
    features: 'keeps each patient’s four numbers in an array',
    scale: 'holds a mean and spread per feature in arrays',
    split: 'shuffles each group with Fisher–Yates for a fair split',
    train: 'feeds the training rows to the models',
    predict: 'a queue for the waiting room, a stack for undo',
    evaluate: 'counts right and wrong answers in a 2×2 table',
    benchmark: 'the linked list is the simple way to find a patient',
  },
  complexity: ['linked list append O(1)', 'queue push / pop O(1)', 'stack push / pop O(1)'],
  file: 'headers/LinkedQueue.h, headers/Stack.h',
};

export const ALL_LINES = [...LINES, CORE];
export const lineByKey = (key) => ALL_LINES.find((l) => l.key === key);
export const linesAt = (stationId) => ALL_LINES.filter((l) => l.stops.includes(stationId));

export const FEATURES = [
  { key: 'avgMutation', name: 'Average mutation', define: 'The mean mutation score of the patient’s genes (0 to 1).' },
  { key: 'maxMutation', name: 'Highest mutation', define: 'The highest single mutation score (0 to 1).' },
  { key: 'highRiskGenes', name: 'High-risk genes', define: 'How many genes score 0.7 or more.' },
  { key: 'age', name: 'Age', define: 'The patient’s age in years.' },
];

export const MODELS = [
  { key: 'logistic', name: 'Logistic Regression', short: 'Logistic', color: 'var(--m-logistic)', dash: '' },
  { key: 'knn', name: 'K-Nearest Neighbors', short: 'KNN', color: 'var(--m-knn)', dash: '8 4' },
  { key: 'decision_tree', name: 'Decision Tree', short: 'Tree', color: 'var(--m-tree)', dash: '2 3' },
  { key: 'naive_bayes', name: 'Naive Bayes', short: 'Naive Bayes', color: 'var(--m-bayes)', dash: '10 3 2 3' },
];

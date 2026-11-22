// Benchmark helpers shared by the landing page and station 8.
const KEY = 'cds.benchmark.';

export function readCachedBenchmark(n) {
  try {
    const raw = window.sessionStorage.getItem(KEY + n);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheBenchmark(n, data) {
  try {
    window.sessionStorage.setItem(KEY + n, JSON.stringify(data));
  } catch {
    // Not cached: the next visit measures again
  }
}

const find = (data, task, variant) =>
  data.results.find((r) => r.task === task)?.variants.find((v) => v.name === variant)?.micros;

export function proofFrom(data) {
  const ratio = (task, slow, fast) => {
    const a = find(data, task, slow);
    const b = find(data, task, fast);
    return a && b ? a / b : 0;
  };
  return {
    items: [
      {
        key: 'kd',
        label: 'KD-tree vs sorting every distance',
        factor: ratio('Find 5 nearest neighbours', 'Brute force + full sort', 'KD-tree'),
        note: '100 nearest-neighbour searches',
      },
      {
        key: 'avl',
        label: 'AVL tree vs walking a linked list',
        factor: ratio('Find patient by ID', 'Linked list', 'AVL tree'),
        note: '200 lookups by patient ID',
      },
      {
        key: 'split',
        label: 'Decision-tree training with sorted prefix sums',
        factor: ratio('Train decision tree', 'Naive split search', 'Merge sort + prefix sums'),
        note: 'against trying every split the naive way',
      },
    ],
  };
}

// From docs/DSA.md (n = 20,000), used when the server is offline
export const PROOF_FALLBACK = proofFrom({
  results: [
    {
      task: 'Find 5 nearest neighbours',
      variants: [
        { name: 'Brute force + full sort', micros: 205109 },
        { name: 'KD-tree', micros: 356.6 },
      ],
    },
    {
      task: 'Find patient by ID',
      variants: [
        { name: 'Linked list', micros: 13203.1 },
        { name: 'AVL tree', micros: 51.4 },
      ],
    },
    {
      task: 'Train decision tree',
      variants: [
        { name: 'Naive split search', micros: 6173620 },
        { name: 'Merge sort + prefix sums', micros: 34391.9 },
      ],
    },
  ],
});

export function formatTime(us) {
  if (us < 1000) return `${us < 10 ? us.toFixed(1) : Math.round(us)} µs`;
  if (us < 1e6) return `${(us / 1000).toFixed(us < 1e4 ? 2 : 1)} ms`;
  return `${(us / 1e6).toFixed(2)} s`;
}

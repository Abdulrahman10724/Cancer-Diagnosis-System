// Recompute confusion matrix and metrics from per-sample risks at any threshold.
// Matches the server, which predicts 1 when risk >= threshold (0.5 by default).
export function computeMetrics(samples, threshold = 0.5) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const s of samples) {
    const predicted = s.risk >= threshold ? 1 : 0;
    if (predicted === 1 && s.label === 1) tp++;
    else if (predicted === 1 && s.label === 0) fp++;
    else if (predicted === 0 && s.label === 0) tn++;
    else fn++;
  }
  const total = tp + fp + tn + fn;
  const accuracy = total ? (tp + tn) / total : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, tn, fn, accuracy, precision, recall, f1 };
}

export const isCorrect = (sample, threshold = 0.5) =>
  (sample.risk >= threshold ? 1 : 0) === sample.label;

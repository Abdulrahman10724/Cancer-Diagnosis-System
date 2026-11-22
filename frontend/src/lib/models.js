// The four models, in fixed order. Colours identify models only.
export const MODELS = [
  { key: 'logistic', name: 'Logistic regression', short: 'Logistic', stain: 'var(--stain-lr)', gel: 'var(--gel-lr)' },
  { key: 'knn', name: 'K-nearest neighbors', short: 'KNN', stain: 'var(--stain-knn)', gel: 'var(--gel-knn)' },
  { key: 'decision_tree', name: 'Decision tree', short: 'Decision tree', stain: 'var(--stain-dt)', gel: 'var(--gel-dt)' },
  { key: 'naive_bayes', name: 'Naive Bayes', short: 'Naive Bayes', stain: 'var(--stain-nb)', gel: 'var(--gel-nb)' },
];

export const modelByKey = (key) => MODELS.find((m) => m.key === key);

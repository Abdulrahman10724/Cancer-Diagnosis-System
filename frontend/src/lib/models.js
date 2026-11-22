// The four models, in fixed order. Colours identify models only.
export const MODELS = [
  {
    key: 'logistic',
    name: 'Logistic Regression',
    short: 'Logistic Regression',
    color: 'var(--lr)',
    idea: 'Turns the gene score into a chance using an S-shaped curve.',
  },
  {
    key: 'knn',
    name: 'K-Nearest Neighbors',
    short: 'KNN',
    color: 'var(--knn)',
    idea: 'Finds the training genes most similar to this patient and lets them vote.',
  },
  {
    key: 'decision_tree',
    name: 'Decision Tree',
    short: 'Decision Tree',
    color: 'var(--dt)',
    idea: 'Asks a few yes/no questions about the score, like a flowchart.',
  },
  {
    key: 'naive_bayes',
    name: 'Naive Bayes',
    short: 'Naive Bayes',
    color: 'var(--nb)',
    idea: 'Compares how normal genes and cancer genes usually score, and picks the closer group.',
  },
];

export const modelByKey = (key) => MODELS.find((m) => m.key === key);

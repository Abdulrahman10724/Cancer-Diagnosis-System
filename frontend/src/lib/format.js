export const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export function num(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return Number(v).toFixed(digits);
}

export const int = (v) => Math.round(v).toLocaleString('en-US');

export function featureValue(key, v) {
  if (key === 'age' || key === 'highRiskGenes') return String(Math.round(v));
  return num(v, 3);
}

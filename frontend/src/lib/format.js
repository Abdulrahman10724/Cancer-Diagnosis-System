// Consistent number formatting: risk as % with 1 decimal, scores with 2 decimals.
export const pct = (r) => `${(r * 100).toFixed(1)}%`;
export const score = (s) => Number(s).toFixed(2);
export const fixed = (n, d = 3) => Number(n).toFixed(d);

export function clock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Certainty of a probability: 0 at 0.5, 1 at 0 or 1
export const certainty = (risk) => Math.abs(risk - 0.5) * 2;

export const outcomeWord = (prediction) => (prediction === 1 ? 'Cancerous' : 'Non-cancerous');

// Consistent number formatting: risk as % with 1 decimal, scores with 2 decimals.
export const pct = (r) => `${(r * 100).toFixed(1)}%`;
export const score = (s) => Number(s).toFixed(2);
export const fixed = (n, d = 3) => Number(n).toFixed(d);

export function clock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Certainty of a probability: 0 at 0.5, 1 at 0 or 1
export const certainty = (risk) => Math.abs(risk - 0.5) * 2;

export const outcomeWord = (prediction) => (prediction === 1 ? 'Cancerous' : 'Non-cancerous');

// Band geometry on the gel: certainty 1 -> 6px sharp band; certainty 0 -> 28px soft smear.
export function bandShape(risk) {
  const c = certainty(risk);
  return { height: 6 + (1 - c) * 22, blur: (1 - c) * 5 };
}

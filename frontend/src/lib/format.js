// Consistent number formatting.
export const pct = (r) => `${(r * 100).toFixed(1)}%`;
export const pct0 = (r) => `${Math.round(r * 100)}%`;
export const score = (s) => Number(s).toFixed(2);
export const fixed = (n, d = 3) => Number(n).toFixed(d);

export function clock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// The model says "cancer" when its chance is at or above this line
export const CANCER_LINE = 0.5;

// Certainty of a probability: 0 at 0.5, 1 at 0 or 1
export const certainty = (risk) => Math.abs(risk - 0.5) * 2;

// Confidence shown to people, from how far the chance is from the 50% line
export function confidence(risk) {
  const c = certainty(risk);
  if (c >= 0.6) return 'High';
  if (c >= 0.25) return 'Medium';
  return 'Low';
}

// Display level only (the prediction itself always uses the 50% line)
export function riskLevel(risk) {
  if (risk < 0.35) return 'low';
  if (risk <= 0.65) return 'medium';
  return 'high';
}

export const RISK_WORD = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };

export const outcomeWord = (prediction) => (prediction === 1 ? 'cancer' : 'no cancer');

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Band geometry used by the legacy gel screen (removed with it)
export function bandShape(risk) {
  const c = certainty(risk);
  return { height: 6 + (1 - c) * 22, blur: (1 - c) * 5 };
}

import { RiskBadge } from './Risk';

// LEGACY: outcome tag for screens not yet redesigned
export function OutcomeTag({ prediction }) {
  return <RiskBadge level={prediction === 1 ? 'high' : 'low'} label={prediction === 1 ? 'Cancer' : 'No cancer'} />;
}

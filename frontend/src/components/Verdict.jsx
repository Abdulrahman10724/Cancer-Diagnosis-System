import { BangIcon, CheckIcon, UpIcon } from './Icons';
import styles from './Verdict.module.css';

// Average risk 0.6 or more: high; 0.4 or less: low; between: borderline
// eslint-disable-next-line react-refresh/only-export-components
export function verdictOf(risk) {
  if (risk >= 0.6) return { tone: 'risk', word: 'High risk', Icon: UpIcon };
  if (risk <= 0.4) return { tone: 'safe', word: 'Low risk', Icon: CheckIcon };
  return { tone: 'mid', word: 'Borderline', Icon: BangIcon };
}

/** Outcome chip: always an icon and a word, never colour alone. */
export default function Verdict({ risk, size = 'lg' }) {
  const v = verdictOf(risk);
  return (
    <span className={`${styles.chip} ${styles[v.tone]} ${size === 'sm' ? styles.sm : ''}`}>
      <v.Icon size={size === 'sm' ? 12 : 16} />
      {v.word}
    </span>
  );
}

/** Right / wrong marker for evaluation tables. */
export function Outcome({ correct }) {
  return (
    <span className={`${styles.chip} ${styles.sm} ${correct ? styles.safe : styles.risk}`}>
      {correct ? <CheckIcon size={12} /> : <UpIcon size={12} />}
      {correct ? 'Right' : 'Wrong'}
    </span>
  );
}

import styles from './Tube.module.css';

// A sample tube standing in the rack, with its patient ID on the label.
export default function Tube({ id, highlight = false }) {
  return (
    <div className={`${styles.tube} ${highlight ? styles.highlight : ''}`}>
      <svg width="36" height="92" viewBox="0 0 36 92" aria-hidden="true">
        <rect x="6" y="0" width="24" height="12" rx="1" className={styles.cap} />
        <path d="M8 12 h20 v62 a10 10 0 0 1 -20 0 z" className={styles.glass} />
        <path d="M9 44 h18 v30 a9 9 0 0 1 -18 0 z" className={styles.sample} />
        <rect x="8" y="22" width="20" height="16" className={styles.labelStrip} />
        <path d="M11 25v10M13 25v10M16 25v10M17.5 25v10M20 25v10M23 25v10M25 25v10" className={styles.bars} />
      </svg>
      <span className={styles.id}>{id}</span>
    </div>
  );
}

import Well from './Well';
import styles from './Gel.module.css';

// One lane of the gel: name in text at the top, a well, and its band track.
export default function Lane({ title, swatch, children, footer, wide = false }) {
  return (
    <div className={`${styles.lane} ${wide ? styles.laneWide : ''}`}>
      <div className={styles.laneHead}>
        <span className={styles.swatch} style={{ background: swatch }} aria-hidden="true" />
        <span className={styles.laneTitle}>{title}</span>
      </div>
      <div className={styles.track}>
        <Well />
        {children}
      </div>
      <div className={styles.laneFoot}>{footer}</div>
    </div>
  );
}

export function OutcomeTag({ prediction }) {
  const cancerous = prediction === 1;
  return (
    <span className={`${styles.outcome} ${cancerous ? styles.outcomeRisk : styles.outcomeSafe}`}>
      {cancerous ? (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 1L11 10H1z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="5" fill="currentColor" />
        </svg>
      )}
      {cancerous ? 'Cancerous' : 'Non-cancerous'}
    </span>
  );
}

import styles from './States.module.css';

export function Loading({ label = 'Loading', lines = 3, tall = false }) {
  return (
    <div className={styles.loading} role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`${styles.bar} ${tall && i === 0 ? styles.tall : ''}`} />
      ))}
      <span className="vh">{label}…</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'This could not load' }) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorTitle}>{title}</p>
      <p>{error?.message || String(error)}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}

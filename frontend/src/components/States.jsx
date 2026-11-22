import styles from './States.module.css';

export function EmptyState({ title, children, action }) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, command, action }) {
  return (
    <div className={styles.error} role="alert">
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {command && (
        <p className={styles.command}>
          From the project folder, run <code>{command}</code>
        </p>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

// Grey placeholder shapes shown while something loads
export function Skeleton({ lines = 3, height = 16 }) {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ height, width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function LoadingState({ children = 'Loading…', lines = 3 }) {
  return (
    <div className={styles.loading}>
      <p className="visually-hidden" role="status">
        {children}
      </p>
      <Skeleton lines={lines} />
    </div>
  );
}

export function Disclaimer() {
  return <p className={styles.disclaimer}>Student project — not for real medical use.</p>;
}

export const START_COMMAND = './build/cds_server';

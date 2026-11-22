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
      <h3>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.5L15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 6v3.5M8 11.2v.8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        {title}
      </h3>
      {message && <p>{message}</p>}
      {command && (
        <div className={styles.command}>
          <p className={styles.commandLabel}>From the project folder, run:</p>
          <code>{command}</code>
        </div>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function LoadingState({ children = 'Loading…' }) {
  return (
    <p className={styles.loading} role="status">
      {children}
    </p>
  );
}

export const START_COMMAND = './build/cds_server';

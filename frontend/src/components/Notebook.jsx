import { useState } from 'react';
import { useAppState } from '../state/AppState';
import styles from './Notebook.module.css';

// Logs real events with the time they happened. No canned replies.
export default function Notebook() {
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const entries = state.notebook;

  const exportLog = () => {
    const lines = entries.map((e) => `${e.time}  ${e.text}`);
    const text = `Pathology Bench lab notebook\n\n${lines.join('\n')}\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lab-notebook.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className={`${styles.notebook} ${open ? styles.open : ''}`} aria-label="Lab notebook">
      <div className={styles.header}>
        <h2 className={styles.title}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            Lab notebook <span className={styles.count}>({entries.length})</span>
          </button>
          <span className={styles.staticTitle}>Lab notebook</span>
        </h2>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={exportLog}
          disabled={entries.length === 0}
        >
          Export log
        </button>
      </div>
      <div className={styles.body}>
        {entries.length === 0 ? (
          <p className={styles.empty}>
            Nothing recorded yet. Loading data, saving patients and running gels are written
            here as they happen.
          </p>
        ) : (
          <ol className={styles.list} aria-live="polite">
            {[...entries].reverse().map((entry) => (
              <li key={entry.id} className={styles.entry}>
                <time className={styles.time}>{entry.time}</time>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

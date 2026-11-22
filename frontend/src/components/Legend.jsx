import styles from './Legend.module.css';

export function Legend({ items, label = 'Legend' }) {
  return (
    <ul className={styles.legend} aria-label={label}>
      {items.map((it) => (
        <li key={it.label} className={styles.item}>
          {it.swatch}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Diagnosis marker: filled ink for cancer, grey ring for no cancer. */
export function DxSwatch({ cancer = false }) {
  return <span className={cancer ? styles.cancer : styles.clear} aria-hidden="true" />;
}

/** Model marker: an ink line with the model's dash pattern. */
export function ModelSwatch({ model }) {
  return (
    <svg width="28" height="10" aria-hidden="true" className={styles.model}>
      <line x1="1" x2="27" y1="5" y2="5" stroke={model.color} strokeWidth="3" strokeDasharray={model.dash} strokeLinecap="round" />
    </svg>
  );
}

import { useState } from 'react';
import { isCorrect } from '../lib/metrics';
import { pct, score } from '../lib/format';
import styles from './Plate.module.css';

const ROWS = 'ABCDEFGH';
const COLS = 12;

// A 96-well plate: one well per held-out test gene. Filled = correct, ring = wrong.
// One tab stop; arrow keys move between wells; the detail line shows the active well.
export default function Plate({ model, samples, threshold }) {
  const [active, setActive] = useState(null);
  const count = Math.min(samples.length, ROWS.length * COLS);

  const move = (event) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS };
    if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActive(count - 1);
      return;
    }
    if (!(event.key in keys)) return;
    event.preventDefault();
    const current = active === null ? 0 : active + keys[event.key];
    setActive(Math.max(0, Math.min(count - 1, current)));
  };

  const sample = active !== null ? samples[active] : null;
  const wellName = (i) => `${ROWS[Math.floor(i / COLS)]}${(i % COLS) + 1}`;
  const wrong = samples.filter((s) => !isCorrect(s, threshold)).length;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.swatch} style={{ background: model.stain }} aria-hidden="true" />
        <span className={styles.name}>{model.name}</span>
        <span className="hint">
          {samples.length - wrong} correct, {wrong} wrong
        </span>
      </figcaption>
      <div
        className={styles.plate}
        style={{ '--stain': model.stain }}
        tabIndex={0}
        role="group"
        aria-label={`${model.name} plate, ${samples.length} test genes. Use the arrow keys to read each well.`}
        aria-describedby={`${model.key}-plate-detail`}
        onKeyDown={move}
        onFocus={() => active === null && setActive(0)}
        onMouseLeave={() => setActive(null)}
      >
        <span className={styles.corner} aria-hidden="true" />
        {Array.from({ length: COLS }, (_, c) => (
          <span key={`c${c}`} className={styles.colLabel} aria-hidden="true">
            {c + 1}
          </span>
        ))}
        {Array.from({ length: ROWS.length }, (_, r) => (
          <div key={r} className={styles.row} aria-hidden="true">
            <span className={styles.rowLabel} aria-hidden="true">
              {ROWS[r]}
            </span>
            {Array.from({ length: COLS }, (_, c) => {
              const i = r * COLS + c;
              const s = samples[i];
              if (!s) return <span key={c} className={styles.unused} />;
              const correct = isCorrect(s, threshold);
              return (
                <span
                  key={c}
                  className={`${styles.well} ${correct ? styles.correct : styles.wrong} ${active === i ? styles.active : ''}`}
                  onMouseEnter={() => setActive(i)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p id={`${model.key}-plate-detail`} className={styles.detail} aria-live="polite">
        {sample ? (
          <>
            <strong>{wellName(active)}</strong> {sample.gene_id}, score {score(sample.mutation_score)}, true label{' '}
            {sample.label === 1 ? 'cancerous' : 'non-cancerous'}, predicted risk {pct(sample.risk)}:{' '}
            {isCorrect(sample, threshold) ? 'correct' : 'wrong'}
          </>
        ) : (
          <span className="hint">Point at a well, or focus the plate and use the arrow keys.</span>
        )}
      </p>
    </figure>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import { MODELS } from '../lib/models';
import { pct0 } from '../lib/format';
import styles from './CompareChart.module.css';

// All four models on one scale, with the 50% cancer line
export default function CompareChart({ result }) {
  const reduceMotion = useReducedMotion();
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>Compare all models</figcaption>
      <div className={styles.chart}>
        <div className={styles.lineWrap} aria-hidden="true">
          <span className={styles.line} />
          <span className={styles.lineLabel}>Cancer line 50%</span>
        </div>
        {MODELS.map((m, i) => {
          const r = result.models[m.key].risk;
          return (
            <div key={m.key} className={styles.row}>
              <span className={styles.label}>{m.name}</span>
              <span className={styles.track}>
                <motion.span
                  className={styles.bar}
                  style={{ background: m.color }}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${r * 100}%` }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18, delay: i * 0.08 }}
                />
              </span>
              <span className={styles.value}>{pct0(r)}</span>
            </div>
          );
        })}
      </div>
      <table className="visually-hidden">
        <caption>Chance of cancer by model</caption>
        <tbody>
          {MODELS.map((m) => (
            <tr key={m.key}>
              <th scope="row">{m.name}</th>
              <td>{pct0(result.models[m.key].risk)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

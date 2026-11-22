import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { confidence, pct0, score } from '../lib/format';
import Help from './Help';
import { CountUp, RiskBadge, RiskBar } from './Risk';
import styles from './ModelCard.module.css';

const K_OPTIONS = [1, 3, 5, 7, 9];

function GeneChips({ genes, index }) {
  const reduceMotion = useReducedMotion();
  const shown = genes.slice(0, 6);
  return (
    <div className={styles.reading} aria-hidden="true">
      <span className={styles.readingText}>Reading {genes.length} gene scores</span>
      <span className={styles.chips}>
        {shown.map((g, i) => (
          <motion.span
            key={`${g.gene_id}-${i}`}
            className={styles.chip}
            initial={reduceMotion ? false : { opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 + i * 0.04, duration: 0.25 }}
          >
            {score(g.mutation_score)}
          </motion.span>
        ))}
      </span>
    </div>
  );
}

function KChoice({ value, onChange, disabled }) {
  const labelId = useId();
  const onKeyDown = (e) => {
    const i = K_OPTIONS.indexOf(value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(K_OPTIONS[Math.min(K_OPTIONS.length - 1, i + 1)]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(K_OPTIONS[Math.max(0, i - 1)]);
    }
  };
  return (
    <div className={styles.k}>
      <span className={styles.kLabel} id={labelId}>
        How many similar genes to compare (K)
        <Help term="K">
          KNN looks for the K training genes whose scores are closest to this patient&apos;s
          score, then counts how many of them were cancer genes. A small K reacts to a few
          nearby genes; a large K looks at a wider group.
        </Help>
      </span>
      <div className={styles.kOptions} role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {K_OPTIONS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === value}
            tabIndex={k === value ? 0 : -1}
            className={styles.kOption}
            onClick={() => onChange(k)}
            disabled={disabled}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// One model's answer. state: 'waiting' | 'reading' | 'analyzing' | 'done'
export default function ModelCard({ model, data, state, index, genes, onWhy, k, onK, compact = false }) {
  const done = state === 'done' && data;
  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`} aria-label={model.name}>
      <header className={styles.head}>
        <span className={styles.dot} style={{ background: model.color }} aria-hidden="true" />
        <h3 className={styles.name}>{model.name}</h3>
        <Help term={model.name}>{model.idea}</Help>
      </header>

      {state === 'waiting' && <p className={styles.waiting}>Waiting for a patient.</p>}
      {state === 'reading' && <GeneChips genes={genes} index={index} />}
      {state === 'analyzing' && (
        <div className={styles.analyzing}>
          <span>Analyzing…</span>
          <span className={styles.scan} aria-hidden="true" />
        </div>
      )}

      {done && (
        <div className={styles.result}>
          <div className={styles.numberRow}>
            <span className={styles.number}>
              <CountUp value={Math.round(data.risk * 100)} duration={0.7} />
            </span>
            <RiskBadge risk={data.risk} />
          </div>
          <RiskBar value={data.risk} color={model.color} label={`${model.name}: ${pct0(data.risk)} chance of cancer`} />
          {!compact && (
            <p className={styles.sentence}>
              {model.short} thinks there is a {pct0(data.risk)} chance of cancer, so it says{' '}
              <strong>{data.prediction === 1 ? 'cancer' : 'no cancer'}</strong>.
            </p>
          )}
          <p className={styles.confidence}>
            Confidence: <strong>{confidence(data.risk)}</strong>
            <Help term="Confidence">
              How sure the model is. A chance far from the 50% cancer line (like 5% or 95%)
              means high confidence. A chance near 50% means the model is unsure.
            </Help>
          </p>
          {onK && !compact && <KChoice value={k} onChange={onK} />}
          <button type="button" className={`btn ${styles.why}`} onClick={onWhy}>
            Why this result?
          </button>
        </div>
      )}
    </article>
  );
}

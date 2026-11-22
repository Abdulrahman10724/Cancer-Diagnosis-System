import { motion, useReducedMotion } from 'framer-motion';
import { scaleLinear } from 'd3-scale';
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import Segmented from '../components/Segmented';
import StationLayout from '../components/StationLayout';
import { ErrorState, Loading } from '../components/States';
import { Term } from '../components/Popover';
import { FEATURES } from '../lib/metro';
import { num } from '../lib/format';
import useApi from '../lib/useApi';
import { useJourney } from '../state/Journey';
import styles from './Scale.module.css';

const SAMPLE = 150;

export default function Scale() {
  const { complete } = useJourney();
  const [mode, setMode] = useState('raw');
  const stats = useApi((signal) => api.features({ signal }), []);
  const patients = useApi((signal) => api.patients({ signal }), []);

  const choose = (m) => {
    setMode(m);
    if (m === 'scaled') complete('scale');
  };

  return (
    <StationLayout
      id="scale"
      sentence="Features use different units. Scaling puts them on the same ruler so no feature dominates."
      todo="Switch to “Scaled” once to continue."
    >
      {(stats.loading || patients.loading) && <Loading label="Reading the features" tall />}
      {(stats.error || patients.error) && (
        <ErrorState error={stats.error || patients.error} onRetry={() => (stats.reload(), patients.reload())} />
      )}
      {stats.data && patients.data && (
        <Rulers stats={stats.data} patients={patients.data} mode={mode} onMode={choose} />
      )}
    </StationLayout>
  );
}

function Rulers({ stats, patients, mode, onMode }) {
  const reduce = useReducedMotion();
  const scaled = mode === 'scaled';

  // Every k-th patient, so the sample is spread evenly and the same each time
  const sample = useMemo(() => {
    const step = Math.max(1, Math.floor(patients.length / SAMPLE));
    return patients.filter((_, i) => i % step === 0).slice(0, SAMPLE);
  }, [patients]);

  const byName = Object.fromEntries(stats.features.map((f) => [f.name, f.overall]));
  const rawMax = Math.max(...FEATURES.map((f) => byName[f.key].max));
  const W = 1000;
  const left = 190;
  const right = 24;
  const rowH = 74;
  const top = 34;
  const H = top + FEATURES.length * rowH + 20;
  const xRaw = scaleLinear().domain([0, Math.ceil(rawMax / 10) * 10]).range([left, W - right]);
  const xZ = scaleLinear().domain([-3, 3]).range([left, W - right]);
  const x = scaled ? xZ : xRaw;
  const ticks = scaled ? [-3, -2, -1, 0, 1, 2, 3] : xRaw.ticks(9);
  const z = (key, v) => {
    const s = byName[key];
    const value = (v - s.mean) / (s.std || 1);
    return Math.max(-3, Math.min(3, value));
  };
  // Small, fixed vertical jitter so dots do not hide each other
  const jitter = (i) => ((i * 37) % 21) - 10;

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <Segmented
          label="Ruler"
          value={mode}
          onChange={onMode}
          options={[
            { value: 'raw', label: 'Raw' },
            { value: 'scaled', label: 'Scaled' },
          ]}
        />
        <p className={`mono ${styles.formula}`} aria-label="z equals x minus the mean, divided by the standard deviation">
          z = (x − mean) / std
        </p>
      </div>
      <p className={styles.caption} aria-live="polite">
        {scaled
          ? 'Scaled: every feature now spreads over the same −3 to +3 ruler. 0 is the average patient.'
          : 'Raw: all four on one ruler in their own units. The mutation scores (0 to 1) are squashed against the left edge.'}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${sample.length} patients on four rulers, ${scaled ? 'scaled' : 'raw values'}`}>
        {ticks.map((t) => (
          <g key={`${mode}-${t}`}>
            <line x1={x(t)} x2={x(t)} y1={top - 8} y2={H - 16} className={t === 0 && scaled ? styles.zero : styles.grid} />
            <text x={x(t)} y={top - 14} textAnchor="middle" className={styles.tick}>
              {scaled && t > 0 ? `+${t}` : t}
            </text>
          </g>
        ))}
        {FEATURES.map((f, row) => {
          const y = top + row * rowH + rowH / 2;
          const s = byName[f.key];
          return (
            <g key={f.key}>
              <line x1={left} x2={W - right} y1={y} y2={y} className={styles.ruler} />
              <text x={0} y={y - 4} className={styles.rowName}>
                {f.name}
              </text>
              <text x={0} y={y + 16} className={styles.rowStats}>
                mean {num(s.mean, f.key === 'age' ? 1 : 2)}, std {num(s.std, 2)}
              </text>
              {sample.map((p, i) => {
                const v = p.features[f.key];
                const cx = scaled ? xZ(z(f.key, v)) : xRaw(v);
                return (
                  <motion.circle
                    key={p.patient_id}
                    cy={y + jitter(i) * 0.9}
                    r={4}
                    className={styles.dot}
                    initial={false}
                    animate={{ cx }}
                    transition={reduce ? { duration: 0 } : { duration: 0.6, delay: (i % 30) * 0.004, ease: [0.22, 0.8, 0.3, 1] }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <p className={styles.note}>
        Without scaling, age (20–85) would outweigh mutation scores (0–1) in{' '}
        <Term meaning="K-Nearest Neighbors measures how far apart two patients are; a feature with big numbers would decide that distance alone.">KNN</Term>{' '}
        distances.
      </p>
      <p className="muted small">
        These rulers use the mean and spread of all {patients.length} patients ({stats.features.length} features); the models
        use the training patients’ values only, so the test stays fair.
      </p>
    </div>
  );
}

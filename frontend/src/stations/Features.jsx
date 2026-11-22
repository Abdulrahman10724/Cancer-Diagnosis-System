import { motion, useReducedMotion } from 'framer-motion';
import { scaleLinear } from 'd3-scale';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import CountUp from '../components/CountUp';
import PatientPicker from '../components/PatientPicker';
import Segmented from '../components/Segmented';
import StationLayout from '../components/StationLayout';
import Tabs from '../components/Tabs';
import { ErrorState, Loading } from '../components/States';
import { Legend, DxSwatch } from '../components/Legend';
import { FEATURES } from '../lib/metro';
import { featureValue, num } from '../lib/format';
import useApi from '../lib/useApi';
import { useJourney } from '../state/Journey';
import styles from './Features.module.css';

export default function Features() {
  const [tab, setTab] = useState('patient');
  return (
    <StationLayout
      id="features"
      sentence="Each patient’s genes are turned into four numbers the models can learn from."
      todo="Pick a patient to see their four numbers."
    >
      <Tabs
        label="Features"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'patient', label: 'One patient' },
          { id: 'groups', label: 'Compare groups' },
          { id: 'correlation', label: 'Correlation' },
        ]}
      >
        {tab === 'patient' && <OnePatient />}
        {tab === 'groups' && <Groups />}
        {tab === 'correlation' && <Correlation />}
      </Tabs>
    </StationLayout>
  );
}

function OnePatient() {
  const reduce = useReducedMotion();
  const { complete } = useJourney();
  const patients = useApi((signal) => api.patients({ signal }), []);
  const genes = useApi((signal) => api.genes({ signal }), []);
  const [id, setId] = useState(null);
  const scores = useMemo(() => {
    const m = new Map();
    (genes.data || []).forEach((g) => m.set(g.gene_id, g.mutation_score));
    return m;
  }, [genes.data]);

  useEffect(() => {
    if (id) complete('features');
  }, [id, complete]);

  if (patients.loading || genes.loading) return <Loading label="Reading patients" />;
  if (patients.error || genes.error)
    return <ErrorState error={patients.error || genes.error} onRetry={() => (patients.reload(), genes.reload())} />;

  const p = patients.data.find((x) => x.patient_id === id);
  const chipDelay = (i) => (reduce ? 0 : i * 0.06);
  const countDelay = reduce ? 0 : 0.25 + (p ? p.geneIds.length : 0) * 0.06;

  return (
    <div className={styles.one}>
      <PatientPicker patients={patients.data} value={id} onChange={setId} label="Pick a patient" />
      {!p && <p className="muted">Pick any patient. Their genes appear, then become four numbers.</p>}
      {p && (
        <div className={styles.flow} key={p.patient_id}>
          <div>
            <p className="label">
              {p.name} has {p.geneIds.length} {p.geneIds.length === 1 ? 'gene' : 'genes'} with these mutation scores
            </p>
            <ul className={styles.chips}>
              {p.geneIds.map((g, i) => {
                const s = scores.get(g);
                return (
                  <motion.li
                    key={g}
                    className={`${styles.gene} ${s >= 0.7 ? styles.geneHigh : ''}`}
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: chipDelay(i), duration: 0.2 }}
                  >
                    <span className="mono">{g}</span>
                    <strong>{s === undefined ? '–' : s.toFixed(3)}</strong>
                    {s >= 0.7 && <span className={styles.highTag}>0.7 or more</span>}
                  </motion.li>
                );
              })}
            </ul>
          </div>
          <div className={styles.arrowDown} aria-hidden="true" />
          <dl className={styles.counters}>
            {FEATURES.map((f) => (
              <div key={f.key} className={styles.counter}>
                <dt className={styles.counterName}>
                  {f.name} <span className="mono muted">{f.key}</span>
                </dt>
                <dd className={styles.counterValue}>
                  <DelayedCount value={p.features[f.key]} delay={countDelay} format={(v) => featureValue(f.key, v)} />
                </dd>
                <dd className={styles.counterDef}>{f.define}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function DelayedCount({ value, delay, format }) {
  const [go, setGo] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return undefined;
    const t = window.setTimeout(() => setGo(true), delay * 1000);
    return () => window.clearTimeout(t);
  }, [delay]);
  return <CountUp value={value} start={go} format={format} />;
}

function useFeatureStats() {
  return useApi((signal) => api.features({ signal }), []);
}

function Groups() {
  const stats = useFeatureStats();
  const [feature, setFeature] = useState('avgMutation');
  if (stats.loading) return <Loading label="Reading feature statistics" tall />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;
  const f = stats.data.features.find((x) => x.name === feature);
  const meta = FEATURES.find((x) => x.key === feature);
  return (
    <div className={styles.groups}>
      <div className={styles.controls}>
        <Segmented
          label="Feature"
          size="sm"
          value={feature}
          onChange={setFeature}
          options={FEATURES.map((x) => ({ value: x.key, label: x.name }))}
        />
        <Legend
          items={[
            { label: `Cancer (${stats.data.labelled.cancer})`, swatch: <DxSwatch cancer /> },
            { label: `No cancer (${stats.data.labelled.noCancer})`, swatch: <DxSwatch /> },
          ]}
        />
      </div>
      <p className={styles.chartTitle}>
        How many patients have each {meta.name.toLowerCase()} value, by diagnosis
      </p>
      <Histogram key={feature} hist={f.histogram} featureKey={feature} />
      <p className="muted small">
        Group means: cancer {num(f.cancer.mean, 3)}, no cancer {num(f.noCancer.mean, 3)}. The further
        apart the two groups, the more this number helps the models.
      </p>
    </div>
  );
}

function Histogram({ hist, featureKey }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(null);
  const W = 1100;
  const H = 320;
  const m = { l: 44, r: 36, t: 12, b: 48 };
  const bins = hist.cancer.length;
  const maxY = Math.max(...hist.cancer, ...hist.noCancer, 1);
  const x = scaleLinear().domain([0, bins]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, maxY]).nice().range([H - m.b, m.t]);
  const ticks = y.ticks(4);
  const bw = (x(1) - x(0)) / 2 - 3;
  const edge = (i) => hist.binStart + i * hist.binWidth;
  const label = (v) => featureValue(featureKey, v);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="Histogram of the feature for cancer and no-cancer patients">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className={styles.tick}>
              {t}
            </text>
          </g>
        ))}
        {hist.cancer.map((c, i) => {
          const n = hist.noCancer[i];
          const x0 = x(i) + 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x(i)} y={m.t} width={x(1) - x(0)} height={H - m.b - m.t} className={hover === i ? styles.hoverBand : styles.band} />
              <Bar x={x0} w={bw} y0={y(0)} y1={y(c)} className={styles.barCancer} reduce={reduce} delay={i * 0.03} />
              <Bar x={x0 + bw + 2} w={bw} y0={y(0)} y1={y(n)} className={styles.barClear} reduce={reduce} delay={i * 0.03} />
            </g>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} className={styles.axis} />
        {Array.from({ length: bins + 1 }, (_, i) => i)
          .filter((i) => i % 2 === 0)
          .map((i) => (
            <text key={i} x={x(i)} y={H - m.b + 18} textAnchor="middle" className={styles.tick}>
              {label(edge(i))}
            </text>
          ))}
        <text x={m.l} y={H - 6} className={styles.axisTitle}>
          {FEATURES.find((f) => f.key === featureKey).name}
        </text>
      </svg>
      {hover !== null && (
        <div className={styles.tooltip} style={{ left: `${((x(hover) + x(hover + 1)) / 2 / W) * 100}%` }} role="status">
          <strong>
            {label(edge(hover))} to {label(edge(hover + 1))}
          </strong>
          <span>
            <DxSwatch cancer /> Cancer {hist.cancer[hover]}
          </span>
          <span>
            <DxSwatch /> No cancer {hist.noCancer[hover]}
          </span>
        </div>
      )}
      <table className="vh">
        <caption>Histogram values</caption>
        <thead>
          <tr>
            <th>From</th>
            <th>Cancer</th>
            <th>No cancer</th>
          </tr>
        </thead>
        <tbody>
          {hist.cancer.map((c, i) => (
            <tr key={i}>
              <td>{label(edge(i))}</td>
              <td>{c}</td>
              <td>{hist.noCancer[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bar({ x, w, y0, y1, className, reduce, delay }) {
  const h = Math.max(0, y0 - y1);
  if (h === 0) return null;
  return (
    <motion.rect
      x={x}
      width={w}
      rx={2}
      className={className}
      initial={reduce ? false : { y: y0, height: 0 }}
      animate={{ y: y1, height: h }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.45, ease: [0.22, 0.8, 0.3, 1] }}
    />
  );
}

function Correlation() {
  const stats = useFeatureStats();
  const [hover, setHover] = useState(null);
  if (stats.loading) return <Loading label="Reading the correlations" tall />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;
  const { labels, matrix } = stats.data.correlation;
  const names = labels.map((l) => FEATURES.find((f) => f.key === l)?.name || 'Diagnosis');
  const color = scaleLinear().domain([-1, 0, 1]).range(['#2F6690', '#EEF0F3', '#A8432F']);
  const n = labels.length;
  const cell = 76;
  const left = 150;
  const top = 8;
  const W = left + n * cell;
  const H = top + n * cell + 110;
  const diagRow = labels.length - 1;
  const strongest = labels
    .slice(0, -1)
    .map((l, i) => ({ name: names[i], v: matrix[diagRow][i] }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];

  return (
    <div className={styles.corr}>
      <p className={styles.chartTitle}>
        <span>How strongly two numbers move together.</span> +1 means always up together, −1 means one goes up when the other
        goes down, 0 means no link.
      </p>
      <div className={styles.corrLayout}>
        <div className={styles.heatWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.heat} role="img" aria-label="Correlation matrix of the four features and the diagnosis">
            {matrix.map((row, i) =>
              row.map((v, j) => {
                const dark = Math.abs(v) > 0.55;
                const on = hover && hover.i === i && hover.j === j;
                return (
                  <g
                    key={`${i}-${j}`}
                    onMouseEnter={() => setHover({ i, j })}
                    onMouseLeave={() => setHover(null)}
                    tabIndex={0}
                    onFocus={() => setHover({ i, j })}
                    onBlur={() => setHover(null)}
                    aria-label={`${names[i]} and ${names[j]}: ${v.toFixed(2)}`}
                    className={styles.cellG}
                  >
                    <rect
                      x={left + j * cell + 1}
                      y={top + i * cell + 1}
                      width={cell - 2}
                      height={cell - 2}
                      rx={3}
                      fill={color(v)}
                      className={on ? styles.cellOn : undefined}
                    />
                    <text
                      x={left + j * cell + cell / 2}
                      y={top + i * cell + cell / 2 + 5}
                      textAnchor="middle"
                      className={dark ? styles.cellTextLight : styles.cellText}
                    >
                      {v.toFixed(2)}
                    </text>
                  </g>
                );
              }),
            )}
            {names.map((nm, i) => (
              <text key={`r-${nm}`} x={left - 10} y={top + i * cell + cell / 2 + 5} textAnchor="end" className={styles.heatLabel}>
                {nm}
              </text>
            ))}
            {names.map((nm, j) => (
              <text
                key={`c-${nm}`}
                x={left + j * cell + cell / 2}
                y={top + n * cell + 12}
                textAnchor="end"
                transform={`rotate(-40 ${left + j * cell + cell / 2} ${top + n * cell + 12})`}
                className={styles.heatLabel}
              >
                {nm}
              </text>
            ))}
          </svg>
        </div>
        <div className={styles.corrSide}>
          <div className={styles.scaleKey} aria-hidden="true">
            <span className={styles.scaleBar} />
            <span className={styles.scaleTicks}>
              <span>−1</span>
              <span>0</span>
              <span>+1</span>
            </span>
          </div>
          <p className={styles.reading} aria-live="polite">
            {hover
              ? `${names[hover.i]} and ${names[hover.j]}: ${matrix[hover.i][hover.j].toFixed(2)}`
              : 'Point at a square to read it.'}
          </p>
          <p className="small">
            The bottom row matters most: it shows how each number moves with the diagnosis.{' '}
            <strong>{strongest.name}</strong> is the strongest ({strongest.v.toFixed(2)}).
          </p>
        </div>
      </div>
    </div>
  );
}

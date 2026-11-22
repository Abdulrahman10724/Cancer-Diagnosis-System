import { motion, useReducedMotion } from 'framer-motion';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import Segmented from '../components/Segmented';
import StationLayout from '../components/StationLayout';
import Tabs from '../components/Tabs';
import { ErrorState, Loading } from '../components/States';
import { ModelSwatch } from '../components/Legend';
import { Term } from '../components/Popover';
import { MODELS } from '../lib/metro';
import { num, pct } from '../lib/format';
import useApi from '../lib/useApi';
import { useJourney } from '../state/Journey';
import styles from './Evaluate.module.css';

const MEANING = {
  accuracy: 'Out of all test patients, the share the model got right.',
  precision: 'When the model says cancer, how often it is right.',
  recall: 'Out of the patients who had cancer, the share the model found.',
  f1: 'One number that balances precision and recall (their harmonic mean).',
};

// Metrics at a threshold, computed here from the per-patient test risks
function score(samples, t) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  samples.forEach((s) => {
    const says = s.risk >= t ? 1 : 0;
    if (says === 1 && s.diagnosis === 1) tp++;
    else if (says === 1) fp++;
    else if (s.diagnosis === 1) fn++;
    else tn++;
  });
  const n = tp + fp + tn + fn;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    tp,
    fp,
    tn,
    fn,
    accuracy: n ? (tp + tn) / n : 0,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    fpr: fp + tn ? fp / (fp + tn) : 0,
    tpr: recall,
  };
}

export default function Evaluate() {
  const { complete } = useJourney();
  const evaluation = useApi((signal) => api.evaluate({ signal }), []);
  const [t, setT] = useState(0.5);
  const [tab, setTab] = useState('scores');

  const changeT = (v) => {
    setT(v);
    complete('evaluate');
  };
  const changeTab = (id) => {
    setTab(id);
    if (id === 'roc') complete('evaluate');
  };

  return (
    <StationLayout
      id="evaluate"
      sentence={`We test each model on the ${evaluation.data?.split.test ?? 80} hidden patients and see how often it was right.`}
      todo="Move the threshold or open the ROC view to continue."
      resultNote
    >
      {evaluation.loading && <Loading label="Testing the models" tall />}
      {evaluation.error && <ErrorState error={evaluation.error} onRetry={evaluation.reload} />}
      {evaluation.data && (
        <div className={styles.wrap}>
          <div className={styles.threshold}>
            <label htmlFor="threshold" className={styles.tLabel}>
              Cancer line (threshold): <strong>{pct(t)}</strong>
            </label>
            <input
              id="threshold"
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={t}
              onChange={(e) => changeT(Number(e.target.value))}
              className={styles.range}
              aria-describedby="threshold-note"
            />
            <p id="threshold-note" className="muted small">
              A model says cancer when its risk is at or above this line. Lower threshold → catches more cancers, more false
              alarms.
            </p>
          </div>
          <Tabs
            label="Evaluation"
            value={tab}
            onChange={changeTab}
            tabs={[
              { id: 'scores', label: 'Scores' },
              { id: 'roc', label: 'ROC curve' },
              { id: 'cv', label: 'Cross-validation' },
            ]}
          >
            {tab === 'scores' && <Scores data={evaluation.data} t={t} />}
            {tab === 'roc' && <Roc data={evaluation.data} t={t} />}
            {tab === 'cv' && <CrossVal data={evaluation.data} />}
          </Tabs>
        </div>
      )}
    </StationLayout>
  );
}

function Scores({ data, t }) {
  const [model, setModel] = useState('logistic');
  const rows = useMemo(() => data.models.map((m) => ({ key: m.key, name: m.name, ...score(m.samples, t) })), [data, t]);
  const sel = rows.find((r) => r.key === model);
  const best = (k) => Math.max(...rows.map((r) => r[k]));
  return (
    <div className={styles.scores}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="vh">Test scores per model at a {pct(t)} threshold</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              {['accuracy', 'precision', 'recall', 'f1'].map((k) => (
                <th key={k} scope="col">
                  <Term meaning={MEANING[k]}>{k === 'f1' ? 'F1' : k.charAt(0).toUpperCase() + k.slice(1)}</Term>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = MODELS.find((x) => x.key === r.key);
              return (
                <tr key={r.key} className={r.key === model ? styles.rowOn : undefined}>
                  <th scope="row">
                    <button type="button" className={styles.rowBtn} aria-pressed={r.key === model} onClick={() => setModel(r.key)}>
                      <ModelSwatch model={m} /> {r.name}
                    </button>
                  </th>
                  {['accuracy', 'precision', 'recall', 'f1'].map((k) => (
                    <td key={k} className={r[k] === best(k) ? styles.best : undefined}>
                      {pct(r[k], 1)}
                      {r[k] === best(k) && <span className="vh"> (best)</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Bold = best in its column. Press a model to see its 2×2 table.</p>
      </div>

      <div className={styles.confusion}>
        <p className={styles.confTitle}>{sel.name} on the {sel.tp + sel.fp + sel.tn + sel.fn} test patients</p>
        <div className={styles.grid2} role="table" aria-label={`Confusion matrix for ${sel.name}`}>
          <div role="row" className={styles.gridRow}>
            <Cell good n={sel.tp} label="Found cancer" sub="had cancer, model said cancer" />
            <Cell n={sel.fn} label="Missed cancer" sub="had cancer, model said no" />
          </div>
          <div role="row" className={styles.gridRow}>
            <Cell n={sel.fp} label="False alarm" sub="no cancer, model said cancer" />
            <Cell good n={sel.tn} label="Correctly clear" sub="no cancer, model said no" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ n, label, sub, good }) {
  return (
    <div role="cell" className={`${styles.cell} ${good ? styles.cellGood : styles.cellBad}`}>
      <span className={styles.cellN}>{n}</span>
      <span className={styles.cellLabel}>
        {good ? '✓' : '▲'} {label}
      </span>
      <span className={styles.cellSub}>{sub}</span>
    </div>
  );
}

function Roc({ data, t }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(null);
  const S = 460;
  const m = { l: 56, r: 16, t: 16, b: 52 };
  const x = scaleLinear().domain([0, 1]).range([m.l, S - m.r]);
  const y = scaleLinear().domain([0, 1]).range([S - m.b, m.t]);
  const ln = line().x((d) => x(d[0])).y((d) => y(d[1]));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const models = data.models.map((md) => ({ ...md, meta: MODELS.find((x2) => x2.key === md.key), at: score(md.samples, t) }));
  return (
    <div className={styles.rocLayout}>
      <svg viewBox={`0 0 ${S} ${S}`} className={styles.roc} role="img" aria-label="ROC curves of the four models">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={m.t} y2={S - m.b} className={styles.grid} />
            <line x1={m.l} x2={S - m.r} y1={y(v)} y2={y(v)} className={styles.grid} />
            <text x={x(v)} y={S - m.b + 18} textAnchor="middle" className={styles.tick}>
              {pct(v)}
            </text>
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" className={styles.tick}>
              {pct(v)}
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className={styles.diag} />
        <text x={x(0.62)} y={y(0.55)} className={styles.diagLabel} transform={`rotate(-45 ${x(0.62)} ${y(0.55)})`}>
          random guess
        </text>
        {models.map((md, i) => (
          <motion.path
            key={md.key}
            d={ln(md.roc.points)}
            fill="none"
            stroke={md.meta.color}
            strokeWidth={hover === md.key ? 3.5 : 2.2}
            strokeDasharray={md.meta.dash || undefined}
            opacity={hover && hover !== md.key ? 0.3 : 1}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: reduce ? 0 : i * 0.12, duration: 0.6, ease: 'easeInOut' }}
          />
        ))}
        {models.map((md) => (
          <circle
            key={`dot-${md.key}`}
            cx={x(md.at.fpr)}
            cy={y(md.at.tpr)}
            r={6}
            className={styles.rocDot}
            stroke={md.meta.color}
            opacity={hover && hover !== md.key ? 0.3 : 1}
          />
        ))}
        <text x={(m.l + S - m.r) / 2} y={S - 10} textAnchor="middle" className={styles.axisTitle}>
          False alarms (share of no-cancer patients flagged)
        </text>
        <text x={14} y={(m.t + S - m.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(m.t + S - m.b) / 2})`} className={styles.axisTitle}>
          Cancers found
        </text>
      </svg>
      <div className={styles.rocSide}>
        <p>
          Each curve shows every possible threshold at once: further up and to the left is better. The dot is where the current
          threshold ({pct(t)}) puts each model. <Term meaning="Area under the ROC curve: 1.0 is perfect, 0.5 is guessing.">AUC</Term>{' '}
          sums the curve up in one number.
        </p>
        <ul className={styles.rocLegend}>
          {models.map((md) => (
            <li key={md.key}>
              <button
                type="button"
                className={styles.legendBtn}
                onMouseEnter={() => setHover(md.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(md.key)}
                onBlur={() => setHover(null)}
              >
                <ModelSwatch model={md.meta} />
                <span className={styles.legendName}>{md.name}</span>
                <span className={styles.legendAuc}>AUC {num(md.roc.auc, 3)}</span>
                <span className="muted small">
                  at {pct(t)}: finds {pct(md.at.tpr)}, false alarms {pct(md.at.fpr)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CrossVal({ data }) {
  const cv = useApi((signal) => api.crossval(5, { signal }), []);
  const [metric, setMetric] = useState('accuracy');
  if (cv.loading) return <Loading label="Running 5-fold cross-validation" />;
  if (cv.error) return <ErrorState error={cv.error} onRetry={cv.reload} />;
  const rows = cv.data.models.map((m) => ({
    key: m.key,
    name: m.name,
    mean: m[metric].mean,
    std: m[metric].std,
    split: data.models.find((x) => x.key === m.key)[metric],
  }));
  const rank = (k) => [...rows].sort((a, b) => b[k] - a[k]).map((r) => r.key);
  const splitRank = rank('split');
  const cvRank = rank('mean');
  const overfit = rows.find((r) => splitRank.indexOf(r.key) === 0 && cvRank.indexOf(r.key) >= 2);
  // Zoom the chart to the range the scores cover
  const lo = Math.max(0, Math.floor((Math.min(...rows.map((r) => Math.min(r.mean - r.std, r.split))) - 0.02) * 20) / 20);
  const hi = Math.min(1, Math.ceil((Math.max(...rows.map((r) => Math.max(r.mean + r.std, r.split))) + 0.02) * 20) / 20);
  const at = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className={styles.cv}>
      <div className={styles.cvTop}>
        <p>
          The 80/20 split is one draw. 5-fold cross-validation trains and tests five times, so every patient is tested once.
        </p>
        <Segmented
          label="Metric"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'accuracy', label: 'Accuracy' },
            { value: 'f1', label: 'F1' },
          ]}
        />
      </div>
      <table className={styles.table}>
        <caption className="vh">Cross-validation {metric}</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">5-fold mean ± spread</th>
            <th scope="col">80/20 split</th>
            <th scope="col" className={styles.barCol}>
              <span className={styles.cvAxis}>
                <span>{pct(lo)}</span>
                <span>{pct(hi)}</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const md = MODELS.find((x) => x.key === r.key);
            return (
              <tr key={r.key}>
                <th scope="row">
                  <span className={styles.rowName}>
                    <ModelSwatch model={md} /> {r.name}
                  </span>
                </th>
                <td>
                  {pct(r.mean, 1)} ± {pct(r.std, 1)}
                </td>
                <td>{pct(r.split, 1)}</td>
                <td className={styles.barCol}>
                  <span className={styles.cvTrack} aria-hidden="true">
                    <span className={styles.cvSpread} style={{ left: at(r.mean - r.std), width: `${((2 * r.std) / (hi - lo)) * 100}%` }} />
                    <span className={styles.cvMean} style={{ left: at(r.mean) }} />
                    <span className={styles.cvSplit} style={{ left: at(r.split) }} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">In the chart: bar = 5-fold mean ± spread, ring = the single 80/20 split.</p>
      <p className={styles.cvNote}>
        {overfit
          ? `${overfit.name} wins on the 80/20 split but ranks ${cvRank.indexOf(overfit.key) + 1} of 4 on 5-fold. A model that wins on one split but loses on 5-fold is overfitting: it learned that split, not the pattern.`
          : 'A model that wins on one split but loses on 5-fold is overfitting: it learned that split, not the pattern.'}
      </p>
    </div>
  );
}

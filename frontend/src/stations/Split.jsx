import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import Segmented from '../components/Segmented';
import StationLayout from '../components/StationLayout';
import { ErrorState, Loading } from '../components/States';
import { Legend, DxSwatch } from '../components/Legend';
import { Term } from '../components/Popover';
import { MODELS } from '../lib/metro';
import { pct } from '../lib/format';
import useApi from '../lib/useApi';
import { useJourney } from '../state/Journey';
import styles from './Split.module.css';

const W = 900;
const GAP = 15;

export default function Split() {
  const patients = useApi((signal) => api.patients({ signal }), []);
  const evaluation = useApi((signal) => api.evaluate({ signal }), []);
  const loading = patients.loading || evaluation.loading;
  const error = patients.error || evaluation.error;
  return (
    <StationLayout
      id="split"
      sentence="We hide 20% of patients from the models so we can test them fairly."
      todo="Press “Split the data” to continue."
    >
      {loading && <Loading label="Reading patients" tall />}
      {error && <ErrorState error={error} onRetry={() => (patients.reload(), evaluation.reload())} />}
      {!loading && !error && <Dots patients={patients.data} evaluation={evaluation.data} />}
    </StationLayout>
  );
}

// Grid positions: `count` dots in `cols` columns starting at (x0, y0)
function grid(count, cols, x0, y0) {
  return Array.from({ length: count }, (_, i) => ({ x: x0 + (i % cols) * GAP, y: y0 + Math.floor(i / cols) * GAP }));
}

function Dots({ patients, evaluation }) {
  const reduce = useReducedMotion();
  const { complete, isDone } = useJourney();
  const [phase, setPhase] = useState(isDone('split') ? 'split' : 'all'); // all | shuffle | split
  const [view, setView] = useState('split'); // split | folds
  const [model, setModel] = useState('logistic');
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cv = useApi((signal) => api.crossval(5, { signal }), [], { skip: view !== 'folds' });

  const labelled = useMemo(() => patients.filter((p) => p.diagnosis === 0 || p.diagnosis === 1), [patients]);
  const testIds = useMemo(() => new Set(evaluation.models[0].samples.map((s) => s.patient_id)), [evaluation]);
  const { train: nTrain, test: nTest } = evaluation.split;

  // Where each dot goes in each layout. Cancer patients first inside every group, so the ratio is visible.
  const layout = useMemo(() => {
    const order = (list) => [...list.filter((p) => p.diagnosis === 1), ...list.filter((p) => p.diagnosis === 0)];
    const all = order(labelled);
    const train = order(labelled.filter((p) => !testIds.has(p.patient_id)));
    const test = order(labelled.filter((p) => testIds.has(p.patient_id)));
    const pos = {};
    const allCols = 25;
    const allW = (allCols - 1) * GAP;
    grid(all.length, allCols, (W - allW) / 2, 60).forEach((xy, i) => (pos[all[i].patient_id] = { all: xy }));
    const trainCols = 20;
    grid(train.length, trainCols, 40, 60).forEach((xy, i) => (pos[train[i].patient_id].split = xy));
    grid(test.length, 10, 40 + trainCols * GAP + 140, 60).forEach((xy, i) => (pos[test[i].patient_id].split = xy));
    // Illustrative folds: alternate through each class so every band has the same mix
    const bandW = 8 * GAP + 44;
    const bands = [[], [], [], [], []];
    order(labelled).forEach((p, i) => bands[i % 5].push(p));
    bands.forEach((band, b) => {
      const cancer = band.filter((p) => p.diagnosis === 1);
      const clear = band.filter((p) => p.diagnosis === 0);
      [...cancer, ...clear].forEach((p, i) => {
        pos[p.patient_id].folds = { x: 40 + b * bandW + (i % 8) * GAP, y: 60 + Math.floor(i / 8) * GAP };
      });
    });
    const trainRows = Math.ceil(train.length / trainCols);
    const h = (rows) => 60 + rows * GAP + 16;
    return {
      hAll: h(Math.ceil(all.length / allCols)),
      hSplit: h(Math.ceil(train.length / trainCols)),
      hFolds: h(Math.ceil(bands[0].length / 8)),
      pos, all, train, test, bands, height: 60 + Math.max(Math.ceil(all.length / allCols), trainRows, Math.ceil(bands[0].length / 8)) * GAP + 30, testX: 40 + trainCols * GAP + 140, bandW };
  }, [labelled, testIds]);

  const runSplit = () => {
    complete('split');
    setView('split');
    if (reduce) {
      setPhase('split');
      return;
    }
    setPhase('shuffle');
    timer.current = window.setTimeout(() => setPhase('split'), 420);
  };

  const ratio = (list) => (list.length ? list.filter((p) => p.diagnosis === 1).length / list.length : 0);
  const showFolds = phase === 'split' && view === 'folds';
  // Stable pseudo-random position for the shuffle
  const jumble = (i) => ({ x: 60 + ((i * 7919) % 781), y: 60 + ((i * 104729) % (layout.height - 110)) });

  const target = (p, i) => {
    const pos = layout.pos[p.patient_id];
    if (phase === 'all') return pos.all;
    if (phase === 'shuffle') return jumble(i);
    return showFolds ? pos.folds : pos.split;
  };

  const foldAcc = cv.data?.models.find((m) => m.key === model)?.accuracy;

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <button type="button" className="btn btn-primary" onClick={runSplit}>
          {phase === 'all' ? 'Split the data' : 'Split again'}
        </button>
        {phase === 'split' && (
          <Segmented
            label="View"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'split', label: '80 / 20 split' },
              { value: 'folds', label: '5-fold cross-validation' },
            ]}
          />
        )}
        <Legend
          items={[
            { label: 'Cancer', swatch: <DxSwatch cancer /> },
            { label: 'No cancer', swatch: <DxSwatch /> },
          ]}
        />
      </div>

      <p className={styles.caption} aria-live="polite">
        {phase === 'all' && `${labelled.length} patients with a known diagnosis, one dot each.`}
        {phase === 'shuffle' && 'Shuffling…'}
        {phase === 'split' && !showFolds && (
          <>
            Each group keeps the same share of cancer patients. That is a{' '}
            <Term meaning="The split is done separately for cancer and no-cancer patients, so both groups get the same mix.">stratified</Term>{' '}
            split (seed 42).
          </>
        )}
        {showFolds && (
          <>
            Each band takes a turn as the test group while the other four train.{' '}
            <span className="muted">The band layout is illustrative; the scores are real.</span>
          </>
        )}
      </p>

      {showFolds && (
        <div className={styles.foldControls}>
          <Segmented
            label="Model"
            size="sm"
            value={model}
            onChange={setModel}
            options={MODELS.map((m) => ({ value: m.key, label: m.short }))}
          />
          {cv.loading && <span className="muted small">Running 5-fold cross-validation…</span>}
          {cv.error && <ErrorState error={cv.error} onRetry={cv.reload} />}
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${phase === 'all' ? layout.hAll : showFolds ? layout.hFolds : layout.hSplit}`} className={styles.svg} role="img" aria-label={svgLabel(phase, showFolds, nTrain, nTest)}>
        {phase === 'split' && !showFolds && (
          <>
            <text x={40} y={34} className={styles.groupTitle}>
              Train {nTrain}
              <tspan dx={10} className={styles.groupNote}>
                {pct(ratio(layout.train))} cancer
              </tspan>
            </text>
            <text x={layout.testX} y={34} className={styles.groupTitle}>
              Test {nTest}
              <tspan dx={10} className={styles.groupNote}>
                {pct(ratio(layout.test))} cancer
              </tspan>
            </text>
          </>
        )}
        {phase === 'all' && (
          <text x={W / 2} y={34} textAnchor="middle" className={styles.groupTitle}>
            All {labelled.length} patients, {pct(ratio(labelled))} cancer
          </text>
        )}
        {showFolds &&
          layout.bands.map((band, b) => (
            <g key={b}>
              <text x={40 + b * layout.bandW} y={34} className={styles.groupTitle}>
                Fold {b + 1}
                {foldAcc && (
                  <tspan dx={8} className={styles.groupNote}>
                    {pct(foldAcc.folds[b], 1)}
                  </tspan>
                )}
              </text>
            </g>
          ))}
        {layout.all.map((p, i) => {
          const t = target(p, i);
          return (
            <motion.circle
              key={p.patient_id}
              r={5}
              className={p.diagnosis === 1 ? styles.cancer : styles.clear}
              initial={false}
              animate={{ cx: t.x, cy: t.y }}
              transition={
                reduce
                  ? { duration: 0 }
                  : phase === 'shuffle'
                    ? { duration: 0.35, ease: 'easeInOut', delay: (i % 40) * 0.001 }
                    : { duration: 0.55, ease: [0.22, 0.8, 0.3, 1], delay: (i % 50) * 0.002 }
              }
            />
          );
        })}
      </svg>

      {showFolds && foldAcc && (
        <p className={styles.cvSummary}>
          {MODELS.find((m) => m.key === model).name}: mean accuracy {pct(foldAcc.mean, 1)}, spread ±{pct(foldAcc.std, 1)} across
          the five folds.
        </p>
      )}
    </div>
  );
}

function svgLabel(phase, folds, nTrain, nTest) {
  if (phase === 'all') return 'All patients as dots, coloured by diagnosis.';
  if (folds) return 'Patients regrouped into five folds.';
  return `Patients split into ${nTrain} for training and ${nTest} for testing.`;
}

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Segmented from '../components/Segmented';
import SplitFlap from '../components/SplitFlap';
import StationLayout from '../components/StationLayout';
import { TrainGlyph } from '../components/Icons';
import { cacheBenchmark, formatTime, readCachedBenchmark } from '../lib/benchmark';
import { lineByKey, STATIONS } from '../lib/metro';
import { useJourney } from '../state/Journey';
import styles from './Benchmark.module.css';

// Which line (data structure) each faster variant rides on
const VARIANT_LINE = {
  'AVL tree': 'avl',
  'Hash table': 'hash',
  'Brute force + heap': 'heap',
  'KD-tree': 'kd',
  'Merge sort + prefix sums': 'merge',
  'Binary heap': 'heap',
};

export default function Benchmark() {
  const { complete, isDone } = useJourney();
  const [n, setN] = useState(2000);
  const [state, setState] = useState({ data: readCachedBenchmark(2000), error: null, loading: !readCachedBenchmark(2000) });
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const cached = readCachedBenchmark(n);
    if (cached) {
      setState({ data: cached, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    setElapsed(0);
    const started = Date.now();
    const clock = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    api
      .benchmark(n, 1, { signal: controller.signal })
      .then((data) => {
        cacheBenchmark(n, data);
        setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false });
      })
      .finally(() => window.clearInterval(clock));
    return () => {
      controller.abort();
      window.clearInterval(clock);
    };
  }, [n, tick]);

  useEffect(() => {
    if (state.data) complete('benchmark');
  }, [state.data, complete]);

  return (
    <StationLayout
      id="benchmark"
      night
      sentence="The same job done the simple way and with our data structure. Steps counted, time measured."
      todo="Wait for the board to finish loading."
      resultNote
    >
      <div className={styles.head}>
        <Segmented
          label="Number of patients"
          value={String(n)}
          onChange={(v) => setN(Number(v))}
          options={[
            { value: '2000', label: '2,000 patients' },
            { value: '20000', label: '20,000 patients' },
          ]}
        />
        <p className={styles.meta}>Synthetic patients built in memory. Best of 3 runs on this server.</p>
      </div>

      {state.loading && (
        <div className={styles.loading} role="status">
          <p className={styles.loadingTitle}>Measuring on {n.toLocaleString('en-US')} patients…</p>
          <p className={styles.dim}>
            {n === 20000
              ? 'The naive decision-tree search alone takes several seconds. This usually needs about 20 seconds.'
              : 'This takes about a second.'}{' '}
            {elapsed > 0 && `${elapsed} s so far.`}
          </p>
        </div>
      )}
      {state.error && (
        <div className={styles.error} role="alert">
          <p>{state.error.message}</p>
          <button type="button" className="btn btn-night" onClick={() => setTick((t) => t + 1)}>
            Retry
          </button>
        </div>
      )}
      {state.data && <Board data={state.data} />}

      {state.data && isDone('benchmark') && <Arrival />}
    </StationLayout>
  );
}

function Board({ data }) {
  const [open, setOpen] = useState(null);
  let row = -1;
  return (
    <div className={styles.board}>
      <div className={styles.boardHead} aria-hidden="true">
        <span>Task</span>
        <span>Simple way</span>
        <span>Our structure</span>
        <span className={styles.right}>Faster</span>
      </div>
      {data.results.map((task) => {
        const simple = task.variants[0];
        return (
          <section key={task.task} className={styles.task} aria-label={task.task}>
            {task.variants.slice(1).map((v, j) => {
              row += 1;
              const line = lineByKey(VARIANT_LINE[v.name]);
              const factor = simple.micros / Math.max(v.micros, 0.01);
              const id = `${task.task}-${v.name}`;
              const delay = row * 0.15;
              return (
                <div
                  key={v.name}
                  className={`${styles.row} ${open === id ? styles.rowOpen : ''}`}
                  tabIndex={0}
                  onMouseEnter={() => setOpen(id)}
                  onMouseLeave={() => setOpen(null)}
                  onFocus={() => setOpen(id)}
                  onBlur={() => setOpen(null)}
                  aria-label={`${task.task}: ${simple.name} ${formatTime(simple.micros)}, ${v.name} ${formatTime(v.micros)}, ${Math.round(factor)} times faster. Steps: ${simple.steps.toLocaleString('en-US')} against ${v.steps.toLocaleString('en-US')}.`}
                >
                  <span className={styles.taskName}>{j === 0 ? task.task : ''}</span>
                  <span className={styles.cellSimple}>
                    {j === 0 && (
                      <>
                        <span className={styles.vname}>{simple.name}</span>
                        <SplitFlap text={formatTime(simple.micros)} delay={delay} />
                      </>
                    )}
                  </span>
                  <span className={styles.cellOurs}>
                    <span className={styles.vname}>
                      <span className={styles.swatch} style={{ background: line?.night }} aria-hidden="true" />
                      {v.name}
                    </span>
                    <SplitFlap text={formatTime(v.micros)} delay={delay + 0.05} />
                  </span>
                  <span className={`${styles.factor} ${styles.right}`}>
                    <SplitFlap text={`${factor >= 10 ? Math.round(factor) : factor.toFixed(1)}×`} delay={delay + 0.1} />
                    <span className={styles.fasterWord}>faster</span>
                  </span>
                  <span className={styles.steps} aria-hidden={open !== id}>
                    Steps: {simple.steps.toLocaleString('en-US')} the simple way, {v.steps.toLocaleString('en-US')} with the{' '}
                    {v.name.toLowerCase()} ({task.steps}).
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
      <p className={styles.dim}>
        Every variant gave the same answer: {data.results.every((r) => r.sameAnswer) ? 'yes' : 'no'}. Point at a row to see the
        steps each way counted. Times are the best of {data.runs} runs.
      </p>
    </div>
  );
}

function Arrival() {
  const reduce = useReducedMotion();
  const W = 520;
  const gap = (W - 60) / (STATIONS.length - 1);
  return (
    <div className={styles.arrival}>
      <svg viewBox={`0 0 ${W} 60`} className={styles.arrivalSvg} aria-hidden="true">
        <line x1={20} x2={W - 20} y1={34} y2={34} className={styles.arrivalLine} />
        {STATIONS.map((s, i) => (
          <circle key={s.id} cx={30 + i * gap} cy={34} r={7} className={styles.arrivalStop} />
        ))}
        <motion.g
          initial={reduce ? false : { x: 30 + 5 * gap - 52, y: 25 }}
          animate={{ x: 30 + 7 * gap - 52, y: 25 }}
          transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 0.8, 0.3, 1] }}
          className={styles.arrivalTrain}
        >
          <TrainGlyph />
        </motion.g>
      </svg>
      <div>
        <p className={styles.arrivalTitle} role="status">
          Journey complete
        </p>
        <p className={styles.dim}>
          You rode the whole pipeline: data, features, scaling, a fair split, four models, predictions, a fair test, and the data
          structures that make it fast.
        </p>
        <Link to="/map" className="btn btn-night">
          Back to the map
        </Link>
      </div>
    </div>
  );
}

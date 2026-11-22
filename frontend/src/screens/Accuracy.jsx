import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS } from '../lib/models';
import { computeMetrics } from '../lib/metrics';
import { pct } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Help from '../components/Help';
import { CountUp } from '../components/Risk';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import styles from './Accuracy.module.css';

const METRICS = [
  {
    key: 'accuracy',
    name: 'Accuracy',
    meaning: 'How often the model was right overall.',
    help: 'Correct guesses ÷ all guesses. 75% means 3 out of 4 test genes were guessed right.',
  },
  {
    key: 'precision',
    name: 'Precision',
    meaning: 'When the model said cancer, how often it really was cancer.',
    help: 'High precision means few false alarms. If precision is 80%, then 8 out of 10 "cancer" answers were correct.',
  },
  {
    key: 'recall',
    name: 'Recall',
    meaning: 'Out of all real cancer cases, how many the model caught.',
    help: 'High recall means few missed cancers. If recall is 60%, the model found 6 out of every 10 real cancer genes.',
  },
  {
    key: 'f1',
    name: 'F1 score',
    meaning: 'One score that balances precision and recall.',
    help: 'F1 is high only when both precision and recall are high. It is useful when you care about false alarms and missed cancers at the same time.',
  },
];

const pctNum = (v) => Math.round(v * 1000) / 10;

function RankedChart({ rows }) {
  const reduceMotion = useReducedMotion();
  const ranked = [...rows].sort((a, b) => b.metrics.accuracy - a.metrics.accuracy);
  const best = ranked[0];
  return (
    <section className={styles.chartCard} aria-labelledby="ranked-title">
      <h2 id="ranked-title" className={styles.chartTitle}>
        How often each model was right
      </h2>
      <p className={styles.best}>
        Best: <strong>{best.model.name}</strong> {pct(best.metrics.accuracy)}
      </p>
      <ol className={styles.ranked}>
        {ranked.map((r, i) => (
          <motion.li
            key={r.model.key}
            layout={!reduceMotion}
            transition={{ duration: 0.3 }}
            className={`${styles.rankRow} ${i === 0 ? styles.bestRow : ''}`}
          >
            <span className={styles.rankName}>
              <span className={styles.dot} style={{ background: r.model.color }} aria-hidden="true" />
              {r.model.name}
            </span>
            <span className={styles.rankTrack}>
              <motion.span
                className={styles.rankBar}
                style={{ background: r.model.color }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${r.metrics.accuracy * 100}%` }}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18, delay: i * 0.08 }}
              />
            </span>
            <span className={styles.rankValue}>
              <CountUp value={pctNum(r.metrics.accuracy)} decimals={1} duration={0.5} />
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function ResultTable({ m }) {
  const cells = [
    { label: 'Found cancer correctly', value: m.tp, good: true },
    { label: 'Missed cancer', value: m.fn, good: false },
    { label: 'False alarm', value: m.fp, good: false },
    { label: 'Correctly said no cancer', value: m.tn, good: true },
  ];
  return (
    <div className={styles.matrix}>
      <span className={styles.matrixCorner} aria-hidden="true" />
      <span className={styles.matrixHead}>Model said cancer</span>
      <span className={styles.matrixHead}>Model said no cancer</span>
      <span className={styles.matrixSide}>Really cancer</span>
      {[cells[0], cells[1]].map((c) => (
        <span key={c.label} className={`${styles.cell} ${c.good ? styles.good : styles.bad}`}>
          <strong className="num">{c.value}</strong>
          {c.label}
        </span>
      ))}
      <span className={styles.matrixSide}>Really not cancer</span>
      {[cells[2], cells[3]].map((c) => (
        <span key={c.label} className={`${styles.cell} ${c.good ? styles.good : styles.bad}`}>
          <strong className="num">{c.value}</strong>
          {c.label}
        </span>
      ))}
    </div>
  );
}

export default function Accuracy() {
  const { state, log } = useAppState();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [line, setLine] = useState(0.5);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    if (state.server !== 'online' || !state.status.modelsTrained) return undefined;
    let cancelled = false;
    api
      .evaluate()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        const best = [...d.models].sort((a, b) => b.accuracy - a.accuracy)[0];
        log(`Viewed model accuracy: ${d.testSamples} hidden test genes. Best was ${best.name} at ${pct(best.accuracy)}.`);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [state.server, state.status.modelsTrained, state.status.geneticCount, log]);

  const rows = useMemo(() => {
    if (!data) return [];
    return MODELS.map((model) => {
      const entry = data.models.find((x) => x.key === model.key);
      return { model, metrics: computeMetrics(entry.samples, line) };
    });
  }, [data, line]);

  return (
    <div>
      <PageHeader
        title="Model accuracy"
        purpose="We hid 20% of the genes from the models during training, then asked them to guess those genes. This shows how often each model was right."
      />

      {state.server === 'online' && !state.status.modelsTrained && (
        <EmptyState title="Nothing to measure yet" action={<Link className="btn btn-primary" to="/start" state={{ autoLoad: true }}>Load data</Link>}>
          Load the data so the models can be trained and tested.
        </EmptyState>
      )}
      {error && (
        <ErrorState
          title="Could not test the models"
          message={error.offline ? 'The server is not running. Start cds_server and press Retry.' : error.message}
          command={error.offline ? START_COMMAND : undefined}
        />
      )}
      {!data && !error && state.status.modelsTrained && <LoadingState lines={5}>Testing the four models…</LoadingState>}

      {data && (
        <>
          <section className={styles.slider} aria-labelledby="line-title">
            <h2 id="line-title" className={styles.sliderTitle}>
              Cancer line: <span className="num">{Math.round(line * 100)}%</span>
              <Help term="Cancer line">
                Each model gives a chance from 0% to 100%. Above the line, the model says cancer.
                Normally the line is at 50%. Move it to see what changes.
              </Help>
            </h2>
            <p>Move the line to see the trade-off.</p>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={line}
              onChange={(e) => setLine(Number(e.target.value))}
              aria-labelledby="line-title"
              aria-valuetext={`${Math.round(line * 100)}%`}
              className={styles.range}
            />
            <div className={styles.rangeScale} aria-hidden="true">
              <span>10%</span>
              <span>50%</span>
              <span>90%</span>
            </div>
            <p className="hint">Lower line → catches more cancer cases, but more false alarms.</p>
          </section>

          <p className={styles.tested}>
            Tested on {data.testSamples} hidden genes.
            <button type="button" className="btn btn-quiet" aria-pressed={asTable} onClick={() => setAsTable((t) => !t)}>
              {asTable ? 'Show as charts' : 'Show as table'}
            </button>
          </p>

          {asTable ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">Model results with the cancer line at {Math.round(line * 100)}%</caption>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    {METRICS.map((m) => <th key={m.key} scope="col">{m.name}</th>)}
                    <th scope="col">Found cancer correctly</th>
                    <th scope="col">Missed cancer</th>
                    <th scope="col">False alarm</th>
                    <th scope="col">Correctly said no cancer</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ model, metrics }) => (
                    <tr key={model.key}>
                      <th scope="row">{model.name}</th>
                      {METRICS.map((m) => <td key={m.key}>{pct(metrics[m.key])}</td>)}
                      <td>{metrics.tp}</td>
                      <td>{metrics.fn}</td>
                      <td>{metrics.fp}</td>
                      <td>{metrics.tn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <RankedChart rows={rows} />
              <ul className={styles.models}>
                {rows.map(({ model, metrics }) => (
                  <li key={model.key} className={styles.model}>
                    <h3 className={styles.modelName}>
                      <span className={styles.dot} style={{ background: model.color }} aria-hidden="true" />
                      {model.name}
                    </h3>
                    <dl className={styles.metrics}>
                      {METRICS.map((m) => (
                        <div key={m.key} className={styles.metric}>
                          <dt>
                            {m.name}
                            <Help term={m.name}>{m.help}</Help>
                          </dt>
                          <dd className={styles.metricValue}>
                            <CountUp value={pctNum(metrics[m.key])} decimals={1} duration={0.4} />
                          </dd>
                          <dd className={styles.meaning}>{m.meaning}</dd>
                        </div>
                      ))}
                    </dl>
                    <ResultTable m={metrics} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

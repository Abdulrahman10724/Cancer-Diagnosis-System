import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS } from '../lib/models';
import { computeMetrics } from '../lib/metrics';
import { pct } from '../lib/format';
import Plate from '../components/Plate';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Proficiency.module.css';

export default function Proficiency() {
  const { state, log } = useAppState();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(0.5);
  const [view, setView] = useState('plates');

  useEffect(() => {
    if (state.server !== 'online') return undefined;
    let cancelled = false;
    api
      .evaluate()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        const best = [...d.models].sort((a, b) => b.accuracy - a.accuracy)[0];
        log(`Proficiency viewed: ${d.testSamples} held-out genes. Best accuracy ${best.name} ${pct(best.accuracy)}.`);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [state.server, state.status.geneticCount, log]);

  const rows = useMemo(() => {
    if (!data) return [];
    return MODELS.map((m) => {
      const entry = data.models.find((x) => x.key === m.key);
      return { model: m, samples: entry.samples, metrics: computeMetrics(entry.samples, threshold) };
    });
  }, [data, threshold]);

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Proficiency</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Proficiency</h1>
        <p className={screen.lede}>
          Each model is tested on genes it never saw in training: 20% of the data is held back,
          and the copies of the models tested here train on the other 80%.
        </p>
      </div>

      {error && error.status === 400 && (
        <EmptyState
          title="Models are not trained yet"
          action={
            <Link className="btn btn-primary" to="/setup">
              Go to Setup
            </Link>
          }
        >
          Load the data on Setup to test the models.
        </EmptyState>
      )}
      {error && error.status !== 400 && (
        <ErrorState title="Evaluation not available" message={error.message} command={error.offline ? START_COMMAND : undefined} />
      )}
      {!data && !error && <LoadingState>Testing the four models…</LoadingState>}

      {data && (
        <>
          <section className={styles.controls} aria-label="Threshold">
            <div className={styles.dial}>
              <label htmlFor="threshold">
                Threshold <output htmlFor="threshold" className="num">{threshold.toFixed(2)}</output>
              </label>
              <input
                id="threshold"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <p className="hint">
                Lower threshold → catches more cancers (recall ↑) but more false alarms
                (precision ↓).
              </p>
            </div>
            <div className={styles.toggle} role="group" aria-label="View">
              <button type="button" className="btn" aria-pressed={view === 'plates'} onClick={() => setView('plates')}>
                Plates
              </button>
              <button type="button" className="btn" aria-pressed={view === 'table'} onClick={() => setView('table')}>
                Table
              </button>
            </div>
          </section>

          <p className={styles.tested}>Tested on {data.testSamples} samples.</p>

          {view === 'plates' ? (
            <div className={styles.grid}>
              {rows.map(({ model, samples, metrics }) => (
                <section key={model.key} className={styles.card} aria-label={model.name}>
                  <Plate model={model} samples={samples} threshold={threshold} />
                  <dl className={styles.metrics}>
                    <div><dt>Accuracy</dt><dd className="num">{pct(metrics.accuracy)}</dd></div>
                    <div><dt>Precision</dt><dd className="num">{pct(metrics.precision)}</dd></div>
                    <div><dt>Recall</dt><dd className="num">{pct(metrics.recall)}</dd></div>
                    <div><dt>F1</dt><dd className="num">{pct(metrics.f1)}</dd></div>
                  </dl>
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">Model metrics at threshold {threshold.toFixed(2)}</caption>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Accuracy</th>
                    <th scope="col">Precision</th>
                    <th scope="col">Recall</th>
                    <th scope="col">F1</th>
                    <th scope="col">True positive</th>
                    <th scope="col">False positive</th>
                    <th scope="col">True negative</th>
                    <th scope="col">False negative</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ model, metrics }) => (
                    <tr key={model.key}>
                      <th scope="row">{model.name}</th>
                      <td>{pct(metrics.accuracy)}</td>
                      <td>{pct(metrics.precision)}</td>
                      <td>{pct(metrics.recall)}</td>
                      <td>{pct(metrics.f1)}</td>
                      <td>{metrics.tp}</td>
                      <td>{metrics.fp}</td>
                      <td>{metrics.tn}</td>
                      <td>{metrics.fn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint">
            Filled well = correct prediction. Empty ring = wrong prediction. Dotted wells are
            unused.
          </p>
        </>
      )}
    </div>
  );
}

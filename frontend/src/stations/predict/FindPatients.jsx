import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { ErrorState } from '../../components/States';
import { pct } from '../../lib/format';
import useApi from '../../lib/useApi';
import styles from './Predict.module.css';

const STEP_MS = 120;

export default function FindPatients({ patientId }) {
  return (
    <div className={styles.find}>
      <IdSearch initial={patientId || 'P250'} />
      <RangeSearch />
    </div>
  );
}

function IdSearch({ initial }) {
  const reduce = useReducedMotion();
  const [id, setId] = useState(initial);
  const [walk, setWalk] = useState(null); // { list, avl, found }
  const [shown, setShown] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const run = async (e) => {
    e.preventDefault();
    window.clearInterval(timer.current);
    setBusy(true);
    setError(null);
    try {
      const [list, avl] = await Promise.all([api.searchList(id.trim()), api.searchIndex(id.trim())]);
      const w = { list: list.order, avl: avl.path, found: list.found, steps: avl.steps, height: avl.height, size: avl.size, id: id.trim() };
      setWalk(w);
      const total = Math.max(w.list.length, w.avl.length);
      if (reduce) {
        setShown(total);
      } else {
        setShown(0);
        timer.current = window.setInterval(() => {
          setShown((s) => {
            if (s + 1 >= total) window.clearInterval(timer.current);
            return s + 1;
          });
        }, STEP_MS);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    window.clearInterval(timer.current);
    setShown(Math.max(walk.list.length, walk.avl.length));
  };

  const listShown = walk ? Math.min(shown, walk.list.length) : 0;
  const avlShown = walk ? Math.min(shown, walk.avl.length) : 0;
  const finished = walk && shown >= Math.max(walk.list.length, walk.avl.length);

  return (
    <section className={styles.findBlock} aria-labelledby="find-id">
      <h3 id="find-id" className={styles.blockTitle}>
        Find a patient by ID
      </h3>
      <form className={styles.inline} onSubmit={run}>
        <label htmlFor="find-id-input" className="vh">
          Patient ID
        </label>
        <input id="find-id-input" className="input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={!id.trim() || busy}>
          Find in both
        </button>
        {walk && !finished && (
          <button type="button" className="btn btn-quiet" onClick={skip}>
            Skip to the end
          </button>
        )}
      </form>
      {error && <ErrorState error={error} />}
      {walk && (
        <>
          <div className={styles.walks}>
            <div className={styles.walk}>
              <p className={styles.walkTitle}>
                <span className={styles.laneSwatch} style={{ background: 'var(--rail)' }} aria-hidden="true" />
                Linked list: one patient after another
              </p>
              <div className={styles.ticks} aria-hidden="true">
                {walk.list.slice(0, listShown).map((pid, i) => (
                  <span key={pid} className={`${styles.tick} ${i === walk.list.length - 1 && walk.found ? styles.tickHit : ''}`} title={pid} />
                ))}
              </div>
              <p className={styles.walkCount}>
                <strong>{listShown}</strong> {listShown === 1 ? 'step' : 'steps'}
                {listShown > 0 && <span className="muted"> at {walk.list[listShown - 1]}</span>}
              </p>
            </div>
            <div className={styles.walk}>
              <p className={styles.walkTitle}>
                <span className={styles.laneSwatch} style={{ background: 'var(--line-avl)' }} aria-hidden="true" />
                AVL tree: left or right at each node
              </p>
              <ol className={styles.avlPath} aria-hidden="true">
                {walk.avl.slice(0, avlShown).map((pid, i) => (
                  <li key={pid} className={i === walk.avl.length - 1 && walk.found ? styles.pathHit : styles.pathStep}>
                    {pid}
                  </li>
                ))}
              </ol>
              <p className={styles.walkCount}>
                <strong>{avlShown}</strong> {avlShown === 1 ? 'step' : 'steps'}
                <span className="muted"> (tree height {walk.height} for {walk.size} patients)</span>
              </p>
            </div>
          </div>
          {finished && (
            <p className={styles.compare} role="status">
              {walk.found
                ? `${walk.list.length} steps vs ${walk.avl.length} steps to find ${walk.id}.`
                : `${walk.id} is not here: the list checked all ${walk.list.length} patients, the AVL tree knew after ${walk.avl.length} steps.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function RangeSearch() {
  const [range, setRange] = useState({ min: 0.4, max: 0.6 });
  const [query, setQuery] = useState(range);
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(range), 250);
    return () => window.clearTimeout(t);
  }, [range]);
  const res = useApi(() => api.riskRange(query.min, query.max), [query.min, query.max]);
  const setMin = (v) => setRange((r) => ({ min: Math.min(v, r.max), max: r.max }));
  const setMax = (v) => setRange((r) => ({ min: r.min, max: Math.max(v, r.min) }));
  return (
    <section className={styles.findBlock} aria-labelledby="find-range">
      <h3 id="find-range" className={styles.blockTitle}>
        Patients in a risk range
      </h3>
      <p className="small muted">
        A second AVL tree is sorted by risk, so it can list every patient between two values without checking the rest.
      </p>
      <div className={styles.rangeRow}>
        <label className={styles.rangeLabel}>
          <span className="label">From {pct(range.min)}</span>
          <input type="range" min={0} max={1} step={0.01} value={range.min} onChange={(e) => setMin(Number(e.target.value))} />
        </label>
        <label className={styles.rangeLabel}>
          <span className="label">To {pct(range.max)}</span>
          <input type="range" min={0} max={1} step={0.01} value={range.max} onChange={(e) => setMax(Number(e.target.value))} />
        </label>
      </div>
      {res.error && <ErrorState error={res.error} onRetry={res.reload} />}
      {res.data && (
        <>
          <p aria-live="polite">
            <strong>{res.data.count}</strong> {res.data.count === 1 ? 'patient' : 'patients'} with a risk from {pct(res.data.min)} to{' '}
            {pct(res.data.max)}. The tree visited {res.data.visited} nodes.
          </p>
          <ul className={styles.rangeList}>
            {res.data.patients.slice(0, 60).map((p) => (
              <li key={p.patient_id}>
                <strong>{p.patient_id}</strong> {p.name} <span className="muted">{pct(p.risk, 1)}</span>
              </li>
            ))}
          </ul>
          {res.data.count > 60 && <p className="muted small">Showing the lowest 60.</p>}
        </>
      )}
    </section>
  );
}

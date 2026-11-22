import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS, modelByKey } from '../lib/models';
import { pct0 } from '../lib/format';
import PageHeader from '../components/PageHeader';
import PatientPicker from '../components/PatientPicker';
import Help from '../components/Help';
import { RiskBadge } from '../components/Risk';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import styles from './WaitingList.module.css';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let tokenCounter = 0;

function PatientCard({ id, name, tag, result }) {
  return (
    <div className={styles.card}>
      {tag && <span className={styles.tag}>{tag}</span>}
      <strong className={styles.cardName}>{name || id}</strong>
      <span className={styles.cardId}>{id}</span>
      {result && (
        <RiskBadge
          level={result.prediction === 1 ? 'high' : 'low'}
          label={`${result.prediction === 1 ? 'Cancer' : 'No cancer'} ${pct0(result.riskScore)}`}
        />
      )}
    </div>
  );
}

export default function WaitingList() {
  const { state, log, toast } = useAppState();
  const reduceMotion = useReducedMotion();
  const [queue, setQueue] = useState(null); // [{ token, id }], first = next
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState('');
  const [model, setModel] = useState('logistic');
  const [checking, setChecking] = useState(null);
  const [done, setDone] = useState([]);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id) => (state.patients.find((p) => p.patient_id === id) || {}).name;

  const load = useCallback(async () => {
    try {
      const q = await api.queue();
      setQueue(q.patients.map((id) => ({ token: `t${++tokenCounter}`, id })));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    if (state.server === 'online') load();
  }, [state.server, load]);

  const add = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await api.enqueue(selected);
      setQueue((q) => [...(q || []), { token: `t${++tokenCounter}`, id: selected }]);
      toast(`${nameOf(selected) || selected} added to the waiting list`);
      log(`${nameOf(selected) || selected} added to the waiting list (position ${res.queueSize}).`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const checkAll = async () => {
    if (!queue || queue.length === 0) return;
    setBusy(true);
    setDone([]);
    try {
      const res = await api.processQueue(model);
      const total = res.results.length;
      const step = reduceMotion ? 0 : 450;
      let remaining = [...queue];
      // The server checks in first-in, first-out order; replay its answers card by card
      for (let i = 0; i < total; i++) {
        const r = res.results[i];
        const card = remaining[0];
        remaining = remaining.slice(1);
        setProgress(`Checking ${i + 1} of ${total}…`);
        setQueue(remaining);
        setChecking({ ...card, result: null });
        await wait(step);
        setChecking({ ...card, result: r });
        await wait(step);
        setChecking(null);
        setDone((d) => [...d, { ...card, result: r }]);
        await wait(reduceMotion ? 0 : 150);
      }
      const cancer = res.results.filter((r) => r.prediction === 1).length;
      const text = `Checked ${total} ${total === 1 ? 'patient' : 'patients'} from the waiting list with ${modelByKey(model).name}: ${cancer} ${cancer === 1 ? 'says' : 'say'} cancer.`;
      setProgress(`Done. ${text}`);
      log(text);
      toast('Waiting list checked');
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Waiting list"
        purpose="Patients are checked in the order they were added — first in, first out (a queue)."
      >
        <p className="hint">
          A queue is a data structure where new items join at the end and are taken from the front.
          <Help term="Queue">
            Like people waiting at a counter: whoever came first is served first. The program uses
            it to check many patients in a fair order.
          </Help>
        </p>
      </PageHeader>

      <form className={styles.controls} onSubmit={add}>
        <PatientPicker patients={state.patients} value={selected} onChange={setSelected} />
        <button type="submit" className="btn" disabled={!selected || busy}>
          Add to waiting list
        </button>
      </form>

      {error && (
        <ErrorState
          title="Waiting list not available"
          message={error.offline ? 'The server is not running. Start cds_server and press Retry.' : error.message}
          command={error.offline ? START_COMMAND : undefined}
          action={<button type="button" className="btn" onClick={load}>Retry</button>}
        />
      )}
      {queue === null && !error && <LoadingState>Loading the waiting list…</LoadingState>}

      {queue !== null && (
        <LayoutGroup>
          <section className={styles.board} aria-labelledby="queue-title">
            <h2 id="queue-title" className={styles.boardTitle}>
              Waiting ({queue.length})
            </h2>
            {queue.length === 0 && !checking ? (
              <EmptyState title="Nobody is waiting" action={<Link className="btn" to="/add-patient">Add patient</Link>}>
                Add a patient above, or from Add patient after saving.
              </EmptyState>
            ) : (
              <ol className={styles.queue} aria-label="Waiting list, next first">
                {queue.map((c, i) => (
                  <motion.li
                    key={c.token}
                    layoutId={c.token}
                    initial={reduceMotion ? false : { opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.3 }}
                  >
                    <PatientCard id={c.id} name={nameOf(c.id)} tag={i === 0 ? 'Next' : i === queue.length - 1 ? 'Last' : null} />
                  </motion.li>
                ))}
              </ol>
            )}
          </section>

          <div className={styles.run}>
            <div className="field">
              <label htmlFor="wl-model">Model to use</label>
              <select id="wl-model" className="select" value={model} onChange={(e) => setModel(e.target.value)}>
                {MODELS.map((m) => (
                  <option key={m.key} value={m.key}>{m.name}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary btn-large" onClick={checkAll} disabled={busy || queue.length === 0}>
              Check everyone in the list
            </button>
          </div>
          <p className={styles.progress} role="status" aria-live="polite">{progress}</p>

          <div className={styles.lower}>
            <section className={styles.checking} aria-labelledby="checking-title">
              <h2 id="checking-title" className={styles.boardTitle}>Checking…</h2>
              <div className={styles.checkingSpot}>
                {checking ? (
                  <motion.div layoutId={checking.token} transition={{ duration: reduceMotion ? 0 : 0.35 }}>
                    <PatientCard id={checking.id} name={nameOf(checking.id)} result={checking.result} />
                  </motion.div>
                ) : (
                  <span className="hint">Empty</span>
                )}
              </div>
            </section>
            <section className={styles.doneArea} aria-labelledby="done-title">
              <h2 id="done-title" className={styles.boardTitle}>Done ({done.length})</h2>
              {done.length === 0 ? (
                <p className="hint">Checked patients appear here.</p>
              ) : (
                <ol className={styles.doneList}>
                  {done.map((c) => (
                    <motion.li key={c.token} layoutId={c.token} transition={{ duration: reduceMotion ? 0 : 0.35 }}>
                      <PatientCard id={c.id} name={nameOf(c.id)} result={c.result} />
                      <Link to={`/report/${encodeURIComponent(c.id)}`} className={styles.reportLink}>
                        Patient report
                      </Link>
                    </motion.li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}

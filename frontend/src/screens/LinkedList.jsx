import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import PageHeader from '../components/PageHeader';
import Help from '../components/Help';
import { EmptyState, ErrorState } from '../components/States';
import styles from './LinkedList.module.css';

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <span className={styles.arrowLabel}>next</span>
      <svg width="36" height="12" viewBox="0 0 36 12">
        <path d="M0 6h31M26 1.5l5 4.5-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

export default function LinkedList() {
  const { state, log } = useAppState();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const patients = state.patients; // linked-list order, head first
  const nameOf = (id) => (patients.find((p) => p.patient_id === id) || {}).name || id;

  const search = async (e) => {
    e.preventDefault();
    const id = query.trim();
    if (!id) return;
    clearInterval(timer.current);
    setError(null);
    try {
      const res = await api.searchPatient(id);
      setTrace({ id, ...res });
      const total = res.order.length;
      log(
        res.found
          ? `Searched the patient list for ${id}: found after checking ${total} ${total === 1 ? 'patient' : 'patients'}.`
          : `Searched the patient list for ${id}: checked all ${total} patients, not found.`,
      );
      if (reduceMotion || total === 0) {
        setStep(total);
        return;
      }
      setStep(1);
      let s = 1;
      timer.current = setInterval(() => {
        s += 1;
        setStep(s);
        if (s >= total) clearInterval(timer.current);
      }, 350);
    } catch (err) {
      setError(err);
    }
  };

  const visited = trace ? trace.order.slice(0, step) : [];
  const finished = trace && step >= trace.order.length;
  const current = visited[visited.length - 1];

  return (
    <div>
      <PageHeader
        title="Patient list (linked list)"
        purpose="Patients are stored in a linked list: each patient points to the next one. To find someone, the program must start at the first patient and walk one by one."
      />

      <form className={styles.search} onSubmit={search}>
        <div className="field">
          <label htmlFor="ll-id">Find a patient by ID</label>
          <input id="ll-id" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="P007" autoComplete="off" />
        </div>
        <button type="submit" className="btn btn-primary btn-large" disabled={!query.trim() || patients.length === 0}>
          Search the list
        </button>
      </form>

      <div className={styles.status} role="status" aria-live="polite">
        {trace && !finished && <span>Checked {visited.length} {visited.length === 1 ? 'patient' : 'patients'}…</span>}
        {trace && finished && trace.found && (
          <span className={styles.found}>
            Found {trace.id} ({nameOf(trace.id)}) after {trace.order.length} {trace.order.length === 1 ? 'step' : 'steps'}.
          </span>
        )}
        {trace && finished && !trace.found && (
          <span className={styles.notFound}>
            Checked all {trace.order.length} — {trace.id} was not found.
          </span>
        )}
      </div>
      {error && <ErrorState title="Search did not run" message={error.offline ? 'The server is not running. Start cds_server and press Retry.' : error.message} />}

      {patients.length === 0 ? (
        <EmptyState title="The list is empty" action={<Link className="btn btn-primary" to="/start" state={{ autoLoad: true }}>Load data</Link>}>
          Load the data or add a patient first.
        </EmptyState>
      ) : (
        <ol className={styles.chain} aria-label={`Linked list of ${patients.length} patients, starting from the head`}>
          {patients.map((p, i) => {
            const isVisited = visited.includes(p.patient_id);
            const isCurrent = current === p.patient_id;
            const isFound = finished && trace.found && isCurrent;
            const isMiss = finished && !trace.found && isVisited;
            return (
              <li key={p.patient_id} className={styles.link}>
                {i > 0 && <Arrow />}
                <div
                  className={[
                    styles.node,
                    isVisited ? styles.visited : '',
                    isCurrent && !finished ? styles.current : '',
                    isFound ? styles.nodeFound : '',
                    isMiss ? styles.nodeMiss : '',
                  ].join(' ')}
                >
                  {i === 0 && <span className={styles.head}>Start (head)</span>}
                  <span className={styles.nodeId}>{p.patient_id}</span>
                  <span className={styles.nodeName}>{p.name}</span>
                  {isFound && <span className={styles.tag}>Found</span>}
                </div>
                {i === patients.length - 1 && (
                  <>
                    <Arrow />
                    <span className={styles.end}>End (null)</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className={styles.note}>
        This is why searching a linked list takes longer as the list grows (O(n)).
        <Help term="O(n)">
          &quot;O(n)&quot; means the work grows with the number of items, n. With 10 patients the
          program may check up to 10; with 1,000 patients, up to 1,000. Compare it with the gene
          lookup, which jumps straight to the right box.
        </Help>
      </p>
    </div>
  );
}

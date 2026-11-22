import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { EmptyState, ErrorState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Custody.module.css';

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <span className={styles.arrowLabel}>next</span>
      <svg width="40" height="10" viewBox="0 0 40 10">
        <path d="M0 5h36M31 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

export default function Custody() {
  const { state, log } = useAppState();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState(null); // { id, found, order }
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const patients = state.patients; // linked-list order, head first

  const search = async (event) => {
    event.preventDefault();
    const id = query.trim();
    if (!id) return;
    clearInterval(timer.current);
    setError(null);
    try {
      const result = await api.searchPatient(id);
      setTrace({ id, ...result });
      const total = result.order.length;
      log(
        result.found
          ? `Custody search for ${id}: found after visiting ${total} ${total === 1 ? 'node' : 'nodes'}.`
          : `Custody search for ${id}: not found after visiting all ${total} nodes.`,
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
      }, 220);
    } catch (e) {
      setError(e);
    }
  };

  const visited = trace ? trace.order.slice(0, step) : [];
  const done = trace && step >= trace.order.length;
  const current = visited[visited.length - 1];

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Custody</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Custody</h1>
        <p className={screen.lede}>
          The chain of custody is the patient history, stored as a linked list. Each node only
          knows the next one, so finding a patient means walking the chain from the head.
        </p>
      </div>

      <form className={styles.search} onSubmit={search}>
        <div className="field">
          <label htmlFor="custody-id">Patient ID</label>
          <input
            id="custody-id"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!query.trim()}>
          Search list
        </button>
      </form>

      <p className={styles.counter} aria-live="polite">
        {trace && !done && `${visited.length} ${visited.length === 1 ? 'node' : 'nodes'} visited…`}
        {trace && done && trace.found &&
          `${trace.order.length} ${trace.order.length === 1 ? 'node' : 'nodes'} visited — linear search, O(n). Found ${trace.id}.`}
        {trace && done && !trace.found &&
          `Visited all ${trace.order.length} nodes. ${trace.id} is not in the list.`}
      </p>
      {error && <ErrorState title="Search not run" message={error.message} />}

      {patients.length === 0 ? (
        <EmptyState
          title="The chain is empty"
          action={
            <Link className="btn" to="/setup">
              Go to Setup
            </Link>
          }
        >
          Load the data on Setup or add a patient from Accession.
        </EmptyState>
      ) : (
        <ol className={styles.chain} aria-label={`Linked list of ${patients.length} patients, head first`}>
          {patients.map((p, i) => {
            const isVisited = visited.includes(p.patient_id);
            const isCurrent = current === p.patient_id;
            const isFound = done && trace.found && isCurrent;
            return (
              <li key={p.patient_id} className={styles.link}>
                {i > 0 && <Arrow />}
                <div
                  className={`${styles.node} ${isVisited ? styles.visited : ''} ${isCurrent ? styles.current : ''} ${isFound ? styles.found : ''}`}
                >
                  {i === 0 && <span className={styles.head}>head</span>}
                  <span className={styles.nodeId}>{p.patient_id}</span>
                  <span className={styles.nodeName}>{p.name}</span>
                  {isFound && <span className={styles.foundTag}>Found</span>}
                </div>
                {i === patients.length - 1 && (
                  <>
                    <Arrow />
                    <span className={styles.null}>null</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

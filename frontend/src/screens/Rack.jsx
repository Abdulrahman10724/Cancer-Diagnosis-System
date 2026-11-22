import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS, modelByKey } from '../lib/models';
import { pct } from '../lib/format';
import Tube from '../components/Tube';
import { OutcomeTag } from '../components/Lane';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Rack.module.css';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Rack() {
  const { state, log } = useAppState();
  const reduceMotion = useReducedMotion();
  const [rack, setRack] = useState(null); // [{ token, id }] front first
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState('');
  const [model, setModel] = useState('logistic');
  const [analyzer, setAnalyzer] = useState(null);
  const [processed, setProcessed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadRack = useCallback(async () => {
    try {
      const q = await api.queue();
      setRack(q.patients.map((id, i) => ({ token: `${id}-${i}-${Date.now()}`, id })));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    if (state.server === 'online') loadRack();
  }, [state.server, loadRack]);

  const addToRack = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try {
      const result = await api.enqueue(selected);
      log(`${selected} added to the rack (position ${result.queueSize}).`);
      setMessage(`${selected} added to the rear of the rack.`);
      await loadRack();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const processRack = async () => {
    if (!rack || rack.length === 0) return;
    setBusy(true);
    setMessage(null);
    setProcessed([]);
    try {
      const result = await api.processQueue(model);
      const step = reduceMotion ? 0 : 250;
      // The server processes in FIFO order; replay its results tube by tube from the front
      let remaining = [...rack];
      for (const r of result.results) {
        const tube = remaining[0];
        remaining = remaining.slice(1);
        setRack(remaining);
        setAnalyzer(tube);
        await wait(step + (reduceMotion ? 0 : 150));
        setAnalyzer(null);
        setProcessed((prev) => [...prev, { ...tube, result: r }]);
        await wait(step);
      }
      const cancerous = result.results.filter((r) => r.prediction === 1).length;
      const text = `Rack processed with ${modelByKey(model).name}: ${result.processed} ${
        result.processed === 1 ? 'sample' : 'samples'
      }, ${cancerous} cancerous.`;
      log(text);
      setMessage(text);
      await loadRack();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Rack</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Rack</h1>
        <p className={screen.lede}>
          Samples wait here in arrival order. The analyzer always takes the tube at the front,
          first in, first out.
        </p>
      </div>

      <form className={styles.addForm} onSubmit={addToRack}>
        <div className="field">
          <label htmlFor="rack-patient">Patient</label>
          <select
            id="rack-patient"
            className="select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a patient</option>
            {state.patients.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.patient_id}, {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn" disabled={!selected || busy}>
          Add to rack
        </button>
      </form>

      {error && (
        <ErrorState
          title="Rack not available"
          message={error.message}
          command={error.offline ? START_COMMAND : undefined}
        />
      )}

      {rack === null && !error && <LoadingState>Reading the rack…</LoadingState>}

      {rack !== null && (
        <LayoutGroup>
          <section className={styles.bench} aria-labelledby="rack-heading">
            <h2 id="rack-heading" className="visually-hidden">
              Tube rack
            </h2>
            <div className={styles.analyzer} aria-live="polite">
              <span className={styles.analyzerLabel}>Analyzer</span>
              <div className={styles.analyzerSlot}>
                {analyzer && (
                  <motion.div layoutId={analyzer.token} transition={{ duration: reduceMotion ? 0 : 0.25 }}>
                    <Tube id={analyzer.id} highlight />
                  </motion.div>
                )}
              </div>
            </div>
            <div className={styles.rackWrap}>
              <div className={styles.markers} aria-hidden="true">
                <span>Front</span>
                <span>Rear</span>
              </div>
              {rack.length === 0 && !analyzer ? (
                <EmptyState
                  title="No samples on the rack yet"
                  action={
                    <Link className="btn" to="/accession">
                      Go to Accession
                    </Link>
                  }
                >
                  Add one above, or from Accession after saving a patient.
                </EmptyState>
              ) : (
                <ol className={styles.rack} aria-label={`${rack.length} tubes, front first`}>
                  {rack.map((tube, i) => (
                    <motion.li
                      key={tube.token}
                      layoutId={tube.token}
                      className={styles.slot}
                      transition={{ duration: reduceMotion ? 0 : 0.25 }}
                    >
                      <Tube id={tube.id} highlight={i === 0} />
                      <span className={styles.position}>{i === 0 ? 'Next' : `${i + 1}`}</span>
                    </motion.li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <div className={styles.process}>
            <div className="field">
              <label htmlFor="rack-model">Model</label>
              <select
                id="rack-model"
                className="select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={processRack}
              disabled={busy || rack.length === 0}
            >
              {busy ? 'Processing rack…' : 'Process rack'}
            </button>
          </div>
          {message && (
            <p className={screen.toast} role="status">
              {message}
            </p>
          )}

          {processed.length > 0 && (
            <section className={screen.section} aria-labelledby="done-heading">
              <h2 id="done-heading">Processed</h2>
              <ol className={styles.done}>
                {processed.map((tube) => (
                  <motion.li
                    key={tube.token}
                    layoutId={tube.token}
                    className={styles.doneItem}
                    transition={{ duration: reduceMotion ? 0 : 0.25 }}
                  >
                    <Tube id={tube.id} />
                    <div className={styles.stamp}>
                      <OutcomeTag prediction={tube.result.prediction} />
                      <span className="num">{pct(tube.result.riskScore)} risk</span>
                      <Link to={`/report/${encodeURIComponent(tube.id)}`}>Report</Link>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </section>
          )}
        </LayoutGroup>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api, getApiUrl, setApiUrl } from '../api/client';
import { useAppState } from '../state/AppState';
import PageHeader from '../components/PageHeader';
import { ErrorState, START_COMMAND } from '../components/States';
import styles from './Start.module.css';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function StageIcon({ state }) {
  if (state === 'done') {
    return (
      <span className={`${styles.icon} ${styles.iconDone}`} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className={`${styles.icon} ${styles.iconFailed}`} aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (state === 'active') return <span className={`${styles.icon} ${styles.iconActive}`} aria-hidden="true" />;
  return <span className={styles.icon} aria-hidden="true" />;
}

export default function Start() {
  const { state, refresh, log, toast, clearResults } = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [url, setUrl] = useState(getApiUrl());
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState(null); // [{ label, detail, state }]
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const autoLoaded = useRef(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const base = [
      { label: 'Reading genes file', detail: '', state: 'active' },
      { label: 'Reading patients file', detail: '', state: 'waiting' },
      { label: 'Training 4 models', detail: '', state: 'waiting' },
      { label: 'Ready', detail: '', state: 'waiting' },
    ];
    setStages(base);
    try {
      const data = await api.loadData();
      // The server does all stages in one request; show them one by one now that it answered
      const details = [
        `${data.geneticCount} genes`,
        `${data.patientCount} patients`,
        data.modelsTrained ? 'All 4 trained' : 'Not trained',
        '',
      ];
      const step = reduceMotion ? 0 : 280;
      for (let i = 0; i < base.length; i++) {
        if (i === 2 && !data.modelsTrained) {
          setStages((s) => s.map((x, j) => (j === 2 ? { ...x, detail: 'The genes file has no usable rows', state: 'failed' } : x)));
          throw new Error('The models could not be trained. Check that data/genes.csv has rows like GENE_001,0.85,1.');
        }
        setStages((s) =>
          s.map((x, j) => {
            if (j === i) return { ...x, detail: details[i], state: 'done' };
            if (j === i + 1) return { ...x, state: 'active' };
            return x;
          }),
        );
        await wait(step);
      }
      clearResults();
      await refresh();
      setResult(data);
      log(`Data loaded: ${data.geneticCount} genes and ${data.patientCount} patients. All 4 models trained.`);
      toast('Data loaded');
    } catch (e) {
      setStages((s) => (s ? s.map((x) => (x.state === 'active' ? { ...x, state: 'failed' } : x)) : s));
      setError(e);
      if (e.offline) refresh();
    } finally {
      setLoading(false);
    }
  };

  // "Load data" buttons elsewhere send people here with autoLoad
  useEffect(() => {
    if (location.state && location.state.autoLoad && !autoLoaded.current && state.server === 'online') {
      autoLoaded.current = true;
      navigate('.', { replace: true, state: null });
      loadData();
    }
    // loadData is stable enough for this one-off trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, state.server]);

  const saveUrl = async (event) => {
    event.preventDefault();
    setApiUrl(url.trim());
    await refresh();
    toast('Server address saved');
  };

  const { status } = state;

  return (
    <div>
      <PageHeader
        title="Start"
        purpose="Load the gene and patient files so the 4 AI models can learn from them."
      />

      {state.server === 'offline' && (
        <ErrorState
          title="The server is not running"
          message="Start cds_server, then press Retry. This page also checks again every few seconds."
          command={START_COMMAND}
          action={
            <button type="button" className="btn btn-primary" onClick={refresh}>
              Retry
            </button>
          }
        />
      )}

      {state.server !== 'offline' && (
        <section className={styles.loadCard} aria-labelledby="load-heading">
          <h2 id="load-heading">Load data</h2>
          <p className="hint">
            Reads data/genes.csv and data/patients.csv. The models learn from the genes: each
            gene has a mutation score (0 = normal, 1 = highly mutated) and a known answer
            (linked to cancer or not).
          </p>
          <div>
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={loadData}
              disabled={loading || state.server !== 'online'}
            >
              {loading ? 'Loading…' : status.modelsTrained ? 'Load data again' : 'Load data'}
            </button>
          </div>

          {stages && (
            <ol className={styles.stages} aria-live="polite">
              {stages.map((s) => (
                <li key={s.label} className={`${styles.stage} ${styles[s.state]}`}>
                  <StageIcon state={s.state} />
                  <span className={styles.stageLabel}>{s.label}</span>
                  {s.detail && <span className={styles.stageDetail}>{s.detail}</span>}
                  <span className="visually-hidden">
                    {s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : s.state === 'active' ? 'in progress' : 'waiting'}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                className={styles.success}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                role="status"
              >
                <p className={styles.successText}>
                  Loaded {result.geneticCount} genes and {result.patientCount} patients. All 4
                  models are trained.
                </p>
                <Link to="/add-patient" className="btn btn-primary">
                  Next: Add patient
                </Link>
                <Link to="/check-risk" className="btn">
                  Check an existing patient
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {!stages && status.modelsTrained && (
            <p className={styles.already}>
              Data is already loaded: {status.geneticCount} genes and {status.patientCount}{' '}
              patients. All 4 models are trained.
            </p>
          )}

          {error && (
            <ErrorState
              title="Data not loaded"
              message={error.message}
              command={error.offline ? START_COMMAND : undefined}
            />
          )}
        </section>
      )}

      <details className={styles.advanced}>
        <summary>Advanced: server address</summary>
        <form className={styles.urlForm} onSubmit={saveUrl}>
          <div className="field">
            <label htmlFor="api-url">Server address (API URL)</label>
            <input
              id="api-url"
              className="input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn">
            Save and reconnect
          </button>
        </form>
        <p className="hint">Only change this if cds_server runs on another address. Saved in this browser.</p>
      </details>
    </div>
  );
}

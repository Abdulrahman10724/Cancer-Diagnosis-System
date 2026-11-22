import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiUrl, setApiUrl } from '../api/client';
import { useAppState } from '../state/AppState';
import { ErrorState, LoadingState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Setup.module.css';

export default function Setup() {
  const { state, refresh, log } = useAppState();
  const [url, setUrl] = useState(getApiUrl());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const saveUrl = async (event) => {
    event.preventDefault();
    setApiUrl(url.trim());
    setMessage(null);
    setError(null);
    await refresh();
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.loadData();
      await refresh();
      const trained = result.modelsTrained ? 'Models trained.' : 'Models not trained.';
      const text = `Data loaded: ${result.geneticCount} genes, ${result.patientCount} patients. ${trained}`;
      setMessage(text);
      log(text);
    } catch (e) {
      setError(e.message);
      if (e.offline) refresh();
    } finally {
      setLoading(false);
    }
  };

  const { status } = state;

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Setup</h1>
        <p className={screen.lede}>
          Connect to cds_server and load the gene and patient data. The four models train as
          the data loads.
        </p>
      </div>

      {state.server === 'checking' && <LoadingState>Checking the server…</LoadingState>}

      {state.server === 'offline' && (
        <ErrorState
          title="Server not running"
          message={state.serverError}
          command={START_COMMAND}
          action={
            <button type="button" className="btn" onClick={refresh}>
              Check again
            </button>
          }
        />
      )}

      {state.server === 'online' && (
        <section className={screen.section} aria-labelledby="status-heading">
          <h2 id="status-heading">Server status</h2>
          <dl className={styles.status}>
            <div>
              <dt>Connection</dt>
              <dd>Connected</dd>
            </div>
            <div>
              <dt>Models</dt>
              <dd className={status.modelsTrained ? styles.ok : styles.pending}>
                {status.modelsTrained ? 'Trained' : 'Not trained yet'}
              </dd>
            </div>
            <div>
              <dt>Genes</dt>
              <dd className="num">{status.geneticCount}</dd>
            </div>
            <div>
              <dt>Patients</dt>
              <dd className="num">{status.patientCount}</dd>
            </div>
          </dl>

          <div className={screen.row}>
            <button type="button" className="btn btn-primary" onClick={loadData} disabled={loading}>
              {loading ? 'Loading data…' : status.modelsTrained ? 'Reload data' : 'Load data'}
            </button>
            <span className="hint">Reads data/genes.csv, data/patients.csv and data/patient_genes.csv</span>
          </div>
          {message && (
            <p className={screen.toast} role="status">
              {message} Next: <Link to="/accession">add a patient</Link> or{' '}
              <Link to="/gel">run a gel</Link>.
            </p>
          )}
          {error && <ErrorState title="Data not loaded" message={error} />}
        </section>
      )}

      <section className={screen.section} aria-labelledby="api-heading">
        <h2 id="api-heading">Server address</h2>
        <form className={styles.urlForm} onSubmit={saveUrl}>
          <div className="field">
            <label htmlFor="api-url">API URL</label>
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
        <p className="hint">Saved in this browser only.</p>
      </section>
    </div>
  );
}

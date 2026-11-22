import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS } from '../lib/models';
import { pct, score } from '../lib/format';
import SpecimenLabel from '../components/SpecimenLabel';
import { OutcomeTag } from '../components/Lane';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Report.module.css';

function PatientPicker({ patients, current }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(current || '');
  return (
    <form
      className={styles.picker}
      onSubmit={(e) => {
        e.preventDefault();
        if (value) navigate(`/report/${encodeURIComponent(value)}`);
      }}
    >
      <div className="field">
        <label htmlFor="report-patient">Patient</label>
        <select id="report-patient" className="select" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Choose a patient</option>
          {patients.map((p) => (
            <option key={p.patient_id} value={p.patient_id}>
              {p.patient_id}, {p.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn" disabled={!value}>
        Open report
      </button>
    </form>
  );
}

export default function Report() {
  const { patientId } = useParams();
  const { state } = useAppState();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printedAt] = useState(() => new Date());

  const patient = state.patients.find((p) => p.patient_id === patientId);

  useEffect(() => {
    if (!patientId || state.server !== 'online') return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    api
      .diagnoseAll(patientId)
      .then((data) => !cancelled && setResult(data))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [patientId, state.server]);

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Report</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  const votes = result ? result.consensus.cancer : 0;
  const unanimous = votes === 0 || votes === 4;

  return (
    <div className={screen.screen}>
      <div className={`${screen.head} ${styles.noPrint}`}>
        <h1>Report</h1>
        <p className={screen.lede}>One page per patient with all four model verdicts.</p>
      </div>

      <div className={styles.noPrint}>
        {state.patients.length === 0 ? (
          <EmptyState
            title="No patients yet"
            action={
              <Link className="btn" to="/setup">
                Go to Setup
              </Link>
            }
          >
            Load the data on Setup or add a patient from Accession.
          </EmptyState>
        ) : (
          <PatientPicker key={patientId} patients={state.patients} current={patientId} />
        )}
      </div>

      {loading && <LoadingState>Running the four models…</LoadingState>}
      {error && (
        <ErrorState
          title="Report not available"
          message={error.message}
          command={error.offline ? START_COMMAND : undefined}
          action={
            error.status === 400 ? (
              <Link className="btn" to="/setup">
                Go to Setup
              </Link>
            ) : undefined
          }
        />
      )}

      {result && (
        <article className={styles.report} aria-labelledby="report-title">
          <header className={styles.reportHead}>
            <div>
              <h2 id="report-title" className={styles.reportTitle}>
                Genetic risk report
              </h2>
              <p className={styles.issued}>
                Issued {printedAt.toLocaleDateString()} at{' '}
                {printedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            </div>
            <SpecimenLabel id={result.patient_id} />
          </header>

          <dl className={styles.details}>
            <div>
              <dt>Patient ID</dt>
              <dd>{result.patient_id}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{patient ? patient.name : 'Unknown'}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{patient && patient.age > 0 ? `${patient.age} years` : 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Mean mutation score</dt>
              <dd className="num">{score(result.featureRaw)}</dd>
            </div>
          </dl>

          <section className={styles.block} aria-labelledby="genes-title">
            <h3 id="genes-title">Genes tested</h3>
            {patient && patient.genes && patient.genes.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Gene</th>
                    <th scope="col">Mutation score</th>
                    <th scope="col">Known label</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.genes.map((g, i) => (
                    <tr key={`${g.gene_id}-${i}`}>
                      <td>{g.gene_id}</td>
                      <td className="num">{score(g.mutation_score)}</td>
                      <td>{g.label === 1 ? 'Linked to cancer' : 'Not linked'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hint">
                No genes are recorded for this patient, so the models used the mean score of all
                genes.
              </p>
            )}
          </section>

          <section className={styles.block} aria-labelledby="verdicts-title">
            <h3 id="verdicts-title">Model verdicts</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Risk</th>
                  <th scope="col">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => {
                  const r = result.models[m.key];
                  return (
                    <tr key={m.key}>
                      <td>
                        <span className={styles.model}>
                          <span className={styles.swatch} style={{ background: m.stain }} aria-hidden="true" />
                          {m.name}
                          {m.key === 'knn' && <span className="hint"> (K={r.k})</span>}
                        </span>
                      </td>
                      <td className="num">{pct(r.risk)}</td>
                      <td>
                        <OutcomeTag prediction={r.prediction} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className={`${styles.consensus} ${unanimous ? '' : styles.disagree}`} aria-labelledby="consensus-title">
            <h3 id="consensus-title">Consensus</h3>
            <p>
              {votes} of 4 models say cancerous.{' '}
              {unanimous ? 'All four models agree.' : votes === 2 ? 'No majority.' : ''}
            </p>
            {!unanimous && (
              <p className={styles.flag}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M7 1L13 12H1z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 5v3.5M7 10v1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Models disagree. Look at the gel and the model explanations before drawing any
                conclusion.
              </p>
            )}
          </section>

          <p className={styles.disclaimer}>Educational project — not for clinical use.</p>
        </article>
      )}

      {result && (
        <div className={`${screen.row} ${styles.noPrint}`}>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print report
          </button>
          <Link className="btn" to="/gel">
            Back to gel
          </Link>
        </div>
      )}

      {!patientId && state.patients.length > 0 && (
        <p className={`hint ${styles.noPrint}`}>Choose a patient to see their report.</p>
      )}
    </div>
  );
}

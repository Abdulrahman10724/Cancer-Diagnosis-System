import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS } from '../lib/models';
import { RISK_WORD, confidence, pct0, riskLevel, score } from '../lib/format';
import { averageRisk, votesOf } from '../hooks/useRiskRun';
import PageHeader from '../components/PageHeader';
import PatientPicker from '../components/PatientPicker';
import { RiskBadge, RiskBar } from '../components/Risk';
import { Disclaimer, EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import styles from './PatientReport.module.css';

export default function PatientReport() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { state, saveResult } = useAppState();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [issued] = useState(() => new Date());

  const id = patientId || state.selectedPatient || '';
  const patient = state.patients.find((p) => p.patient_id === id);
  const ready = state.server === 'online' && state.status.modelsTrained;

  useEffect(() => {
    if (!id || !ready) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .diagnoseAll(id)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        saveResult(id, data);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, ready, saveResult]);

  const votes = result ? votesOf(result) : 0;
  const average = result ? averageRisk(result) : 0;

  return (
    <div>
      <div className={styles.noPrint}>
        <PageHeader title="Patient report" purpose="A one-page summary of one patient that you can print or save as PDF." />
        <div className={styles.pick}>
          <PatientPicker
            patients={state.patients}
            value={id}
            onChange={(v) => v && navigate(`/report/${encodeURIComponent(v)}`)}
          />
          {result && (
            <button type="button" className="btn btn-primary btn-large" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {ready && state.patients.length === 0 && (
        <EmptyState title="No patients yet" action={<Link className="btn btn-primary" to="/add-patient">Add patient</Link>}>
          Add a patient first.
        </EmptyState>
      )}
      {!id && state.patients.length > 0 && <p className={`hint ${styles.noPrint}`}>Choose a patient to see their report.</p>}
      {loading && !result && <LoadingState lines={6}>Preparing the report…</LoadingState>}
      {error && (
        <ErrorState
          title="Report not available"
          message={error.offline ? 'The server is not running. Start cds_server and try again.' : error.message}
          command={error.offline ? START_COMMAND : undefined}
        />
      )}

      {result && patient && result.patient_id === id && (
        <article className={styles.report} aria-labelledby="report-title">
          <header className={styles.head}>
            <div>
              <h2 id="report-title" className={styles.title}>Cancer risk report</h2>
              <p className={styles.date}>
                {issued.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })},{' '}
                {issued.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </p>
            </div>
            <RiskBadge risk={average} size="lg" />
          </header>

          <dl className={styles.details}>
            <div><dt>Name</dt><dd>{patient.name}</dd></div>
            <div><dt>Patient ID</dt><dd>{patient.patient_id}</dd></div>
            <div><dt>Age</dt><dd>{patient.age > 0 ? `${patient.age} years` : 'Not recorded'}</dd></div>
            <div><dt>Average gene score</dt><dd className="num">{score(result.featureRaw)}</dd></div>
          </dl>

          <section className={styles.block} aria-labelledby="r-final">
            <h3 id="r-final">Final result</h3>
            <p className={styles.final}>
              <strong>{votes} of 4 models say cancer.</strong> Their average chance is {pct0(average)} ({RISK_WORD[riskLevel(average)].toLowerCase()}).
              {votes !== 0 && votes !== 4 && ' The models disagree, so this result is uncertain.'}
            </p>
            <RiskBar value={average} color={`var(--${riskLevel(average)})`} height={14} lineLabel label={`Average chance ${pct0(average)}`} />
          </section>

          <section className={styles.block} aria-labelledby="r-models">
            <h3 id="r-models">Each model</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Chance of cancer</th>
                  <th scope="col">Says</th>
                  <th scope="col">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => {
                  const r = result.models[m.key];
                  return (
                    <tr key={m.key}>
                      <td>
                        <span className={styles.model}>
                          <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                          {m.name}
                        </span>
                      </td>
                      <td>
                        <span className={styles.barCell}>
                          <span className="num">{pct0(r.risk)}</span>
                          <RiskBar value={r.risk} color={m.color} height={8} label={`${pct0(r.risk)}`} />
                        </span>
                      </td>
                      <td>{r.prediction === 1 ? 'Cancer' : 'No cancer'}</td>
                      <td>{confidence(r.risk)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">The black mark on each bar is the 50% cancer line. Above it, the model says cancer.</p>
          </section>

          <section className={styles.block} aria-labelledby="r-genes">
            <h3 id="r-genes">Gene scores</h3>
            {patient.genes && patient.genes.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Gene</th>
                    <th scope="col">Mutation score (0 to 1)</th>
                    <th scope="col">Linked to cancer?</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.genes.map((g, i) => (
                    <tr key={`${g.gene_id}-${i}`}>
                      <td>{g.gene_id}</td>
                      <td className="num">{score(g.mutation_score)}</td>
                      <td>{g.label === 1 ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hint">No gene scores are recorded for this patient, so the models used the average of all genes.</p>
            )}
          </section>

          <Disclaimer />
        </article>
      )}
    </div>
  );
}

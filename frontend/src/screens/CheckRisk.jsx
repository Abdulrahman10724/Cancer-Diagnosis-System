import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { MODELS, modelByKey } from '../lib/models';
import { RISK_WORD, pct0, riskLevel, score } from '../lib/format';
import useRiskRun, { averageRisk, votesOf } from '../hooks/useRiskRun';
import PageHeader from '../components/PageHeader';
import PatientPicker from '../components/PatientPicker';
import ModelCard from '../components/ModelCard';
import FinalResult from '../components/FinalResult';
import CompareChart from '../components/CompareChart';
import Drawer from '../components/Drawer';
import Explain from '../components/Explain';
import { Disclaimer, EmptyState, ErrorState, START_COMMAND } from '../components/States';
import styles from './CheckRisk.module.css';

function cardState(phase, index, revealed) {
  if (phase === 'idle' || phase === 'error') return 'waiting';
  if (phase === 'flowing') return 'reading';
  if (phase === 'analyzing') return 'analyzing';
  if (phase === 'resolving') return index < revealed ? 'done' : 'analyzing';
  return 'done';
}

function GeneStrip({ patient, phase }) {
  const genes = patient.genes || [];
  if (genes.length === 0) {
    return (
      <p className="hint">
        No gene scores are recorded for {patient.name}, so the models use the average score of
        all genes.
      </p>
    );
  }
  const average = genes.reduce((s, g) => s + g.mutation_score, 0) / genes.length;
  return (
    <div className={`${styles.genes} ${phase === 'flowing' ? styles.genesFlowing : ''}`}>
      <span className={styles.genesLabel}>
        {patient.name}&apos;s gene scores (average {score(average)})
      </span>
      <ul className={styles.geneList}>
        {genes.map((g, i) => (
          <li key={`${g.gene_id}-${i}`} className={styles.gene} style={{ '--i': i }}>
            <span className={styles.geneId}>{g.gene_id}</span>
            <span className="num">{score(g.mutation_score)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Disagree({ result }) {
  const votes = votesOf(result);
  if (votes === 0 || votes === 4) return null;
  return (
    <div className={styles.disagree} role="note">
      <strong>The models disagree ({votes} say cancer, {4 - votes} say no cancer).</strong>
      <span>
        {Math.abs(result.featureRaw - 0.5) < 0.12
          ? `This patient's average gene score (${score(result.featureRaw)}) is close to the middle, where cancer and normal genes overlap. Small differences between the models change the answer.`
          : 'Each model learned its own rule from the training genes, so they draw the cancer line in slightly different places.'}{' '}
        Treat this result with care.
      </span>
    </div>
  );
}

// Results for one patient: final card, four model cards, comparison chart
function PatientResult({ patient, runner, compact, onWhy, onRunKnn }) {
  const { phase, result, revealed, votesShown, k } = runner;
  return (
    <div className={styles.patientResult}>
      <FinalResult
        patient={patient}
        result={result}
        average={result ? averageRisk(result) : 0}
        votes={result ? votesOf(result) : 0}
        votesShown={votesShown}
        phase={phase}
        compact={compact}
      />
      {phase === 'done' && result && <Disagree result={result} />}
      <div className={compact ? styles.cardsCompact : styles.cards}>
        {MODELS.map((m, i) => (
          <ModelCard
            key={m.key}
            model={m}
            index={i}
            data={result ? result.models[m.key] : null}
            state={cardState(phase, i, revealed)}
            genes={patient.genes || []}
            compact={compact}
            k={k}
            onK={m.key === 'knn' ? onRunKnn : undefined}
            onWhy={() => onWhy(patient.patient_id, m.key)}
          />
        ))}
      </div>
      {phase === 'done' && result && !compact && <CompareChart result={result} />}
    </div>
  );
}

export default function CheckRisk() {
  const { state, log, toast, selectPatient, saveResult } = useAppState();
  const [params, setParams] = useSearchParams();
  const [patientId, setPatientId] = useState(params.get('patient') || state.selectedPatient || '');
  const [compareId, setCompareId] = useState('');
  const [comparing, setComparing] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [announce, setAnnounce] = useState('');
  const a = useRiskRun();
  const b = useRiskRun();
  const autoRun = useRef(params.get('run') === '1');

  const patient = state.patients.find((p) => p.patient_id === patientId);
  const other = state.patients.find((p) => p.patient_id === compareId);
  const ready = state.server === 'online' && state.status.modelsTrained;

  const finish = useCallback(
    (p, data) => {
      if (!data) return;
      const votes = votesOf(data);
      const level = riskLevel(averageRisk(data));
      saveResult(p.patient_id, data);
      log(`Checked ${p.name} (${p.patient_id}): ${votes} of 4 models say cancer.`);
      setAnnounce(`${p.name}: ${RISK_WORD[level]}, ${votes} of 4 models say cancer.`);
    },
    [log, saveResult],
  );

  const runA = useCallback(async () => {
    if (!patient) return;
    selectPatient(patient.patient_id);
    finish(patient, await a.run(patient.patient_id, a.k));
  }, [patient, a, selectPatient, finish]);

  const runB = useCallback(async () => {
    if (!other) return;
    finish(other, await b.run(other.patient_id, b.k));
  }, [other, b, finish]);

  // "Check risk now" from Add patient
  useEffect(() => {
    if (autoRun.current && patient && ready) {
      autoRun.current = false;
      setParams({}, { replace: true });
      runA();
    }
  }, [patient, ready, runA, setParams]);

  const choose = (id) => {
    setPatientId(id);
    a.reset();
    if (id) selectPatient(id);
  };

  const changeK = (runner, p) => async (k) => {
    const data = await runner.changeK(p.patient_id, k);
    if (data) {
      const knn = data.models.knn;
      log(`KNN for ${p.name} with K=${k}: ${knn.explain.votesCancer} of ${k} similar genes were cancer genes, ${pct0(knn.risk)}.`);
    }
  };

  const addToList = async () => {
    try {
      const res = await api.enqueue(patient.patient_id);
      toast(`${patient.name} added to the waiting list`);
      log(`${patient.name} added to the waiting list (position ${res.queueSize}).`);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const drawerRunner = drawer && (drawer.id === patientId ? a : b);
  const drawerData = drawerRunner && drawerRunner.result;
  const drawerModel = drawer && modelByKey(drawer.model);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const error = a.error || b.error;

  return (
    <div>
      <PageHeader title="Check risk" purpose="Pick a patient and see what each AI model thinks." />

      {state.server === 'online' && state.status.modelsTrained && state.patients.length === 0 && (
        <EmptyState title="No patients yet" action={<Link className="btn btn-primary" to="/add-patient">Add patient</Link>}>
          Add a patient with their gene scores first.
        </EmptyState>
      )}

      <div className={styles.pickRow}>
        <PatientPicker patients={state.patients} value={patientId} onChange={choose} />
        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={runA}
          disabled={!patient || !ready || ['flowing', 'analyzing', 'resolving', 'voting'].includes(a.phase)}
        >
          Check risk
        </button>
        {!comparing && (
          <button type="button" className="btn" onClick={() => setComparing(true)} disabled={!patient}>
            Compare with another patient
          </button>
        )}
      </div>

      {comparing && (
        <div className={styles.pickRow}>
          <PatientPicker
            label="Second patient"
            patients={state.patients}
            value={compareId}
            exclude={patientId}
            onChange={(id) => {
              setCompareId(id);
              b.reset();
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={runB}
            disabled={!other || !ready || ['flowing', 'analyzing', 'resolving', 'voting'].includes(b.phase)}
          >
            Check second patient
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setComparing(false);
              setCompareId('');
              b.reset();
            }}
          >
            Stop comparing
          </button>
        </div>
      )}

      {error && (
        <ErrorState
          title="Could not check the risk"
          message={error.offline ? 'The server is not running. Start cds_server and press Check risk again.' : error.message}
          command={error.offline ? START_COMMAND : undefined}
        />
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announce}
      </p>

      {patient && (
        <div className={comparing ? styles.compare : undefined}>
          <div className={styles.column}>
            <GeneStrip patient={patient} phase={a.phase} />
            <PatientResult
              patient={patient}
              runner={a}
              compact={comparing}
              onWhy={(id, model) => setDrawer({ id, model })}
              onRunKnn={changeK(a, patient)}
            />
          </div>
          {comparing && other && (
            <div className={styles.column}>
              <GeneStrip patient={other} phase={b.phase} />
              <PatientResult
                patient={other}
                runner={b}
                compact
                onWhy={(id, model) => setDrawer({ id, model })}
                onRunKnn={changeK(b, other)}
              />
            </div>
          )}
          {comparing && !other && (
            <EmptyState title="Choose a second patient">
              Pick another patient above to see both results side by side.
            </EmptyState>
          )}
        </div>
      )}

      {patient && a.phase === 'done' && (
        <div className={styles.actions}>
          <Link className="btn btn-primary" to={`/report/${encodeURIComponent(patient.patient_id)}`}>
            See full report
          </Link>
          <button type="button" className="btn" onClick={addToList}>
            Add to waiting list
          </button>
        </div>
      )}

      <Disclaimer />

      <Drawer
        open={Boolean(drawerData && drawerModel)}
        title={drawerModel ? `Why: ${drawerModel.name}` : ''}
        onClose={closeDrawer}
      >
        {drawerData && <Explain model={drawer.model} data={drawerData} genes={state.genes} />}
      </Drawer>
    </div>
  );
}

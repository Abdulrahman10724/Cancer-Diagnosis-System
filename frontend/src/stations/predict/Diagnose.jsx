import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import CountUp from '../../components/CountUp';
import Drawer from '../../components/Drawer';
import PatientPicker from '../../components/PatientPicker';
import { ErrorState, Loading } from '../../components/States';
import { ModelSwatch } from '../../components/Legend';
import Verdict, { verdictOf } from '../../components/Verdict';
import { FEATURES, MODELS } from '../../lib/metro';
import { featureValue, pct } from '../../lib/format';
import { useJourney } from '../../state/Journey';
import AddPatient from './AddPatient';
import Why from './Why';
import styles from './Predict.module.css';

export default function Diagnose({ patients, patientId, setPatientId }) {
  const reduce = useReducedMotion();
  const { journey, complete, toast, announce } = useJourney();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [why, setWhy] = useState(null);
  const [adding, setAdding] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  if (patients.loading) return <Loading label="Reading patients" />;
  if (patients.error) return <ErrorState error={patients.error} onRetry={patients.reload} />;
  const list = patients.data;
  const patient = list.find((p) => p.patient_id === patientId);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.diagnose(patientId, journey.k);
      setResult({ ...data, run: Date.now() });
      complete('predict');
      const v = verdictOf(data.consensus.meanRisk);
      announce(`${v.word} for ${patientId}: ${data.consensus.cancer} of 4 models say cancer.`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.deletePatient(patientId);
      toast(`Deleted ${patientId}. You can undo this.`);
      setResult(null);
      setPatientId(null);
      setCanUndo(true);
      patients.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const undo = async () => {
    try {
      const r = await api.undo();
      toast(`Undone: ${r.undone}.`);
      setCanUndo(r.undoAvailable > 0);
      setResult(null);
      patients.reload();
    } catch (e) {
      setCanUndo(false);
      toast(e.message, 'error');
    }
  };

  const showing = result && result.patient_id === patientId;
  const stagger = reduce ? 0 : 0.15;
  const featureDelay = reduce ? 0 : 0.05;
  const barsStart = reduce ? 0 : 0.35;

  return (
    <div className={styles.diagnose}>
      <div className={styles.pickRow}>
        <PatientPicker patients={list} value={patientId} onChange={setPatientId} label="Patient" />
        <div className={styles.pickActions}>
          <button type="button" className="btn btn-primary" disabled={!patientId || busy} onClick={check}>
            {busy ? 'Checking…' : 'Check this patient'}
          </button>
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            Add patient
          </button>
        </div>
      </div>

      {patient && (
        <div className={styles.patientLine}>
          <span>
            <strong>{patient.patient_id}</strong>, {patient.name}, age {patient.age},{' '}
            {patient.diagnosis === null ? 'diagnosis unknown' : patient.diagnosis === 1 ? 'known cancer' : 'known no cancer'}
          </span>
          <span className={styles.patientTools}>
            <button type="button" className="btn btn-quiet" onClick={remove}>
              Delete patient
            </button>
          </span>
        </div>
      )}
      {canUndo && (
        <div className={styles.undoRow}>
          <span className="muted small">The last change can be undone.</span>
          <button type="button" className="btn" onClick={undo}>
            Undo
          </button>
        </div>
      )}

      {error && <ErrorState error={error} onRetry={check} />}
      {!patientId && !showing && (
        <p className="muted">Pick a patient, or add a new one, then press “Check this patient”.</p>
      )}

      {showing && (
        <div className={styles.result} key={result.run}>
          <dl className={styles.featureRow}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.key}
                className={styles.feature}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * featureDelay, duration: 0.2 }}
              >
                <dt>{f.name}</dt>
                <dd>{featureValue(f.key, result.features[f.key])}</dd>
              </motion.div>
            ))}
          </dl>

          <div className={styles.models}>
            <div className={styles.scaleHead} aria-hidden="true">
              <span>0%</span>
              <span className={styles.cancerLineLabel}>50% cancer line</span>
              <span>100%</span>
            </div>
            {MODELS.map((m, i) => {
              const r = result.models[m.key];
              const delay = barsStart + i * stagger;
              return (
                <div key={m.key} className={styles.modelRow}>
                  <div className={styles.modelName}>
                    <ModelSwatch model={m} />
                    <span>{m.name}</span>
                  </div>
                  <div className={styles.track}>
                    <motion.div
                      className={styles.fill}
                      style={{ background: m.color }}
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${r.risk * 100}%` }}
                      transition={{ delay, duration: 0.5, ease: [0.22, 0.8, 0.3, 1] }}
                    />
                    <span className={styles.cancerLine} aria-hidden="true" />
                  </div>
                  <div className={styles.modelValue}>
                    <DelayedPct value={r.risk} delay={delay} />
                    <span className={styles.says}>{r.prediction === 1 ? 'says cancer' : 'says no cancer'}</span>
                  </div>
                  <button type="button" className="btn btn-quiet" onClick={() => setWhy(m.key)}>
                    Why?
                  </button>
                </div>
              );
            })}
          </div>

          <motion.div
            className={styles.verdictRow}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : barsStart + 4 * stagger + 0.3, duration: 0.25 }}
          >
            <Verdict risk={result.consensus.meanRisk} />
            <p className={styles.votes}>
              <strong>
                {result.consensus.cancer} of 4 models say cancer.
              </strong>{' '}
              Average risk {pct(result.consensus.meanRisk)}.{' '}
              {patient && patient.diagnosis !== null && (
                <span className="muted">The real diagnosis is {patient.diagnosis === 1 ? 'cancer' : 'no cancer'}.</span>
              )}
            </p>
          </motion.div>
          <p className="muted small">
            KNN used K = {result.models.knn.k}; the KD-tree visited {result.models.knn.explain.kdNodesVisited} nodes to find the
            neighbours. An average risk from 40% to 60% counts as borderline.
          </p>
        </div>
      )}

      <Drawer open={!!why && showing} onClose={() => setWhy(null)} title={why ? `Why: ${MODELS.find((m) => m.key === why).name}` : ''} wide>
        {why && showing && <Why model={why} result={result} />}
      </Drawer>
      <Drawer open={adding} onClose={() => setAdding(false)} title="Add patient" wide>
        <AddPatient
          onAdded={(id) => {
            setAdding(false);
            setPatientId(id);
            setResult(null);
            setCanUndo(true);
            patients.reload();
            toast(`Added ${id}. Press “Check this patient” to see the risk.`);
          }}
        />
      </Drawer>
    </div>
  );
}

function DelayedPct({ value, delay }) {
  return (
    <span className={styles.pct}>
      <CountUpAfter value={value * 100} delay={delay} />%
    </span>
  );
}

function CountUpAfter({ value, delay }) {
  const [go, setGo] = useState(delay === 0);
  useEffect(() => {
    if (delay === 0) return undefined;
    const t = window.setTimeout(() => setGo(true), delay * 1000);
    return () => window.clearTimeout(t);
  }, [delay]);
  return <CountUp value={value} start={go} duration={0.5} />;
}

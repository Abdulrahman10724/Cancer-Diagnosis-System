import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { riskLevel, score } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Help from '../components/Help';
import { ErrorState, START_COMMAND } from '../components/States';
import styles from './AddPatient.module.css';

let rowCounter = 0;
const newGene = () => ({ key: ++rowCounter, geneId: '', score: 0.5, linked: null });
const hasComma = (v) => v.includes(',');

function validate(form, existingIds) {
  const errors = {};
  const id = form.id.trim();
  if (!id) errors.id = 'Enter a patient ID, for example P020.';
  else if (hasComma(id) || /\s/.test(id)) errors.id = 'Use letters and numbers only, with no spaces or commas.';
  else if (existingIds.has(id.toLowerCase())) errors.id = 'This patient ID already exists. Choose another one.';
  if (!form.name.trim()) errors.name = "Enter the patient's name.";
  else if (hasComma(form.name)) errors.name = 'Remove the comma from the name.';
  const age = Number(form.age);
  if (form.age === '' || !Number.isInteger(age) || age < 0 || age > 120) errors.age = 'Enter an age from 0 to 120.';
  const genes = form.genes.map((g) => {
    const e = {};
    if (!g.geneId.trim()) e.geneId = 'Enter a gene ID.';
    else if (hasComma(g.geneId) || /\s/.test(g.geneId)) e.geneId = 'No spaces or commas.';
    if (g.linked === null) e.linked = 'Choose Yes or No.';
    return e;
  });
  if (genes.some((e) => Object.keys(e).length)) errors.genes = genes;
  return errors;
}

function GeneRow({ gene, index, error, onChange, onRemove, canRemove }) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  return (
    <motion.li
      className={styles.geneRow}
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40, height: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className={styles.geneInner}>
        <div className={styles.geneTop}>
          <h3 className={styles.geneTitle}>Gene {index + 1}</h3>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`Remove gene ${index + 1}`}
          >
            Remove
          </button>
        </div>
        <div className="field">
          <label htmlFor={`${id}-gid`}>Gene ID</label>
          <input
            id={`${id}-gid`}
            className="input"
            value={gene.geneId}
            placeholder="GENE_301"
            onChange={(e) => onChange({ geneId: e.target.value })}
            aria-invalid={Boolean(error && error.geneId)}
            aria-describedby={error && error.geneId ? `${id}-gid-err` : undefined}
            autoComplete="off"
          />
          {error && error.geneId && <span id={`${id}-gid-err`} className="field-error">{error.geneId}</span>}
        </div>
        <div className="field">
          <label htmlFor={`${id}-score`}>Mutation score</label>
          <div className={styles.scoreRow}>
            <input
              id={`${id}-score`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gene.score}
              onChange={(e) => onChange({ score: Number(e.target.value) })}
              className={styles.slider}
              aria-describedby={`${id}-score-hint`}
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              className={`input ${styles.scoreBox}`}
              value={gene.score}
              aria-label={`Mutation score for gene ${index + 1}, number`}
              onChange={(e) => {
                const v = Math.max(0, Math.min(1, Number(e.target.value)));
                onChange({ score: Number.isNaN(v) ? 0 : v });
              }}
            />
          </div>
          <span id={`${id}-score-hint`} className="hint">0 = normal gene, 1 = highly mutated gene.</span>
        </div>
        <fieldset className={styles.yesNo}>
          <legend>Is this gene linked to cancer?</legend>
          <div className={styles.toggle}>
            {[
              { v: true, label: 'Yes' },
              { v: false, label: 'No' },
            ].map((o) => (
              <label key={o.label} className={`${styles.toggleOption} ${gene.linked === o.v ? styles.toggleOn : ''}`}>
                <input
                  type="radio"
                  name={`${id}-linked`}
                  checked={gene.linked === o.v}
                  onChange={() => onChange({ linked: o.v })}
                />
                {o.label}
              </label>
            ))}
          </div>
          {error && error.linked && <span className="field-error">{error.linked}</span>}
        </fieldset>
      </div>
    </motion.li>
  );
}

function Preview({ genes }) {
  const reduceMotion = useReducedMotion();
  const avg = genes.length ? genes.reduce((s, g) => s + g.score, 0) / genes.length : 0;
  const level = riskLevel(avg);
  const meaning = {
    low: 'this usually means lower risk.',
    medium: 'this is in the middle, where the models often disagree.',
    high: 'this usually means higher risk.',
  }[level];
  return (
    <aside className={styles.preview} aria-label="Preview">
      <h2 className={styles.previewTitle}>Preview</h2>
      <p className={styles.previewNumber}>
        Average score <strong className="num">{score(avg)}</strong>
      </p>
      <div className={styles.meter} aria-hidden="true">
        <motion.span
          className={styles.meterFill}
          style={{ background: `var(--${level})` }}
          animate={{ width: `${avg * 100}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 22 }}
        />
      </div>
      <div className={styles.meterScale} aria-hidden="true">
        <span>0 normal</span>
        <span>1 highly mutated</span>
      </div>
      <p>
        Average score {score(avg)} — {meaning}
        <Help term="Average score">
          The models do not look at each gene separately. They use the average of the
          patient&apos;s gene scores as their input.
        </Help>
      </p>
    </aside>
  );
}

export default function AddPatient() {
  const { state, refresh, log, toast, selectPatient } = useAppState();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [form, setForm] = useState({ id: '', name: '', age: '', genes: [newGene()] });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [saved, setSaved] = useState(null);

  const existingIds = new Set(state.patients.map((p) => p.patient_id.toLowerCase()));

  const update = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (submitted) setErrors(validate(next, existingIds));
  };
  const updateGene = (key, patch) => update({ genes: form.genes.map((g) => (g.key === key ? { ...g, ...patch } : g)) });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    const found = validate(form, existingIds);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = document.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    const payload = {
      patient_id: form.id.trim(),
      name: form.name.trim(),
      age: Number(form.age),
      geneticRecords: form.genes.map((g) => ({
        geneId: g.geneId.trim(),
        mutationScore: g.score,
        label: g.linked ? 1 : 0,
      })),
    };
    setSaving(true);
    try {
      await api.addPatient(payload);
      await refresh();
      selectPatient(payload.patient_id);
      log(`Added ${payload.name} (${payload.patient_id}) with ${payload.geneticRecords.length} gene scores. The models learned from the new genes.`);
      toast('Patient saved');
      setSaved(payload);
      setForm({ id: '', name: '', age: '', genes: [newGene()] });
      setSubmitted(false);
      setErrors({});
    } catch (err) {
      if (err.status === 409) {
        setErrors({ id: 'This patient ID already exists. Choose another one.' });
        document.getElementById('pid')?.focus();
      } else setServerError(err);
    } finally {
      setSaving(false);
    }
  };

  const addToList = async () => {
    try {
      const res = await api.enqueue(saved.patient_id);
      toast(`${saved.name} added to the waiting list`);
      log(`${saved.name} added to the waiting list (position ${res.queueSize}).`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Add patient" purpose="Enter a patient and their gene scores. The models will learn from them too." />

      <AnimatePresence>
        {saved && (
          <motion.section
            className={styles.success}
            initial={reduceMotion ? false : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-labelledby="saved-title"
          >
            <h2 id="saved-title">{saved.name} is saved.</h2>
            <p>What would you like to do next?</p>
            <div className={styles.successActions}>
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={() => navigate(`/check-risk?patient=${encodeURIComponent(saved.patient_id)}&run=1`)}
              >
                Check risk now
              </button>
              <button type="button" className="btn btn-large" onClick={addToList}>
                Add to waiting list
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setSaved(null)}>
                Add another patient
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <section className={styles.section} aria-labelledby="who">
            <h2 id="who">Patient</h2>
            <div className={styles.patientFields}>
              <div className="field">
                <label htmlFor="pid">Patient ID</label>
                <input id="pid" className="input" value={form.id} onChange={(e) => update({ id: e.target.value })} aria-invalid={Boolean(errors.id)} aria-describedby={errors.id ? 'pid-err' : undefined} autoComplete="off" placeholder="P020" />
                {errors.id && <span id="pid-err" className="field-error">{errors.id}</span>}
              </div>
              <div className="field">
                <label htmlFor="pname">Name</label>
                <input id="pname" className="input" value={form.name} onChange={(e) => update({ name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'pname-err' : undefined} autoComplete="off" />
                {errors.name && <span id="pname-err" className="field-error">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="page">Age</label>
                <input id="page" className="input" type="number" inputMode="numeric" min="0" max="120" value={form.age} onChange={(e) => update({ age: e.target.value })} aria-invalid={Boolean(errors.age)} aria-describedby={errors.age ? 'page-err' : undefined} />
                {errors.age && <span id="page-err" className="field-error">{errors.age}</span>}
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="genes">
            <h2 id="genes">Gene scores</h2>
            <p className="hint">Add each gene that was tested for this patient.</p>
            <ol className={styles.genes}>
              <AnimatePresence initial={false}>
                {form.genes.map((g, i) => (
                  <GeneRow
                    key={g.key}
                    gene={g}
                    index={i}
                    error={errors.genes && errors.genes[i]}
                    canRemove={form.genes.length > 1}
                    onChange={(patch) => updateGene(g.key, patch)}
                    onRemove={() => update({ genes: form.genes.filter((x) => x.key !== g.key) })}
                  />
                ))}
              </AnimatePresence>
            </ol>
            <div>
              <button type="button" className="btn" onClick={() => update({ genes: [...form.genes, newGene()] })}>
                Add gene
              </button>
            </div>
          </section>

          {serverError && (
            <ErrorState
              title="Patient not saved"
              message={serverError.offline ? 'The server is not running. Start cds_server and try again.' : serverError.message}
              command={serverError.offline ? START_COMMAND : undefined}
            />
          )}
          {!state.status.modelsTrained && state.server === 'online' && (
            <p className="hint">
              Load the data first (<Link to="/start" state={{ autoLoad: true }}>Load data</Link>) so the
              existing patients and genes are kept when you save.
            </p>
          )}

          <div>
            <button type="submit" className="btn btn-primary btn-large" disabled={saving}>
              {saving ? 'Saving…' : 'Save patient'}
            </button>
          </div>
        </form>

        <Preview genes={form.genes} />
      </div>
    </div>
  );
}

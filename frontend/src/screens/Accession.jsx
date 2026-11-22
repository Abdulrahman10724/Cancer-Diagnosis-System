import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import SpecimenLabel from '../components/SpecimenLabel';
import { ErrorState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Accession.module.css';

let rowCounter = 0;
const emptyGene = () => ({ key: ++rowCounter, geneId: '', score: '', label: '' });

// Commas would break the CSV files the server writes
const hasComma = (value) => value.includes(',');

function validate(form, existingIds) {
  const errors = {};
  const id = form.id.trim();
  if (!id) errors.id = 'Enter a patient ID.';
  else if (hasComma(id) || /\s/.test(id)) errors.id = 'Use letters and numbers only, without spaces or commas.';
  else if (existingIds.has(id.toLowerCase())) errors.id = 'This patient ID already exists.';

  if (!form.name.trim()) errors.name = 'Enter the patient name.';
  else if (hasComma(form.name)) errors.name = 'Remove the comma from the name.';

  const age = Number(form.age);
  if (form.age === '' || !Number.isInteger(age) || age < 0 || age > 120) {
    errors.age = 'Enter an age from 0 to 120.';
  }

  const geneErrors = form.genes.map((g) => {
    const e = {};
    if (!g.geneId.trim()) e.geneId = 'Enter a gene ID.';
    else if (hasComma(g.geneId) || /\s/.test(g.geneId)) e.geneId = 'No spaces or commas.';
    const s = Number(g.score);
    if (g.score === '' || Number.isNaN(s) || s < 0 || s > 1) e.score = 'Score from 0 to 1.';
    if (g.label !== '0' && g.label !== '1') e.label = 'Choose a label.';
    return e;
  });
  if (geneErrors.some((e) => Object.keys(e).length)) errors.genes = geneErrors;
  if (form.genes.length === 0) errors.genesMissing = 'Add at least one genetic record.';
  return errors;
}

export default function Accession() {
  const { state, refresh, log, loadIntoGel } = useAppState();
  const navigate = useNavigate();
  const [form, setForm] = useState({ id: '', name: '', age: '', genes: [emptyGene()] });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [rackMessage, setRackMessage] = useState(null);

  const existingIds = new Set(state.patients.map((p) => p.patient_id.toLowerCase()));

  const update = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (submitted) setErrors(validate(next, existingIds));
  };

  const updateGene = (key, patch) =>
    update({ genes: form.genes.map((g) => (g.key === key ? { ...g, ...patch } : g)) });

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    const found = validate(form, existingIds);
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      patient_id: form.id.trim(),
      name: form.name.trim(),
      age: Number(form.age),
      geneticRecords: form.genes.map((g) => ({
        geneId: g.geneId.trim(),
        mutationScore: Number(g.score),
        label: Number(g.label),
      })),
    };

    setSaving(true);
    try {
      await api.addPatient(payload);
      await refresh();
      log(`${payload.patient_id} saved with ${payload.geneticRecords.length} genetic records. Models retrained.`);
      setSaved(payload);
      setRackMessage(null);
      setForm({ id: '', name: '', age: '', genes: [emptyGene()] });
      setSubmitted(false);
      setErrors({});
    } catch (e) {
      if (e.status === 409) setErrors({ id: 'This patient ID already exists.' });
      else setServerError(e);
    } finally {
      setSaving(false);
    }
  };

  const addToRack = async () => {
    try {
      const result = await api.enqueue(saved.patient_id);
      setRackMessage(`Added to rack. ${result.queueSize} on the rack.`);
      log(`${saved.patient_id} added to the rack (position ${result.queueSize}).`);
    } catch (e) {
      setRackMessage(e.message);
    }
  };

  const runGel = () => {
    loadIntoGel(saved.patient_id);
    navigate('/gel');
  };

  const geneError = (i, field) => errors.genes && errors.genes[i] && errors.genes[i][field];

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Accession</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Accession</h1>
        <p className={screen.lede}>
          Register a patient and their genetic records. The models retrain with the new genes.
        </p>
      </div>

      {saved && (
        <section className={styles.saved} aria-labelledby="saved-heading">
          <h2 id="saved-heading">Patient saved</h2>
          <SpecimenLabel id={saved.patient_id} name={saved.name} age={saved.age} />
          <div className={screen.row}>
            <button type="button" className="btn btn-primary" onClick={runGel}>
              Run gel
            </button>
            <button type="button" className="btn" onClick={addToRack}>
              Add to rack
            </button>
            {rackMessage && (
              <span className={screen.toast} role="status">
                {rackMessage}
              </span>
            )}
          </div>
        </section>
      )}

      <form className={styles.form} onSubmit={submit} noValidate>
        <fieldset className={styles.fieldset}>
          <legend>Patient</legend>
          <div className={styles.patientFields}>
            <div className="field">
              <label htmlFor="pid">Patient ID</label>
              <input
                id="pid"
                className="input"
                value={form.id}
                onChange={(e) => update({ id: e.target.value })}
                aria-invalid={Boolean(errors.id)}
                aria-describedby={errors.id ? 'pid-error' : undefined}
                autoComplete="off"
              />
              {errors.id && <span id="pid-error" className="field-error">{errors.id}</span>}
            </div>
            <div className="field">
              <label htmlFor="pname">Name</label>
              <input
                id="pname"
                className="input"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'pname-error' : undefined}
                autoComplete="off"
              />
              {errors.name && <span id="pname-error" className="field-error">{errors.name}</span>}
            </div>
            <div className="field">
              <label htmlFor="page">Age</label>
              <input
                id="page"
                className="input"
                type="number"
                inputMode="numeric"
                min="0"
                max="120"
                value={form.age}
                onChange={(e) => update({ age: e.target.value })}
                aria-invalid={Boolean(errors.age)}
                aria-describedby={errors.age ? 'page-error' : undefined}
              />
              {errors.age && <span id="page-error" className="field-error">{errors.age}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Genetic records</legend>
          <p className="hint">
            Mutation score from 0 to 1. Label 1 marks a gene known to be linked to cancer.
          </p>
          <div className={styles.geneHead} aria-hidden="true">
            <span>Gene ID</span>
            <span>Mutation score</span>
            <span>Label</span>
            <span />
          </div>
          <ol className={styles.genes}>
            {form.genes.map((g, i) => (
              <li key={g.key} className={styles.geneRow}>
                <div className="field">
                  <label className={styles.cellLabel} htmlFor={`gid-${g.key}`}>
                    Gene ID, record {i + 1}
                  </label>
                  <input
                    id={`gid-${g.key}`}
                    className="input"
                    placeholder="GENE_201"
                    value={g.geneId}
                    onChange={(e) => updateGene(g.key, { geneId: e.target.value })}
                    aria-invalid={Boolean(geneError(i, 'geneId'))}
                  />
                  {geneError(i, 'geneId') && <span className="field-error">{geneError(i, 'geneId')}</span>}
                </div>
                <div className="field">
                  <label className={styles.cellLabel} htmlFor={`gs-${g.key}`}>
                    Mutation score, record {i + 1}
                  </label>
                  <input
                    id={`gs-${g.key}`}
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={g.score}
                    onChange={(e) => updateGene(g.key, { score: e.target.value })}
                    aria-invalid={Boolean(geneError(i, 'score'))}
                  />
                  {geneError(i, 'score') && <span className="field-error">{geneError(i, 'score')}</span>}
                </div>
                <div className="field">
                  <label className={styles.cellLabel} htmlFor={`gl-${g.key}`}>
                    Label, record {i + 1}
                  </label>
                  <select
                    id={`gl-${g.key}`}
                    className="select"
                    value={g.label}
                    onChange={(e) => updateGene(g.key, { label: e.target.value })}
                    aria-invalid={Boolean(geneError(i, 'label'))}
                  >
                    <option value="">Choose</option>
                    <option value="0">0, not linked</option>
                    <option value="1">1, linked to cancer</option>
                  </select>
                  {geneError(i, 'label') && <span className="field-error">{geneError(i, 'label')}</span>}
                </div>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => update({ genes: form.genes.filter((x) => x.key !== g.key) })}
                  disabled={form.genes.length === 1}
                  aria-label={`Remove record ${i + 1}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          {errors.genesMissing && <span className="field-error">{errors.genesMissing}</span>}
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => update({ genes: [...form.genes, emptyGene()] })}
            >
              Add record
            </button>
          </div>
        </fieldset>

        {serverError && (
          <ErrorState
            title="Patient not saved"
            message={serverError.message}
            command={serverError.offline ? START_COMMAND : undefined}
          />
        )}
        {!state.status.modelsTrained && (
          <p className="hint">
            Data is not loaded yet. Load it on Setup first so the existing patients and genes
            are kept when this patient is saved.
          </p>
        )}

        <div className={screen.row}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving patient…' : 'Save patient'}
          </button>
        </div>
      </form>
    </div>
  );
}

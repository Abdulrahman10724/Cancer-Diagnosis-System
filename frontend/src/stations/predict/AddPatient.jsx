import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import useApi from '../../lib/useApi';
import styles from './Predict.module.css';

let rowId = 0;
const newRow = () => ({ id: ++rowId, geneId: '', score: 0.5 });

/** Form for POST /patients. Known genes use their stored score; new genes need one. */
export default function AddPatient({ onAdded }) {
  const genes = useApi((signal) => api.genes({ signal }), []);
  const known = useMemo(() => new Map((genes.data || []).map((g) => [g.gene_id, g.mutation_score])), [genes.data]);
  const [form, setForm] = useState({ id: '', name: '', age: '', diagnosis: '' });
  const [rows, setRows] = useState([newRow()]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const idOk = /^[^\s,"]{1,40}$/.test(form.id);
  const nameOk = form.name.trim() !== '' && !form.name.includes(',');
  const ageNum = Number(form.age);
  const ageOk = form.age !== '' && Number.isInteger(ageNum) && ageNum >= 0 && ageNum <= 120;
  const genesOk = rows.some((r) => r.geneId.trim());
  const ready = idOk && nameOk && ageOk && genesOk;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPatient({
        patient_id: form.id.trim(),
        name: form.name.trim(),
        age: ageNum,
        diagnosis: form.diagnosis === '' ? null : Number(form.diagnosis),
        genes: rows
          .filter((r) => r.geneId.trim())
          .map((r) => (known.has(r.geneId.trim()) ? { geneId: r.geneId.trim() } : { geneId: r.geneId.trim(), mutationScore: r.score })),
      });
      onAdded(form.id.trim());
    } catch (err) {
      setError(err.status === 409 ? 'This ID already exists. Choose another patient ID.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.addForm} onSubmit={submit} noValidate>
      <div className={styles.formGrid}>
        <Field id="np-id" label="Patient ID" hint="No spaces, commas or quotes" bad={form.id !== '' && !idOk}>
          <input id="np-id" aria-describedby="np-id-hint" aria-invalid={form.id !== '' && !idOk} className="input" value={form.id} onChange={set('id')} maxLength={40} autoComplete="off" />
        </Field>
        <Field id="np-name" label="Name" hint="No commas" bad={form.name !== '' && !nameOk}>
          <input id="np-name" aria-describedby="np-name-hint" aria-invalid={form.name !== '' && !nameOk} className="input" value={form.name} onChange={set('name')} autoComplete="off" />
        </Field>
        <Field id="np-age" label="Age" hint="0 to 120" bad={form.age !== '' && !ageOk}>
          <input id="np-age" aria-describedby="np-age-hint" aria-invalid={form.age !== '' && !ageOk} className="input" inputMode="numeric" value={form.age} onChange={set('age')} />
        </Field>
        <Field id="np-dx" label="Diagnosis (optional)">
          <select id="np-dx" className="input" value={form.diagnosis} onChange={set('diagnosis')}>
            <option value="">Unknown</option>
            <option value="1">Cancer</option>
            <option value="0">No cancer</option>
          </select>
        </Field>
      </div>
      <p className="small muted">
        A patient with a known diagnosis is also used for training, so the models retrain when you save.
      </p>

      <fieldset className={styles.geneRows}>
        <legend className="label">Genes</legend>
        <datalist id="known-genes">
          {(genes.data || []).slice(0, 2000).map((g) => (
            <option key={g.gene_id} value={g.gene_id} />
          ))}
        </datalist>
        {rows.map((r, i) => {
          const id = r.geneId.trim();
          const isKnown = known.has(id);
          return (
            <div key={r.id} className={styles.geneRow}>
              <label className="vh" htmlFor={`gene-${r.id}`}>
                Gene {i + 1} ID
              </label>
              <input
                id={`gene-${r.id}`}
                className="input mono"
                list="known-genes"
                placeholder="GENE_001 or a new ID"
                value={r.geneId}
                onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, geneId: e.target.value } : x)))}
              />
              {id && isKnown ? (
                <span className={styles.geneScore}>Stored score {known.get(id).toFixed(3)}</span>
              ) : (
                <label className={styles.geneScore}>
                  <span className="small">{id ? 'New gene, score' : 'Score'} {r.score.toFixed(2)}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={r.score}
                    disabled={!id}
                    onChange={(e) =>
                      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, score: Number(e.target.value) } : x)))
                    }
                    aria-label={`Mutation score for gene ${i + 1}`}
                  />
                </label>
              )}
              <button
                type="button"
                className="btn btn-quiet"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" className="btn" onClick={() => setRows((rs) => [...rs, newRow()])}>
          Add another gene
        </button>
      </fieldset>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={!ready || busy}>
        {busy ? 'Saving…' : 'Save patient'}
      </button>
    </form>
  );
}

function Field({ id, label, hint, bad, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className={bad ? styles.formError : 'muted small'}>
          {hint}
        </span>
      )}
    </div>
  );
}

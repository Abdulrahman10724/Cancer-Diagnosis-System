import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { api } from '../api/client';
import CountUp from '../components/CountUp';
import Segmented from '../components/Segmented';
import StationLayout from '../components/StationLayout';
import { Empty, ErrorState, Loading } from '../components/States';
import { Term } from '../components/Popover';
import { hashSteps } from '../lib/hash';
import useApi from '../lib/useApi';
import { useJourney } from '../state/Journey';
import styles from './Data.module.css';

const FILES = [
  { key: 'patientsCsv', title: 'Patients', file: 'patients.csv', header: 'Patient_ID,Name,Age,Diagnosis' },
  { key: 'genesCsv', title: 'Genes', file: 'genes.csv', header: 'Gene_ID,Mutation_Score' },
  { key: 'patientGenesCsv', title: 'Patient–gene links', file: 'patient_genes.csv', header: 'Patient_ID,Gene_ID' },
];
const MAX_BYTES = 5 * 1024 * 1024;

export default function Data() {
  const { journey, isDone, datasetLoaded } = useJourney();
  const [source, setSource] = useState('sample');
  const [loadedAt, setLoadedAt] = useState(0); // bumps after every successful load
  const loaded = isDone('data') && journey.dataset;

  const onLoaded = (status) => {
    datasetLoaded(status.dataset);
    setLoadedAt((n) => n + 1);
  };

  return (
    <StationLayout
      id="data"
      sentence="Choose a dataset. The server reads three CSV files and checks every line."
      todo="Load a dataset to continue."
      details={<HashDemo key={`hash-${loadedAt}-${journey.dataset}`} />}
    >
      <div className={styles.top}>
        <Segmented
          label="Dataset source"
          value={source}
          onChange={setSource}
          options={[
            { value: 'sample', label: 'Sample dataset' },
            { value: 'upload', label: 'Upload your own' },
            { value: 'saved', label: 'Saved uploads' },
          ]}
        />
      </div>

      <div className={styles.source}>
        {source === 'sample' && <SampleSource onLoaded={onLoaded} />}
        {source === 'upload' && <UploadSource onLoaded={onLoaded} />}
        {source === 'saved' && <SavedSource onLoaded={onLoaded} current={journey.dataset} />}
      </div>

      {loaded && <Loaded key={`${journey.dataset}-${loadedAt}`} />}
    </StationLayout>
  );
}

function useLoader(onLoaded) {
  const [state, setState] = useState({ busy: false, error: null });
  const run = async (fn) => {
    setState({ busy: true, error: null });
    try {
      const status = await fn();
      setState({ busy: false, error: null });
      onLoaded(status);
    } catch (error) {
      setState({ busy: false, error });
    }
  };
  return [state, run];
}

function Problems({ error }) {
  if (!error) return null;
  if (!error.problems?.length) return <ErrorState error={error} title="The dataset was not loaded" />;
  return (
    <div className={styles.problems} role="alert">
      <p className={styles.problemsTitle}>
        The dataset was not loaded.{' '}
        {error.problems.length >= 50
          ? 'There are 50 or more problems; the first ones are listed.'
          : `${error.problems.length === 1 ? '1 problem' : `${error.problems.length} problems`} to fix.`}{' '}
        The dataset that was active stays active.
      </p>
      <ul>
        {error.problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function SampleSource({ onLoaded }) {
  const [state, run] = useLoader(onLoaded);
  return (
    <div className={styles.option}>
      <p>
        400 made-up patients with 800 genes, written by <span className="mono">cds_datagen</span> with seed 42. Every
        patient has a known diagnosis, so the models can be tested.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={state.busy}
        onClick={() => run(() => api.selectDataset('default'))}
      >
        {state.busy ? 'Loading…' : 'Load dataset'}
      </button>
      <Problems error={state.error} />
    </div>
  );
}

function SavedSource({ onLoaded, current }) {
  const list = useApi((signal) => api.datasets({ signal }), []);
  const [state, run] = useLoader(onLoaded);
  const [choice, setChoice] = useState('');
  if (list.loading) return <Loading label="Reading saved datasets" />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const uploads = list.data.datasets.filter((d) => d.name !== 'default');
  if (!uploads.length)
    return (
      <Empty title="No uploads yet">
        <p>Upload your own dataset first; it is saved and listed here.</p>
      </Empty>
    );
  return (
    <form
      className={styles.option}
      onSubmit={(e) => {
        e.preventDefault();
        if (choice) run(() => api.selectDataset(choice));
      }}
    >
      <fieldset className={styles.saved}>
        <legend className="label">Saved uploads</legend>
        {uploads.map((d) => (
          <label key={d.name} className={styles.savedRow}>
            <input
              type="radio"
              name="saved"
              value={d.name}
              checked={choice === d.name}
              onChange={() => setChoice(d.name)}
              disabled={!d.valid}
            />
            <span className={styles.savedName}>{d.name}</span>
            <span className="muted small">
              {d.valid ? `${d.patientCount} patients, ${d.geneCount} genes` : 'files no longer valid'}
              {d.name === current ? ', in use' : ''}
            </span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="btn btn-primary" disabled={!choice || state.busy}>
        {state.busy ? 'Loading…' : 'Load dataset'}
      </button>
      <Problems error={state.error} />
    </form>
  );
}

function UploadSource({ onLoaded }) {
  const [name, setName] = useState('');
  const [files, setFiles] = useState({});
  const [state, run] = useLoader(onLoaded);
  const nameOk = /^[a-z0-9-]{1,40}$/.test(name) && name !== 'default';
  const total = Object.values(files).reduce((n, f) => n + f.size, 0);
  const tooBig = total > MAX_BYTES;
  const ready = nameOk && FILES.every((f) => files[f.key]) && !tooBig;

  const read = (key, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFiles((f) => ({ ...f, [key]: { name: file.name, size: file.size, text: String(reader.result) } }));
    reader.readAsText(file);
  };

  return (
    <form
      className={styles.option}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        run(() =>
          api.upload({
            name,
            patientsCsv: files.patientsCsv.text,
            genesCsv: files.genesCsv.text,
            patientGenesCsv: files.patientGenesCsv.text,
          }),
        );
      }}
    >
      <div className={styles.nameField}>
        <label htmlFor="ds-name" className="label">
          Dataset name
        </label>
        <input
          id="ds-name"
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={name !== '' && !nameOk}
          aria-describedby="ds-name-hint"
          placeholder="my-data"
          autoComplete="off"
        />
        <span id="ds-name-hint" className={name !== '' && !nameOk ? styles.bad : 'muted small'}>
          Lowercase letters, digits and “-”, up to 40 characters.
        </span>
      </div>

      <div className={styles.drops}>
        {FILES.map((f) => (
          <DropZone key={f.key} spec={f} file={files[f.key]} onFile={(file) => read(f.key, file)} />
        ))}
      </div>

      {tooBig && (
        <p className={styles.bad} role="alert">
          The three files add up to {(total / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={!ready || state.busy}>
        {state.busy ? 'Checking and loading…' : 'Load dataset'}
      </button>
      <Problems error={state.error} />
    </form>
  );
}

function DropZone({ spec, file, onFile }) {
  const [over, setOver] = useState(false);
  const rows = useMemo(() => (file ? file.text.split(/\r?\n/).filter(Boolean).slice(0, 6) : []), [file]);
  const id = `file-${spec.key}`;
  return (
    <div
      className={`${styles.drop} ${over ? styles.over : ''} ${file ? styles.filled : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      <p className={styles.dropTitle}>{spec.title}</p>
      <p className="muted small">
        Headers: <span className="mono">{spec.header}</span>
      </p>
      <label htmlFor={id} className={`btn ${styles.choose}`}>
        {file ? 'Choose another file' : `Choose ${spec.file}`}
      </label>
      <input id={id} type="file" accept=".csv,text/csv" className="vh" onChange={(e) => onFile(e.target.files[0])} />
      {file ? (
        <div className={styles.preview}>
          <p className="small">
            {file.name}, {(file.size / 1024).toFixed(1)} KB. First rows:
          </p>
          <pre className={styles.rows}>{rows.join('\n')}</pre>
        </div>
      ) : (
        <p className="muted small">or drop the file here</p>
      )}
    </div>
  );
}

function Loaded() {
  const status = useApi((signal) => api.status({ signal }), []);
  const patients = useApi((signal) => api.patients({ signal }), []);
  if (status.loading || patients.loading) return <Loading label="Reading the dataset" lines={4} />;
  if (status.error || patients.error)
    return <ErrorState error={status.error || patients.error} onRetry={() => (status.reload(), patients.reload())} />;
  const s = status.data;
  return (
    <div className={styles.loaded}>
      <p className={styles.summary} aria-live="polite">
        <strong>
          <CountUp value={s.patientCount} />
        </strong>{' '}
        patients, <strong>
          <CountUp value={s.geneCount} />
        </strong>{' '}
        genes, <strong>
          <CountUp value={s.modelsTrained ? 4 : 0} />
        </strong>{' '}
        models trained <span className="muted">on “{s.dataset}”</span>
      </p>
      <PatientTable rows={patients.data} />
    </div>
  );
}

const PAGE = 20;

function PatientTable({ rows }) {
  const [sort, setSort] = useState({ key: 'patient_id', dir: 1 });
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const val = (r) => (sort.key === 'diagnosis' ? (r.diagnosis === null ? -1 : r.diagnosis) : r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x < y) return -sort.dir;
      if (x > y) return sort.dir;
      return a.patient_id < b.patient_id ? -1 : 1;
    });
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const shown = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const header = (key, label) => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={styles.sortBtn}
          onClick={() => {
            setSort({ key, dir: active ? -sort.dir : 1 });
            setPage(0);
          }}
        >
          {label}
          <span aria-hidden="true" className={styles.arrow}>
            {active ? (sort.dir > 0 ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };
  return (
    <div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="vh">Patients, page {page + 1} of {pages}</caption>
          <thead>
            <tr>
              {header('patient_id', 'ID')}
              <th scope="col">Name</th>
              {header('age', 'Age')}
              {header('diagnosis', 'Diagnosis')}
              <th scope="col" className={styles.num}>
                Genes
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.patient_id}>
                <td className={styles.id}>{r.patient_id}</td>
                <td>{r.name}</td>
                <td>{r.age}</td>
                <td>
                  <Diagnosis value={r.diagnosis} />
                </td>
                <td className={styles.num}>{r.geneIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pager}>
        <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous page
        </button>
        <span className="muted small">
          Page {page + 1} of {pages} ({rows.length} patients)
        </span>
        <button type="button" className="btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          Next page
        </button>
      </div>
    </div>
  );
}

export function Diagnosis({ value }) {
  if (value === null || value === undefined) return <span className="muted">Unknown</span>;
  return (
    <span className={styles.dx}>
      <span className={value === 1 ? styles.dxCancer : styles.dxClear} aria-hidden="true" />
      {value === 1 ? 'Cancer' : 'No cancer'}
    </span>
  );
}

/* Hash table demo: the same hash as the C++ HashMapper, computed here with BigInt */
function HashDemo() {
  const reduce = useReducedMotion();
  const map = useApi((signal) => api.hashmap({ signal }), []);
  const [gene, setGene] = useState('GENE_001');
  const [asked, setAsked] = useState('');
  const result = useMemo(() => {
    if (!map.data || !asked) return null;
    const { steps, hash } = hashSteps(asked);
    const bucket = Number(hash % BigInt(map.data.bucketCount));
    const chain = map.data.buckets[bucket]?.items || [];
    const at = chain.findIndex((x) => x.key === asked);
    return { steps, hash, bucket, chain, at };
  }, [map.data, asked]);

  return (
    <details className={styles.details}>
      <summary className={styles.detailsSummary}>See how genes are found</summary>
      <div className={styles.detailsBody}>
        <p>
          Genes live in a <Term meaning="An array of buckets. A formula turns the key into a bucket number, so a lookup jumps straight there.">hash table</Term>.
          Type a gene ID: the browser runs the same formula as the C++ code and jumps to its bucket.
        </p>
        {map.loading && <Loading label="Reading the hash table" />}
        {map.error && <ErrorState error={map.error} onRetry={map.reload} />}
        {map.data && (
          <>
            <form
              className={styles.hashForm}
              onSubmit={(e) => {
                e.preventDefault();
                setAsked(gene.trim());
              }}
            >
              <label htmlFor="gene-id" className="label">
                Gene ID
              </label>
              <div className={styles.hashRow}>
                <input id="gene-id" className="input mono" value={gene} onChange={(e) => setGene(e.target.value)} />
                <button type="submit" className="btn btn-primary" disabled={!gene.trim()}>
                  Find this gene
                </button>
              </div>
              <p className="muted small">
                {map.data.size} genes in {map.data.bucketCount} buckets, {Math.round(map.data.loadFactor * 100)}% full.
              </p>
            </form>
            {result && (
              <div className={styles.hashResult} aria-live="polite">
                <p className={`mono ${styles.formula}`}>h = h × 31 + character code (unsigned 64-bit)</p>
                <ol className={styles.steps}>
                  {result.steps.map((s, i) => (
                    <motion.li
                      key={`${asked}-${i}`}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.15 }}
                    >
                      <span className="mono">‘{s.char}’ {s.code}</span>
                      <span className="mono">{s.h.toString()}</span>
                    </motion.li>
                  ))}
                </ol>
                <p className={`mono ${styles.formula}`}>
                  bucket = {result.hash.toString()} mod {map.data.bucketCount} = <strong>{result.bucket}</strong>
                </p>
                <BucketStrip count={map.data.bucketCount} target={result.bucket} buckets={map.data.buckets} />
                <div className={styles.chain}>
                  <p className="label">Bucket {result.bucket} holds:</p>
                  {result.chain.length === 0 ? (
                    <p className="muted">Nothing. “{asked}” is not a gene in this dataset (found in 1 step).</p>
                  ) : (
                    <ol className={styles.chainList}>
                      {result.chain.map((x, i) => (
                        <li key={x.key} className={i === result.at ? styles.hit : ''}>
                          <span className="mono">{x.key}</span> score {x.value}
                        </li>
                      ))}
                    </ol>
                  )}
                  {result.at >= 0 && (
                    <p className="small">
                      Found after {result.at + 1} {result.at === 0 ? 'step' : 'steps'}, without reading the other{' '}
                      {map.data.size - 1} genes.
                    </p>
                  )}
                  {result.chain.length > 0 && result.at < 0 && (
                    <p className="small muted">“{asked}” is not in this chain, so it is not in the dataset.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function BucketStrip({ count, target, buckets }) {
  const width = 25;
  const start = Math.max(0, Math.min(count - width, target - Math.floor(width / 2)));
  const cells = Array.from({ length: Math.min(width, count) }, (_, i) => start + i);
  return (
    <div className={styles.strip} role="img" aria-label={`Buckets ${start} to ${start + cells.length - 1}; bucket ${target} highlighted`}>
      {cells.map((b) => (
        <div key={b} className={`${styles.cell} ${b === target ? styles.cellOn : ''}`}>
          <span className={styles.cellDots}>
            {(buckets[b]?.items || []).map((x) => (
              <span key={x.key} className={styles.cellDot} />
            ))}
          </span>
          <span className={styles.cellNum}>{b}</span>
        </div>
      ))}
    </div>
  );
}

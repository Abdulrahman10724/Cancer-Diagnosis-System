import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import PatientPicker from '../../components/PatientPicker';
import { ErrorState, Loading } from '../../components/States';
import { Term } from '../../components/Popover';
import { pct } from '../../lib/format';
import { useJourney } from '../../state/Journey';
import styles from './Predict.module.css';

export default function WaitingRoom({ patients, patientId, setPatientId }) {
  const { toast } = useJourney();
  const [queue, setQueue] = useState(null);
  const [triage, setTriage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { queue: [...], triage: [...] }

  const refresh = useCallback(async () => {
    try {
      const [q, t] = await Promise.all([api.queue(), api.triage()]);
      setQueue(q);
      setTriage(t);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const addIds = async (ids) => {
    setBusy(true);
    setDone(null);
    const skipped = [];
    for (const id of ids) {
      try {
        await api.triagePush(id);
        await api.enqueue(id);
      } catch (e) {
        if (e.status === 409) skipped.push(id);
        else {
          toast(e.message, 'error');
          break;
        }
      }
    }
    if (skipped.length) toast(`${skipped.join(', ')} ${skipped.length === 1 ? 'is' : 'are'} already waiting.`);
    await refresh();
    setBusy(false);
  };

  const addRandom = () => {
    const list = patients.data || [];
    const waiting = new Set((queue?.patients || []).concat((triage?.sorted || []).map((t) => t.patient_id)));
    const pool = list.filter((p) => !waiting.has(p.patient_id));
    const picked = [];
    for (let i = 0; i < 5 && pool.length; i++) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].patient_id);
    addIds(picked);
  };

  const process = async () => {
    setBusy(true);
    try {
      const [q, t] = await Promise.all([api.processQueue('logistic'), api.triageProcess()]);
      setDone({ queue: q.results, triage: t.results });
      await refresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (patients.loading) return <Loading label="Reading patients" />;
  if (patients.error) return <ErrorState error={patients.error} onRetry={patients.reload} />;

  const waitingCount = queue ? queue.queueSize : 0;
  return (
    <div className={styles.waiting}>
      <p>
        Two ways to wait. A <Term meaning="First in, first out: whoever arrived first is seen first.">queue</Term> serves
        patients in arrival order. A <Term meaning="A heap keeps the most urgent patient on top, so it can always be taken out next in O(log n).">triage heap</Term>{' '}
        serves the highest risk first.
      </p>
      <div className={styles.pickRow}>
        <PatientPicker patients={patients.data} value={patientId} onChange={setPatientId} label="Patient" />
        <div className={styles.pickActions}>
          <button type="button" className="btn btn-primary" disabled={!patientId || busy} onClick={() => addIds([patientId])}>
            Add to both
          </button>
          <button type="button" className="btn" disabled={busy} onClick={addRandom}>
            Add 5 random patients
          </button>
          <button type="button" className="btn" disabled={busy || waitingCount === 0} onClick={process}>
            Process both
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={refresh} />}
      {!error && queue && triage && (
        <div className={styles.lanes}>
          <section className={styles.lane} aria-labelledby="lane-queue">
            <h3 id="lane-queue" className={styles.laneTitle}>
              <span className={styles.laneSwatch} style={{ background: 'var(--rail)' }} aria-hidden="true" />
              Queue <span className="muted">arrival order</span>
            </h3>
            {done ? (
              <Results items={done.queue.map((r) => ({ id: r.patient_id, name: r.name, risk: r.riskScore }))} note="Seen in arrival order (risk from logistic regression)." />
            ) : (
              <Lane items={queue.patients.map((id) => ({ id }))} empty="Nobody waiting." />
            )}
          </section>
          <section className={styles.lane} aria-labelledby="lane-triage">
            <h3 id="lane-triage" className={styles.laneTitle}>
              <span className={styles.laneSwatch} style={{ background: 'var(--line-heap)' }} aria-hidden="true" />
              Triage <span className="muted">highest risk first</span>
            </h3>
            {done ? (
              <Results items={done.triage.map((r) => ({ id: r.patient_id, name: r.name, risk: r.risk }))} note="Seen by average risk of the four models." />
            ) : (
              <>
                <Lane items={triage.sorted.map((t) => ({ id: t.patient_id, risk: t.risk }))} empty="Nobody waiting." />
                {triage.heap.length > 0 && <HeapTree heap={triage.heap} />}
              </>
            )}
          </section>
        </div>
      )}
      {done && (
        <button type="button" className="btn btn-quiet" onClick={() => setDone(null)}>
          Clear results
        </button>
      )}
    </div>
  );
}

function Lane({ items, empty }) {
  const reduce = useReducedMotion();
  if (!items.length) return <p className="muted small">{empty}</p>;
  return (
    <ol className={styles.laneList}>
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <motion.li
            key={it.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={styles.laneItem}
          >
            <span className={styles.laneRank}>{i + 1}</span>
            <strong>{it.id}</strong>
            {it.risk !== undefined && <span className="muted">{pct(it.risk)} risk</span>}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function Results({ items, note }) {
  return (
    <div>
      <p className="small muted">{note}</p>
      <ol className={styles.laneList}>
        {items.map((it, i) => (
          <li key={it.id} className={styles.laneItem}>
            <span className={styles.laneRank}>{i + 1}</span>
            <strong>{it.id}</strong>
            <span>{it.name}</span>
            <span className="muted">{pct(it.risk)} risk</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The heap array drawn as a binary tree: children of i are 2i+1 and 2i+2. */
function HeapTree({ heap }) {
  const n = Math.min(heap.length, 15);
  const levels = Math.ceil(Math.log2(n + 1));
  const W = 560;
  const rowH = 58;
  const pos = (i) => {
    const level = Math.floor(Math.log2(i + 1));
    const first = 2 ** level - 1;
    const count = 2 ** level;
    return { x: ((i - first + 0.5) / count) * W, y: 22 + level * rowH };
  };
  return (
    <div className={styles.heap}>
      <p className="small muted">
        The heap array as a tree{heap.length > n ? ` (first ${n} of ${heap.length})` : ''}: every parent has a higher risk than its
        children, so the top is always next.
      </p>
      <svg viewBox={`0 0 ${W} ${levels * rowH + 10}`} className={styles.heapSvg} role="img" aria-label="Heap array drawn as a tree">
        {Array.from({ length: n }, (_, i) => i)
          .filter((i) => i > 0)
          .map((i) => {
            const a = pos(Math.floor((i - 1) / 2));
            const b = pos(i);
            return <line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.heapEdge} />;
          })}
        {heap.slice(0, n).map((h, i) => {
          const p = pos(i);
          return (
            <g key={h.patient_id}>
              <rect x={p.x - 40} y={p.y - 16} width={80} height={32} rx={16} className={i === 0 ? styles.heapTop : styles.heapNode} />
              <text x={p.x} y={p.y - 1} textAnchor="middle" className={styles.heapId}>
                {h.patient_id}
              </text>
              <text x={p.x} y={p.y + 11} textAnchor="middle" className={styles.heapRisk}>
                {pct(h.risk)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import PatientPicker from '../../components/PatientPicker';
import { ErrorState, Loading } from '../../components/States';
import { Legend } from '../../components/Legend';
import { Term } from '../../components/Popover';
import { pct } from '../../lib/format';
import useApi from '../../lib/useApi';
import styles from './Predict.module.css';

const W = 900;
const H = 560;
const LEVEL_MS = 200;

export default function SimilarPatients({ patients, patientId, setPatientId }) {
  const [eps, setEps] = useState(0.6);
  const [epsQuery, setEpsQuery] = useState(0.6);
  useEffect(() => {
    const t = window.setTimeout(() => setEpsQuery(eps), 300);
    return () => window.clearTimeout(t);
  }, [eps]);
  const graph = useApi((signal) => api.graph(epsQuery, { signal }), [epsQuery]);

  return (
    <div className={styles.similar}>
      <p>
        Patients are linked when their four scaled numbers are within a distance{' '}
        <Term meaning="eps (epsilon): the largest distance at which two patients still count as similar.">eps</Term> of each
        other. Linked patients form groups. A{' '}
        <Term meaning="Breadth-first search: visit the start, then all its neighbours, then their neighbours, one ring at a time.">breadth-first search</Term>{' '}
        walks outward from one patient, ring by ring.
      </p>
      <div className={styles.graphControls}>
        <label className={styles.rangeLabel}>
          <span className="label">eps = {eps.toFixed(2)}</span>
          <input type="range" min={0.3} max={1} step={0.05} value={eps} onChange={(e) => setEps(Number(e.target.value))} />
        </label>
        {patients.data && (
          <PatientPicker patients={patients.data} value={patientId} onChange={setPatientId} label="Start the search at" />
        )}
      </div>
      {graph.loading && !graph.data && <Loading label="Building the graph" tall />}
      {graph.error && <ErrorState error={graph.error} onRetry={graph.reload} />}
      {graph.data && <Graph data={graph.data} start={patientId} onPick={setPatientId} stale={graph.loading} />}
    </div>
  );
}

function Graph({ data, start, onPick, stale }) {
  const reduce = useReducedMotion();
  const [group, setGroup] = useState(null);
  const [bfs, setBfs] = useState(null);
  const [level, setLevel] = useState(-1);
  const [bfsError, setBfsError] = useState(null);
  const timer = useRef(null);

  // Force layout, computed once per graph (linked patients pull together, groups drift apart)
  const layout = useMemo(() => {
    const nodes = data.nodes.map((n) => ({ id: n.id, diagnosis: n.diagnosis, component: n.component }));
    const links = data.edges.map((e) => ({ source: e.a, target: e.b }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.id).distance(12).strength(0.4))
      .force('charge', forceManyBody().strength(-14).distanceMax(120))
      .force('collide', forceCollide(5))
      .force('x', forceX(W / 2).strength(0.05))
      .force('y', forceY(H / 2).strength(0.08))
      .stop();
    for (let i = 0; i < 260; i++) sim.tick();
    const pad = 14;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sx = (W - 2 * pad) / Math.max(x1 - x0, 1);
    const sy = (H - 2 * pad) / Math.max(y1 - y0, 1);
    const s = Math.min(sx, sy);
    const at = {};
    nodes.forEach((n) => {
      at[n.id] = { x: pad + (n.x - x0) * s + (W - 2 * pad - (x1 - x0) * s) / 2, y: pad + (n.y - y0) * s + (H - 2 * pad - (y1 - y0) * s) / 2 };
    });
    return { at, nodes };
  }, [data]);

  // Run BFS when the start patient changes
  useEffect(() => {
    window.clearInterval(timer.current);
    setBfs(null);
    setLevel(-1);
    setBfsError(null);
    if (!start || !layout.at[start]) return undefined;
    let cancelled = false;
    api
      .bfs(start, data.eps)
      .then((r) => {
        if (cancelled) return;
        setBfs(r);
        if (reduce) {
          setLevel(r.levels);
          return;
        }
        setLevel(0);
        timer.current = window.setInterval(() => {
          setLevel((l) => {
            if (l + 1 >= r.levels) window.clearInterval(timer.current);
            return l + 1;
          });
        }, LEVEL_MS);
      })
      .catch((e) => !cancelled && setBfsError(e));
    return () => {
      cancelled = true;
      window.clearInterval(timer.current);
    };
  }, [start, data.eps, layout, reduce]);

  const levelOf = useMemo(() => {
    const m = {};
    (bfs?.order || []).forEach((v) => (m[v.id] = v.level));
    return m;
  }, [bfs]);

  const groups = data.components.list.filter((g) => g.size > 1).slice(0, 6);
  const reached = bfs ? bfs.order.filter((v) => v.level <= level).length : 0;
  const startComp = start ? data.nodes.find((n) => n.id === start)?.component : null;

  return (
    <div className={`${styles.graphLayout} ${stale ? styles.stale : ''}`}>
      <div className={styles.graphMain}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.graphSvg} role="img" aria-label={`Similarity graph: ${data.nodeCount} patients, ${data.edgeCount} links, ${data.components.count} groups.`}>
          <g className={styles.edges}>
            {data.edges.map((e) => {
              const a = layout.at[e.a];
              const b = layout.at[e.b];
              const lit = bfs && levelOf[e.a] !== undefined && levelOf[e.b] !== undefined && Math.max(levelOf[e.a], levelOf[e.b]) <= level;
              return <line key={`${e.a}-${e.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={lit ? styles.edgeLit : styles.edge} />;
            })}
          </g>
          {data.nodes.map((n) => {
            const p = layout.at[n.id];
            const l = levelOf[n.id];
            const lit = l !== undefined && l <= level;
            const dim = group !== null && n.component !== group;
            const cls = [
              styles.gnode,
              lit ? styles.gnodeLit : '',
              n.id === start ? styles.gnodeStart : '',
              n.diagnosis === 1 ? styles.gCancer : n.diagnosis === 0 ? styles.gClear : styles.gUnknown,
              dim ? styles.gDim : '',
              group !== null && n.component === group ? styles.gGroup : '',
            ].join(' ');
            return (
              <circle key={n.id} cx={p.x} cy={p.y} r={n.id === start ? 7 : 4.5} className={cls} onClick={() => onPick(n.id)}>
                <title>
                  {n.id}, {n.diagnosis === 1 ? 'cancer' : n.diagnosis === 0 ? 'no cancer' : 'unknown'}
                  {l !== undefined ? `, level ${l}` : ''}
                </title>
              </circle>
            );
          })}
        </svg>
        <Legend
          items={[
            { label: 'Cancer (dark ring)', swatch: <span className={styles.keyCancer} /> },
            { label: 'No cancer', swatch: <span className={styles.keyClear} /> },
            { label: 'Reached by the search', swatch: <span className={styles.keyLit} /> },
          ]}
        />
      </div>
      <aside className={styles.graphSide}>
        <p className={styles.graphStats}>
          {data.nodeCount} patients, {data.edgeCount} links, {data.components.count} groups ({data.components.isolated} patients
          alone). Edges found with a KD-tree radius search.
        </p>
        {bfsError && <ErrorState error={bfsError} />}
        {bfs ? (
          <p className={styles.bfsLine} aria-live="polite">
            From <strong>{bfs.start}</strong>: ring {Math.min(Math.max(level, 0), bfs.levels - 1)} of {bfs.levels - 1}, {reached} of {bfs.reached} reachable
            patients reached.
          </p>
        ) : (
          <p className="muted small">Pick a patient (or click a dot) to start a breadth-first search.</p>
        )}
        <h3 className={styles.sideTitle}>Largest groups</h3>
        <ul className={styles.groupList}>
          {groups.map((g, i) => (
            <li key={g.component}>
              <button
                type="button"
                className={`${styles.groupBtn} ${group === g.component ? styles.groupOn : ''}`}
                aria-pressed={group === g.component}
                onClick={() => setGroup(group === g.component ? null : g.component)}
              >
                <span className={styles.groupName}>
                  Group {i + 1}
                  {g.component === startComp ? ' (start is here)' : ''}
                </span>
                <span className="small">
                  {g.size} patients, {g.cancerRate === null ? 'no labels' : `${pct(g.cancerRate)} cancer`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

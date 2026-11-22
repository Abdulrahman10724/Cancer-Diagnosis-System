import { motion, useReducedMotion } from 'framer-motion';
import { scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import Segmented from '../components/Segmented';
import StationLayout from '../components/StationLayout';
import Tabs from '../components/Tabs';
import { ErrorState, Loading } from '../components/States';
import { Legend, DxSwatch } from '../components/Legend';
import { Term } from '../components/Popover';
import { FEATURES, MODELS } from '../lib/metro';
import { featureValue, num, pct } from '../lib/format';
import useApi from '../lib/useApi';
import { useJourney } from '../state/Journey';
import styles from './Train.module.css';

const featureName = (key) => FEATURES.find((f) => f.key === key)?.name || key;

export default function Train() {
  const { complete } = useJourney();
  const [tab, setTab] = useState('logistic');
  const [opened, setOpened] = useState(() => new Set(['logistic']));
  const stats = useApi((signal) => api.features({ signal }), []);

  const open = (id) => {
    setTab(id);
    setOpened((s) => new Set(s).add(id));
  };
  useEffect(() => {
    if (opened.size === MODELS.length) complete('train');
  }, [opened, complete]);

  const left = MODELS.length - opened.size;
  return (
    <StationLayout
      id="train"
      sentence="Four models learn from the training patients, each in its own way."
      todo={`Open all four model tabs to continue (${left} left).`}
    >
      <Tabs
        label="Models"
        value={tab}
        onChange={open}
        tabs={MODELS.map((m) => ({ id: m.key, label: m.key === 'knn' ? 'KNN + KD-tree' : m.name, done: opened.has(m.key) }))}
      >
        {tab === 'logistic' && <Logistic stats={stats} />}
        {tab === 'knn' && <Knn />}
        {tab === 'decision_tree' && <Tree />}
        {tab === 'naive_bayes' && <Bayes stats={stats} />}
      </Tabs>
    </StationLayout>
  );
}

/* Logistic regression: weight share per feature */
function Logistic({ stats }) {
  const reduce = useReducedMotion();
  if (stats.loading) return <Loading label="Reading the weights" />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;
  const rows = stats.data.features.map((f) => ({ key: f.name, value: f.importance.logistic }));
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className={styles.stack}>
      <p>
        Logistic regression gives each feature a <Term meaning="How much the model leans on that feature. Bigger means it moves the risk more.">weight</Term>,
        adds them up and squeezes the total into a risk between 0 and 1.
      </p>
      <p className={`mono ${styles.formula}`}>
        risk = σ(w₁·avgMutation + w₂·maxMutation + w₃·highRiskGenes + w₄·age + b)
      </p>
      <p className={styles.chartTitle}>Share of the total weight, per feature</p>
      <ul className={styles.bars}>
        {rows.map((r, i) => (
          <li key={r.key} className={styles.barRow}>
            <span className={styles.barName}>{featureName(r.key)}</span>
            <span className={styles.barTrack}>
              <motion.span
                className={styles.bar}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ delay: reduce ? 0 : i * 0.08, duration: 0.5, ease: [0.22, 0.8, 0.3, 1] }}
              />
            </span>
            <span className={styles.barValue}>{pct(r.value)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        σ (sigma) turns any number into 0 to 1. The weights were learned by gradient descent: 2,000 small steps that each
        make the training errors a little smaller.
      </p>
    </div>
  );
}

/* KNN: the KD-tree it searches, and K */
function Knn() {
  const { journey, setK } = useJourney();
  const tree = useApi((signal) => api.kdtree(4, { signal }), []);
  const [level, setLevel] = useState(null);
  return (
    <div className={styles.stack}>
      <p>
        KNN does not learn weights. It keeps the training patients in a{' '}
        <Term meaning="A tree that splits patients into boxes, one feature per level, so a search can skip boxes that are too far away.">KD-tree</Term>{' '}
        and, for a new patient, finds the K most similar ones; their diagnoses vote.
      </p>
      <div className={styles.kRow}>
        <label htmlFor="k" className="label">
          K = {journey.k}
        </label>
        <input
          id="k"
          type="range"
          min={1}
          max={15}
          step={2}
          value={journey.k}
          onChange={(e) => setK(Number(e.target.value))}
          className={styles.range}
          aria-describedby="k-hint"
        />
        <span id="k-hint" className="muted small">
          Used at Predict: each patient is compared with the {journey.k} nearest training {journey.k === 1 ? 'patient' : 'patients'}.
        </span>
      </div>
      {tree.loading && <Loading label="Reading the KD-tree" tall />}
      {tree.error && <ErrorState error={tree.error} onRetry={tree.reload} />}
      {tree.data && (
        <>
          <p className={styles.chartTitle} aria-live="polite">
            {level === null
              ? `The top 4 levels of the tree (${tree.data.points} patients, ${tree.data.height} levels in all). Point at a level.`
              : `Level ${level + 1} splits on ${featureName(FEATURES[level % 4].key).toLowerCase()}.`}
          </p>
          <KdDiagram root={tree.data.root} level={level} onLevel={setLevel} />
        </>
      )}
    </div>
  );
}

function KdDiagram({ root, level, onLevel }) {
  const depth = 4;
  const W = 1100;
  const rowH = 86;
  const boxH = 52;
  const nodes = [];
  const walk = (n, d, lo, hi, parent) => {
    if (!n || d >= depth) return;
    const x = (lo + hi) / 2;
    const y = 20 + d * rowH;
    nodes.push({ n, d, x, y, parent });
    walk(n.left, d + 1, lo, x, { x, y });
    walk(n.right, d + 1, x, hi, { x, y });
  };
  walk(root, 0, 0, W, null);
  const H = 20 + depth * rowH;
  return (
    <div className={styles.scrollX}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.kd} role="img" aria-label="KD-tree, top four levels">
        {[0, 1, 2, 3].map((d) => (
          <rect
            key={`band-${d}`}
            x={0}
            y={20 + d * rowH - 10}
            width={W}
            height={boxH + 20}
            rx={6}
            className={level === d ? styles.levelOn : styles.level}
            onMouseEnter={() => onLevel(d)}
            onMouseLeave={() => onLevel(null)}
          />
        ))}
        {nodes.map(({ x, y, parent }, i) =>
          parent ? <path key={`e-${i}`} d={`M${parent.x},${parent.y + boxH} L${x},${y}`} className={styles.edge} /> : null,
        )}
        {nodes.map(({ n, d, x, y }, i) => {
          const boxW = d < 2 ? 164 : d === 2 ? 144 : 126;
          return (
          <g
            key={`n-${i}`}
            onMouseEnter={() => onLevel(d)}
            onMouseLeave={() => onLevel(null)}
            onFocus={() => onLevel(d)}
            onBlur={() => onLevel(null)}
            tabIndex={0}
            className={styles.kdNode}
            aria-label={`Level ${d + 1}: ${featureName(n.feature)} at most ${featureValue(n.feature, n.splitRaw)}, ${n.size} patients`}
          >
            <rect x={x - boxW / 2} y={y} width={boxW} height={boxH} rx={6} className={styles.kdBox} />
            <text x={x} y={y + 21} textAnchor="middle" className={styles.kdFeature}>
              {n.feature} ≤ {featureValue(n.feature, n.splitRaw)}
            </text>
            <text x={x} y={y + 40} textAnchor="middle" className={styles.kdSize}>
              {n.size} patients
            </text>
          </g>
          );
        })}
      </svg>
    </div>
  );
}

/* Decision tree: collapsible questions */
function Tree() {
  const tree = useApi((signal) => api.tree({ signal }), []);
  if (tree.loading) return <Loading label="Reading the decision tree" tall />;
  if (tree.error) return <ErrorState error={tree.error} onRetry={tree.reload} />;
  return (
    <div className={styles.stack}>
      <p>
        The tree asks yes/no questions about the features. Each question is the split that best separates cancer from no
        cancer, measured with{' '}
        <Term meaning="A score of how mixed a group is: 0 when everyone has the same diagnosis, 0.5 when it is half and half.">Gini impurity</Term>.
      </p>
      <p className="muted small">
        Splits are found with merge sort + prefix sums: each feature is sorted once, then running counts score every possible
        split in one pass. {tree.data.nodeCount} nodes, depth {tree.data.depth}.
      </p>
      <ul className={styles.tree}>
        <TreeNode node={tree.data.root} depth={0} />
      </ul>
    </div>
  );
}

function TreeNode({ node, depth, answer }) {
  const [open, setOpen] = useState(depth < 2);
  const leaf = node.feature === null;
  const cancerShare = node.positiveFraction;
  const head = (
    <span className={styles.nodeHead}>
      {answer && <span className={styles.answer}>{answer}</span>}
      {leaf ? (
        <span>
          Says <strong>{node.prediction === 1 ? 'cancer' : 'no cancer'}</strong>
        </span>
      ) : (
        <span className={styles.question}>
          {featureName(node.feature)} ≤ {featureValue(node.feature, node.thresholdRaw)}?
        </span>
      )}
      <span className={styles.nodeMeta}>
        {node.samples} patients, {pct(cancerShare)} cancer
        <span className={styles.mini} aria-hidden="true">
          <span style={{ width: `${cancerShare * 100}%` }} />
        </span>
      </span>
    </span>
  );
  return (
    <li className={styles.node}>
      {leaf ? (
        <div className={styles.leaf}>{head}</div>
      ) : (
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className={styles.chev} aria-hidden="true">
            {open ? '−' : '+'}
          </span>
          {head}
        </button>
      )}
      {!leaf && open && (
        <ul className={styles.children}>
          <TreeNode node={node.left} depth={depth + 1} answer="Yes" />
          <TreeNode node={node.right} depth={depth + 1} answer="No" />
        </ul>
      )}
    </li>
  );
}

/* Naive Bayes: one bell curve per class and feature */
function Bayes({ stats }) {
  const reduce = useReducedMotion();
  const [feature, setFeature] = useState('avgMutation');
  const curves = useMemo(() => {
    if (!stats.data) return null;
    const f = stats.data.features.find((x) => x.name === feature);
    const lo = f.overall.min;
    const hi = f.overall.max;
    const pad = (hi - lo) * 0.1;
    const xs = Array.from({ length: 121 }, (_, i) => lo - pad + ((hi - lo + 2 * pad) * i) / 120);
    const pdf = (m, s) => (x) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
    const c = pdf(f.cancer.mean, Math.max(f.cancer.std, 1e-6));
    const n = pdf(f.noCancer.mean, Math.max(f.noCancer.std, 1e-6));
    return { f, xs, cancer: xs.map((x) => [x, c(x)]), clear: xs.map((x) => [x, n(x)]), domain: [lo - pad, hi + pad] };
  }, [stats.data, feature]);

  if (stats.loading) return <Loading label="Reading the class statistics" />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;

  const W = 1000;
  const H = 300;
  const m = { l: 20, r: 20, t: 16, b: 44 };
  const x = scaleLinear().domain(curves.domain).range([m.l, W - m.r]);
  const yMax = Math.max(...curves.cancer.map((p) => p[1]), ...curves.clear.map((p) => p[1]));
  const y = scaleLinear().domain([0, yMax * 1.08]).range([H - m.b, m.t]);
  const ln = line().x((d) => x(d[0])).y((d) => y(d[1]));
  const ar = area().x((d) => x(d[0])).y0(H - m.b).y1((d) => y(d[1]));
  const ticks = x.ticks(6);
  const f = curves.f;
  return (
    <div className={styles.stack}>
      <p>
        Naive Bayes learns, for each group, the typical value of every feature and how much it varies. A new patient gets the
        group whose curves fit them better, feature by feature.
      </p>
      <div className={styles.controls}>
        <Segmented
          label="Feature"
          size="sm"
          value={feature}
          onChange={setFeature}
          options={FEATURES.map((x2) => ({ value: x2.key, label: x2.name }))}
        />
        <Legend
          items={[
            { label: `Cancer: mean ${featureValue(feature, f.cancer.mean)}, spread ${num(f.cancer.std, 2)}`, swatch: <DxSwatch cancer /> },
            { label: `No cancer: mean ${featureValue(feature, f.noCancer.mean)}, spread ${num(f.noCancer.std, 2)}`, swatch: <DxSwatch /> },
          ]}
        />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.bell} role="img" aria-label={`Bell curves of ${featureName(feature)} for cancer and no-cancer patients`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={H - m.b} y2={H - m.b + 6} className={styles.axis} />
            <text x={x(t)} y={H - m.b + 22} textAnchor="middle" className={styles.tick}>
              {featureValue(feature, t)}
            </text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className={styles.axis} />
        <motion.path key={`a1-${feature}`} d={ar(curves.clear)} className={styles.areaClear} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
        <motion.path key={`a2-${feature}`} d={ar(curves.cancer)} className={styles.areaCancer} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
        <motion.path key={`l1-${feature}`} d={ln(curves.clear)} className={styles.lineClear} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
        <motion.path key={`l2-${feature}`} d={ln(curves.cancer)} className={styles.lineCancer} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
        <text x={m.l} y={H - 4} className={styles.axisTitle}>
          {featureName(feature)}
        </text>
      </svg>
      <p className="muted small">
        Where the dark curve is higher, a value points to cancer. “Naive” because each feature is treated on its own, as if the
        four were unrelated.
      </p>
    </div>
  );
}

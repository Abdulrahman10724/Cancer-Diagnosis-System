import { scaleLinear } from 'd3-scale';
import { fixed, pct, score } from '../lib/format';
import { OutcomeTag } from './Lane';
import styles from './Explain.module.css';

const W = 480;

function Verdict({ risk, prediction }) {
  return (
    <div className={styles.verdict}>
      <span className={styles.verdictRisk}>{pct(risk)} risk</span>
      <OutcomeTag prediction={prediction} />
    </div>
  );
}

function Axis({ x, y, ticks, label, format = (t) => t }) {
  return (
    <g aria-hidden="true">
      <line x1={x.range()[0]} x2={x.range()[1]} y1={y} y2={y} className={styles.axis} />
      {ticks.map((t) => (
        <g key={t} transform={`translate(${x(t)},${y})`}>
          <line y2="4" className={styles.axis} />
          <text y="16" textAnchor="middle" className={styles.tick}>
            {format(t)}
          </text>
        </g>
      ))}
      <text x={x.range()[1]} y={y + 32} textAnchor="end" className={styles.axisLabel}>
        {label}
      </text>
    </g>
  );
}

/* K-nearest neighbors: training genes on a score strip, the K nearest joined to the patient */
function KnnExplain({ data, genes }) {
  const m = data.models.knn;
  const { neighbors, votesCancer, votesSafe } = m.explain;
  const x = scaleLinear().domain([0, 1]).range([16, W - 16]);
  const px = x(data.featureRaw);
  const isNeighbor = (g) => neighbors.some((n) => n.gene_id === g.gene_id && Math.abs(n.mutation_score - g.mutation_score) < 1e-6);
  // Deterministic vertical jitter so dots do not sit on one line
  const jitter = (i) => 34 + ((i * 37) % 41);

  return (
    <>
      <p className={styles.summary}>
        The {m.k} training genes closest to this patient&apos;s mean score of{' '}
        {score(data.featureRaw)} vote {votesCancer} to {votesSafe} for cancerous.
      </p>
      <Verdict risk={m.risk} prediction={m.prediction} />
      <figure className={styles.figure}>
        <svg viewBox={`0 0 ${W} 150`} role="img" aria-label={`Mutation scores of ${genes.length} training genes with the ${m.k} nearest neighbors highlighted`}>
          {genes.map((g, i) =>
            isNeighbor(g) ? null : (
              <circle
                key={`${g.gene_id}-${i}`}
                cx={x(g.mutation_score)}
                cy={jitter(i)}
                r="2.5"
                className={g.label === 1 ? styles.dotRisk : styles.dotSafe}
              />
            ),
          )}
          {neighbors.map((n, i) => (
            <line key={`l${i}`} x1={px} y1={96} x2={x(n.mutation_score)} y2={20 + i * 3} className={styles.link} />
          ))}
          {neighbors.map((n, i) => (
            <circle
              key={`n${i}`}
              cx={x(n.mutation_score)}
              cy={20 + i * 3}
              r="5"
              className={`${n.label === 1 ? styles.dotRisk : styles.dotSafe} ${styles.neighbor}`}
            />
          ))}
          <line x1={px} x2={px} y1={12} y2={104} className={styles.patientLine} />
          <circle cx={px} cy={96} r="5" className={styles.patientDot} />
          <Axis x={x} y={110} ticks={[0, 0.25, 0.5, 0.75, 1]} label="Mutation score" />
        </svg>
        <figcaption className={styles.legend}>
          <span><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" className={styles.dotSafe} /></svg> Non-cancerous gene</span>
          <span><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" className={styles.dotRisk} /></svg> Cancerous gene</span>
          <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" className={`${styles.dotSafe} ${styles.neighbor}`} /></svg> Nearest neighbor</span>
          <span><svg width="10" height="12" aria-hidden="true"><line x1="5" x2="5" y1="0" y2="12" className={styles.patientLine} /></svg> This patient</span>
        </figcaption>
      </figure>
      <p className={styles.result}>
        {votesCancer} cancerous, {votesSafe} safe → {pct(m.risk)}
      </p>
      <table className={styles.table}>
        <caption className="visually-hidden">Nearest neighbors</caption>
        <thead>
          <tr>
            <th scope="col">Gene</th>
            <th scope="col">Score</th>
            <th scope="col">Label</th>
            <th scope="col">Distance</th>
          </tr>
        </thead>
        <tbody>
          {neighbors.map((n, i) => (
            <tr key={i}>
              <td>{n.gene_id}</td>
              <td>{score(n.mutation_score)}</td>
              <td>{n.label === 1 ? 'Cancerous' : 'Non-cancerous'}</td>
              <td>{fixed(n.distance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Distance is measured on the scaled score, the space the model works in.</p>
    </>
  );
}

/* Decision tree: the path of yes/no questions and the leaf it ends in */
function TreeExplain({ data }) {
  const m = data.models.decision_tree;
  const { path, leafPositiveFraction, leafSamples } = m.explain;
  return (
    <>
      <p className={styles.summary}>
        The tree asks {path.length} {path.length === 1 ? 'question' : 'questions'} about the mean
        score ({fixed(data.featureRaw)}) and ends in a leaf where {pct(leafPositiveFraction)} of
        the training genes were cancerous.
      </p>
      <Verdict risk={m.risk} prediction={m.prediction} />
      <ol className={styles.path}>
        {path.map((step, i) => (
          <li key={i} className={styles.step}>
            <span>
              Is the score ≤ {fixed(step.threshold)}?{' '}
              <strong>{step.wentLeft ? 'Yes, go left' : 'No, go right'}</strong>
            </span>
            <span className="hint">{step.samples} training genes reach this question</span>
          </li>
        ))}
        <li className={`${styles.step} ${styles.leaf}`}>
          <span>
            Leaf: {pct(leafPositiveFraction)} of {leafSamples} training{' '}
            {leafSamples === 1 ? 'gene' : 'genes'} here were cancerous.
          </span>
        </li>
      </ol>
      {leafSamples < 5 && (
        <p className="hint">
          A leaf with few genes gives a sharp but fragile answer: one more gene could change it.
        </p>
      )}
    </>
  );
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/* Logistic regression: the formula with real numbers and the sigmoid curve */
function LogisticExplain({ data }) {
  const m = data.models.logistic;
  const { weight, bias, z } = m.explain;
  const xs = data.featureScaled;
  const x = scaleLinear().domain([-3, 3]).range([40, W - 16]);
  const y = scaleLinear().domain([0, 1]).range([130, 16]);
  const points = [];
  for (let v = -3; v <= 3.0001; v += 0.1) points.push(`${x(v)},${y(sigmoid(weight * v + bias))}`);
  const clampedX = Math.max(-3, Math.min(3, xs));

  return (
    <>
      <p className={styles.summary}>
        A weighted sum of the patient&apos;s scaled score gives z = {fixed(z)}, and the sigmoid
        turns z into a {pct(m.risk)} risk.
      </p>
      <Verdict risk={m.risk} prediction={m.prediction} />
      <div className={styles.formula}>
        <p>
          x = ({fixed(data.featureRaw)} − {fixed(data.scale.mean)}) ÷ {fixed(data.scale.std)} ={' '}
          {fixed(xs)}
        </p>
        <p>
          z = {fixed(weight)} × {fixed(xs)} {bias < 0 ? '−' : '+'} {fixed(Math.abs(bias))} ={' '}
          {fixed(z)}
        </p>
        <p>σ(z) = 1 ÷ (1 + e^−z) = {fixed(m.risk)}</p>
      </div>
      <figure className={styles.figure}>
        <svg viewBox={`0 0 ${W} 180`} role="img" aria-label={`Sigmoid curve with the patient at x ${fixed(xs, 2)}, risk ${pct(m.risk)}`}>
          <line x1={x(-3)} x2={x(3)} y1={y(0.5)} y2={y(0.5)} className={styles.thresholdLine} />
          <text x={x(-3)} y={y(0.5) - 6} className={styles.tick}>Threshold 0.5</text>
          <polyline points={points.join(' ')} className={styles.curve} />
          <line x1={x(clampedX)} x2={x(clampedX)} y1={y(0)} y2={y(m.risk)} className={styles.patientLine} />
          <circle cx={x(clampedX)} cy={y(m.risk)} r="5" className={styles.patientDot} />
          <Axis x={x} y={136} ticks={[-3, -2, -1, 0, 1, 2, 3]} label="Scaled score (x)" />
        </svg>
      </figure>
    </>
  );
}

const gaussian = (v, mean, std) => Math.exp(-0.5 * ((v - mean) / std) ** 2) / (std * Math.sqrt(2 * Math.PI));

/* Naive Bayes: one bell curve per class and where the patient falls */
function BayesExplain({ data }) {
  const m = data.models.naive_bayes;
  const { safe, cancer } = m.explain;
  const xs = data.featureScaled;
  const x = scaleLinear().domain([-3, 3]).range([16, W - 16]);
  const peak = Math.max(gaussian(safe.mean, safe.mean, safe.std), gaussian(cancer.mean, cancer.mean, cancer.std));
  const y = scaleLinear().domain([0, peak]).range([130, 20]);
  const curve = (c) => {
    const pts = [];
    for (let v = -3; v <= 3.0001; v += 0.05) pts.push(`${x(v)},${y(gaussian(v, c.mean, c.std))}`);
    return pts.join(' ');
  };
  const safeHere = safe.prior * gaussian(xs, safe.mean, safe.std);
  const cancerHere = cancer.prior * gaussian(xs, cancer.mean, cancer.std);
  const higher = cancerHere >= safeHere ? 'cancerous' : 'non-cancerous';
  const clampedX = Math.max(-3, Math.min(3, xs));

  return (
    <>
      <p className={styles.summary}>
        At this patient&apos;s scaled score ({fixed(xs, 2)}) the {higher} curve is higher once each
        class is weighted by how common it is, so the model gives a {pct(m.risk)} risk.
      </p>
      <Verdict risk={m.risk} prediction={m.prediction} />
      <figure className={styles.figure}>
        <svg viewBox={`0 0 ${W} 180`} role="img" aria-label="Bell curves of scaled scores for non-cancerous and cancerous training genes, with the patient's score marked">
          <polyline points={curve(safe)} className={`${styles.curve} ${styles.curveSafe}`} />
          <polyline points={curve(cancer)} className={`${styles.curve} ${styles.curveRisk}`} />
          <text x={x(Math.max(-2.8, safe.mean)) } y={y(gaussian(safe.mean, safe.mean, safe.std)) - 6} textAnchor="middle" className={styles.curveLabel}>Non-cancerous</text>
          <text x={x(Math.min(2.8, cancer.mean))} y={y(gaussian(cancer.mean, cancer.mean, cancer.std)) - 6} textAnchor="middle" className={styles.curveLabel}>Cancerous</text>
          <line x1={x(clampedX)} x2={x(clampedX)} y1={y(0)} y2={16} className={styles.patientLine} />
          <Axis x={x} y={136} ticks={[-3, -2, -1, 0, 1, 2, 3]} label="Scaled score" />
        </svg>
      </figure>
      <table className={styles.table}>
        <caption className="visually-hidden">Class statistics</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Mean</th>
            <th scope="col">Spread (sd)</th>
            <th scope="col">Prior</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Non-cancerous</td>
            <td>{fixed(safe.mean, 2)}</td>
            <td>{fixed(safe.std, 2)}</td>
            <td>{fixed(safe.prior, 2)}</td>
          </tr>
          <tr>
            <td>Cancerous</td>
            <td>{fixed(cancer.mean, 2)}</td>
            <td>{fixed(cancer.std, 2)}</td>
            <td>{fixed(cancer.prior, 2)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

export default function Explain({ model, data, genes }) {
  if (model === 'knn') return <KnnExplain data={data} genes={genes} />;
  if (model === 'decision_tree') return <TreeExplain data={data} />;
  if (model === 'logistic') return <LogisticExplain data={data} />;
  return <BayesExplain data={data} />;
}

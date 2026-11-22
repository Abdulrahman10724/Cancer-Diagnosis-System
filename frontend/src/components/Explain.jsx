import { useEffect, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { scaleLinear } from 'd3-scale';
import { fixed, pct0, plural, score } from '../lib/format';
import { RiskBadge } from './Risk';
import styles from './Explain.module.css';

const W = 520;

function Verdict({ name, risk }) {
  return (
    <div className={styles.verdict}>
      <RiskBadge risk={risk} />
      <span>
        {name} thinks there is a <strong>{pct0(risk)}</strong> chance of cancer.
      </span>
    </div>
  );
}

function ScoreAxis({ x, y, label = 'Average gene score (0 = normal, 1 = highly mutated)' }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g aria-hidden="true">
      <line x1={x(0)} x2={x(1)} y1={y} y2={y} className={styles.axis} />
      {ticks.map((t) => (
        <g key={t} transform={`translate(${x(t)},${y})`}>
          <line y2="5" className={styles.axis} />
          <text y="18" textAnchor="middle" className={styles.tick}>
            {t}
          </text>
        </g>
      ))}
      {label && (
        <text x={x(0)} y={y + 36} className={styles.axisLabel}>
          {label}
        </text>
      )}
    </g>
  );
}

/* KNN: where the patient sits among all training genes, then the K nearest genes vote */
function KnnExplain({ data, genes }) {
  const reduceMotion = useReducedMotion();
  const m = data.models.knn;
  const { neighbors, votesCancer, votesSafe } = m.explain;
  const x = scaleLinear().domain([0, 1]).range([20, W - 20]);
  const px = x(data.featureRaw);
  const jitter = (i) => 18 + ((i * 37) % 44);
  // Voter cards spread evenly in a row under the strip
  const slot = (W - 40) / neighbors.length;
  const cardW = Math.min(96, slot - 8);
  const cardX = (i) => 20 + slot * i + (slot - cardW) / 2;
  const cardY = 170;

  return (
    <>
      <p className={styles.lead}>
        We found the {plural(m.k, 'most similar gene', 'most similar genes')}.{' '}
        {votesCancer} {votesCancer === 1 ? 'was a cancer gene' : 'were cancer genes'},{' '}
        {votesSafe} {votesSafe === 1 ? 'was' : 'were'} not → {pct0(m.risk)}.
      </p>
      <Verdict name="KNN" risk={m.risk} />
      <figure className={styles.figure}>
        <svg viewBox={`0 0 ${W} 228`} role="img" aria-label={`${genes.length} training genes on a 0 to 1 score line. The patient is at ${score(data.featureRaw)}. The ${m.k} closest genes: ${votesCancer} cancer, ${votesSafe} normal.`}>
          {genes.map((g, i) => (
            <circle
              key={`${g.gene_id}-${i}`}
              cx={x(g.mutation_score)}
              cy={jitter(i)}
              r="3"
              className={g.label === 1 ? styles.dotCancer : styles.dotNormal}
            />
          ))}
          <ScoreAxis x={x} y={76} label="" />
          {neighbors.map((n, i) => (
            <motion.line
              key={`l${i}`}
              x1={px}
              y1={100}
              x2={cardX(i) + cardW / 2}
              y2={cardY}
              className={styles.link}
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.6 + i * 0.2, duration: 0.25 }}
            />
          ))}
          {neighbors.map((n, i) => (
            <motion.g
              key={`c${i}`}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.75 + i * 0.2 }}
            >
              <rect
                x={cardX(i)}
                y={cardY}
                width={cardW}
                height={50}
                rx="8"
                className={n.label === 1 ? styles.voteCancer : styles.voteNormal}
              />
              <text x={cardX(i) + cardW / 2} y={cardY + 20} textAnchor="middle" className={styles.voteWord}>
                {n.label === 1 ? 'Cancer' : 'Normal'}
              </text>
              <text x={cardX(i) + cardW / 2} y={cardY + 38} textAnchor="middle" className={styles.tick}>
                {score(n.mutation_score)}
              </text>
            </motion.g>
          ))}
          <motion.g
            initial={reduceMotion ? false : { y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          >
            <line x1={px} x2={px} y1={8} y2={100} className={styles.patientLine} />
            <circle cx={px} cy={76} r="7" className={styles.patientDot} />
            <circle cx={px} cy={100} r="3" className={styles.patientDot} />
          </motion.g>
        </svg>
        <figcaption className={styles.legend}>
          <span>Top: the score of every training gene (0 = normal, 1 = highly mutated). Bottom: the {m.k} closest genes and their vote.</span>
          <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" className={styles.dotCancer} /></svg> Cancer gene (filled)</span>
          <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" className={styles.dotNormal} /></svg> Normal gene (ring)</span>
          <span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" className={styles.patientDot} /></svg> This patient ({score(data.featureRaw)})</span>
        </figcaption>
      </figure>
      <details className={styles.math}>
        <summary>Show the numbers</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Gene</th>
              <th scope="col">Score</th>
              <th scope="col">Cancer gene?</th>
            </tr>
          </thead>
          <tbody>
            {neighbors.map((n, i) => (
              <tr key={i}>
                <td>{n.gene_id}</td>
                <td>{score(n.mutation_score)}</td>
                <td>{n.label === 1 ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Chance = cancer genes ÷ K = {votesCancer} ÷ {m.k} = {pct0(m.risk)}.
        </p>
      </details>
    </>
  );
}

/* Decision tree: yes/no questions appear one after another */
function TreeExplain({ data }) {
  const reduceMotion = useReducedMotion();
  const m = data.models.decision_tree;
  const { path, leafPositiveFraction, leafSamples } = m.explain;
  const step = Math.min(0.3, 1.6 / Math.max(1, path.length));
  return (
    <>
      <p className={styles.lead}>
        The tree asks yes/no questions about the patient&apos;s average gene score (
        {score(data.featureRaw)}), like a flowchart, until it reaches an answer.
      </p>
      <Verdict name="The decision tree" risk={m.risk} />
      <ol className={styles.path}>
        {path.map((s, i) => {
          const above = !s.wentLeft;
          return (
            <motion.li
              key={i}
              className={styles.step}
              initial={reduceMotion ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduceMotion ? 0 : i * step }}
            >
              <span className={styles.question}>Is the score above {fixed(s.threshold, 3)}?</span>
              <span className={above ? styles.yes : styles.no}>{above ? 'Yes' : 'No'}</span>
            </motion.li>
          );
        })}
        <motion.li
          className={`${styles.step} ${styles.leaf}`}
          initial={reduceMotion ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : path.length * step }}
        >
          {pct0(leafPositiveFraction)} of the {plural(leafSamples, 'similar training gene')} here were
          cancer genes → {pct0(m.risk)}.
        </motion.li>
      </ol>
      {leafSamples < 5 && (
        <p className="hint">
          Only {plural(leafSamples, 'gene')} ended up here, so this answer could change with a little
          more data.
        </p>
      )}
    </>
  );
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/* Logistic regression: draw the S-curve, then move the patient's point along it */
function LogisticExplain({ data }) {
  const reduceMotion = useReducedMotion();
  const m = data.models.logistic;
  const { weight, bias, z } = m.explain;
  const { mean, std } = data.scale;
  const chanceAt = (raw) => sigmoid(weight * ((raw - mean) / std) + bias);
  const x = scaleLinear().domain([0, 1]).range([40, W - 20]);
  const y = scaleLinear().domain([0, 1]).range([140, 16]);
  const pts = [];
  for (let v = 0; v <= 1.0001; v += 0.02) pts.push(`${x(v)},${y(chanceAt(v))}`);
  const target = Math.max(0, Math.min(1, data.featureRaw));
  const [t, setT] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      setT(target);
      return undefined;
    }
    const controls = animate(0, target, { delay: 0.8, duration: 0.9, ease: 'easeInOut', onUpdate: setT });
    return () => controls.stop();
  }, [target, reduceMotion]);

  return (
    <>
      <p className={styles.lead}>
        The model turns the score into a chance using an S-shaped curve. Low scores give a small
        chance, high scores a big one.
      </p>
      <Verdict name="Logistic Regression" risk={m.risk} />
      <figure className={styles.figure}>
        <svg viewBox={`0 0 ${W} 190`} role="img" aria-label={`S-shaped curve. At the patient's score ${score(data.featureRaw)} the chance is ${pct0(m.risk)}.`}>
          <line x1={x(0)} x2={x(1)} y1={y(0.5)} y2={y(0.5)} className={styles.cancerLine} />
          <text x={x(0) + 4} y={y(0.5) - 6} className={styles.tick}>Cancer line 50%</text>
          <text x={4} y={y(1) + 4} className={styles.tick}>100%</text>
          <text x={12} y={y(0) + 4} className={styles.tick}>0%</text>
          <motion.polyline
            points={pts.join(' ')}
            className={styles.curve}
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(chanceAt(t))} className={styles.patientLine} />
          <circle cx={x(t)} cy={y(chanceAt(t))} r="7" className={styles.patientDot} />
          <ScoreAxis x={x} y={148} />
        </svg>
      </figure>
      <details className={styles.math}>
        <summary>Show the math</summary>
        <div className={styles.formula}>
          <p>1. Scale the score: x = ({fixed(data.featureRaw)} − {fixed(mean)}) ÷ {fixed(std)} = {fixed(data.featureScaled)}</p>
          <p>2. Weighted sum: z = {fixed(weight)} × {fixed(data.featureScaled)} {bias < 0 ? '−' : '+'} {fixed(Math.abs(bias))} = {fixed(z)}</p>
          <p>3. S-curve: chance = 1 ÷ (1 + e^−z) = {fixed(m.risk)} = {pct0(m.risk)}</p>
        </div>
      </details>
    </>
  );
}

const gaussian = (v, mu, sd) => Math.exp(-0.5 * ((v - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

/* Naive Bayes: two hills, the patient's line slides in */
function BayesExplain({ data }) {
  const reduceMotion = useReducedMotion();
  const m = data.models.naive_bayes;
  const { safe, cancer } = m.explain;
  const { mean, std } = data.scale;
  // Convert the model's scaled statistics back to the 0-1 score scale
  const normal = { mu: safe.mean * std + mean, sd: safe.std * std, prior: safe.prior };
  const sick = { mu: cancer.mean * std + mean, sd: cancer.std * std, prior: cancer.prior };
  const hill = (c, v) => c.prior * gaussian(v, c.mu, c.sd);
  const x = scaleLinear().domain([0, 1]).range([20, W - 20]);
  let peak = 0;
  for (let v = 0; v <= 1; v += 0.01) peak = Math.max(peak, hill(normal, v), hill(sick, v));
  const y = scaleLinear().domain([0, peak]).range([140, 24]);
  const line = (c) => {
    const pts = [];
    for (let v = 0; v <= 1.0001; v += 0.01) pts.push(`${x(v)},${y(hill(c, v))}`);
    return pts.join(' ');
  };
  const raw = Math.max(0, Math.min(1, data.featureRaw));
  const underCancer = hill(sick, raw) >= hill(normal, raw);

  return (
    <>
      <p className={styles.lead}>
        Normal genes and cancer genes usually score differently. Each hill shows where one group
        usually sits. The patient sits more under the {underCancer ? 'cancer' : 'normal'} hill →{' '}
        {pct0(m.risk)}.
      </p>
      <Verdict name="Naive Bayes" risk={m.risk} />
      <figure className={styles.figure}>
        <svg viewBox={`0 0 ${W} 190`} role="img" aria-label={`Two hills: normal genes centred at ${score(normal.mu)}, cancer genes at ${score(sick.mu)}. The patient is at ${score(raw)}.`}>
          <motion.polyline
            points={line(normal)}
            className={`${styles.curve} ${styles.curveNormal}`}
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6 }}
          />
          <motion.polyline
            points={line(sick)}
            className={`${styles.curve} ${styles.curveCancer}`}
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.2 }}
          />
          <text x={x(normal.mu)} y={y(hill(normal, normal.mu)) - 8} textAnchor="middle" className={styles.curveLabel}>Normal genes</text>
          <text x={x(sick.mu)} y={y(hill(sick, sick.mu)) - 8} textAnchor="middle" className={styles.curveLabel}>Cancer genes</text>
          <motion.g
            initial={reduceMotion ? false : { x: x(0) - x(raw), opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.8, duration: 0.7, ease: 'easeOut' }}
          >
            <line x1={x(raw)} x2={x(raw)} y1={14} y2={140} className={styles.patientLine} />
            <text x={x(raw) + 6} y={22} className={styles.curveLabel}>This patient</text>
          </motion.g>
          <ScoreAxis x={x} y={148} />
        </svg>
        <figcaption className={styles.legend}>
          <span><svg width="22" height="10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" className={`${styles.curve} ${styles.curveNormal}`} /></svg> Normal genes</span>
          <span><svg width="22" height="10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" className={`${styles.curve} ${styles.curveCancer}`} /></svg> Cancer genes (dashed)</span>
        </figcaption>
      </figure>
      <details className={styles.math}>
        <summary>Show the math</summary>
        <div className={styles.formula}>
          <p>Normal genes: average {score(normal.mu)}, spread {score(normal.sd)}, share of training genes {pct0(normal.prior)}</p>
          <p>Cancer genes: average {score(sick.mu)}, spread {score(sick.sd)}, share of training genes {pct0(sick.prior)}</p>
          <p>
            chance = cancer hill ÷ (cancer hill + normal hill) at the patient&apos;s score = {pct0(m.risk)}
          </p>
        </div>
      </details>
    </>
  );
}

export default function Explain({ model, data, genes }) {
  if (model === 'knn') return <KnnExplain data={data} genes={genes} />;
  if (model === 'decision_tree') return <TreeExplain data={data} />;
  if (model === 'logistic') return <LogisticExplain data={data} />;
  return <BayesExplain data={data} />;
}

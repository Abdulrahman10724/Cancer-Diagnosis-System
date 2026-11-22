import { Term } from '../../components/Popover';
import { FEATURES } from '../../lib/metro';
import { featureValue, num, pct } from '../../lib/format';
import styles from './Predict.module.css';

const name = (key) => FEATURES.find((f) => f.key === key)?.name || key;
const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

/** The model's own explanation, from the `explain` data of /diagnose. */
export default function Why({ model, result }) {
  const r = result.models[model];
  const e = r.explain;
  if (model === 'logistic') {
    return (
      <div className={styles.why}>
        <p>
          Each scaled feature is multiplied by its weight. The products are added to a starting value (the bias), and σ turns
          the total into a risk.
        </p>
        <table className={styles.whyTable}>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Weight</th>
              <th scope="col">Scaled value</th>
              <th scope="col">Weight × value</th>
            </tr>
          </thead>
          <tbody>
            {e.contributions.map((c) => (
              <tr key={c.feature}>
                <th scope="row">{name(c.feature)}</th>
                <td>{num(c.weight, 3)}</td>
                <td>{num(c.value, 3)}</td>
                <td className={c.product >= 0 ? styles.up : styles.down}>
                  {c.product >= 0 ? '+' : ''}
                  {num(c.product, 3)}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Bias</th>
              <td colSpan={2} />
              <td>{num(e.bias, 3)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total z
              </th>
              <td>{num(e.z, 3)}</td>
            </tr>
          </tfoot>
        </table>
        <p className={styles.whyResult}>
          σ({num(e.z, 2)}) = {pct(r.risk, 1)} chance of cancer.
        </p>
      </div>
    );
  }
  if (model === 'knn') {
    return (
      <div className={styles.why}>
        <p>
          The {r.k} training patients closest to this one, by distance on the four scaled features. Each one votes with its
          diagnosis.
        </p>
        <table className={styles.whyTable}>
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Diagnosis</th>
              <th scope="col">Distance</th>
            </tr>
          </thead>
          <tbody>
            {e.neighbors.map((n) => (
              <tr key={n.patient_id}>
                <th scope="row">{n.patient_id}</th>
                <td>{n.diagnosis === 1 ? 'Cancer' : 'No cancer'}</td>
                <td>{num(n.distance, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.whyResult}>
          {e.votesCancer} of {r.k} say cancer = {pct(r.risk)}.
        </p>
        <p className="muted small">
          The <Term meaning="A tree of boxes over the training patients; whole boxes that are too far away are skipped.">KD-tree</Term>{' '}
          visited {e.kdNodesVisited} nodes to find them, and a heap kept the best {r.k} while it searched. A patient from the
          training set finds itself at distance 0.
        </p>
      </div>
    );
  }
  if (model === 'decision_tree') {
    return (
      <div className={styles.why}>
        <p>The questions this patient answered, from the top of the tree down to a leaf.</p>
        <ol className={styles.path}>
          {e.path.map((step, i) => (
            <li key={i}>
              <span className={styles.pathQ}>
                {name(step.feature)} ≤ {featureValue(step.feature, step.thresholdRaw)}?
              </span>
              <span>
                This patient: {featureValue(step.feature, step.value)}, so <strong>{step.wentLeft ? 'yes' : 'no'}</strong>
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.whyResult}>
          The leaf holds {e.leafSamples} training patients; {pct(e.leafPositiveFraction)} had cancer, so the tree says{' '}
          {r.prediction === 1 ? 'cancer' : 'no cancer'}.
        </p>
      </div>
    );
  }
  // Naive Bayes: prior = [no cancer, cancer]; mean and std per class
  const rows = e.perFeature.map((f) => {
    const clear = pdf(f.value, f.mean[0], Math.max(f.std[0], 1e-6));
    const cancer = pdf(f.value, f.mean[1], Math.max(f.std[1], 1e-6));
    return { ...f, clear, cancer, favours: cancer >= clear ? 'cancer' : 'no cancer' };
  });
  return (
    <div className={styles.why}>
      <p>
        For each feature: how typical is this patient’s value among cancer patients, and among no-cancer patients? The group that
        fits better on most features, weighted by how common the group is, wins.
      </p>
      <p className="small">
        Before looking at the features: {pct(e.prior[1], 1)} of training patients had cancer, {pct(e.prior[0], 1)} did not.
      </p>
      <table className={styles.whyTable}>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Value</th>
            <th scope="col">Typical with cancer</th>
            <th scope="col">Typical without</th>
            <th scope="col">Fits better</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.feature}>
              <th scope="row">{name(f.feature)}</th>
              <td>{featureValue(f.feature, f.value)}</td>
              <td>
                {num(f.mean[1], f.feature === 'age' ? 1 : 2)} ± {num(f.std[1], 2)}
              </td>
              <td>
                {num(f.mean[0], f.feature === 'age' ? 1 : 2)} ± {num(f.std[0], 2)}
              </td>
              <td>
                <strong>{f.favours}</strong>{' '}
                <span className="muted">({num(Math.max(f.cancer, f.clear) / Math.max(Math.min(f.cancer, f.clear), 1e-12), 1)}×)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.whyResult}>All together: {pct(r.risk, 1)} chance of cancer.</p>
    </div>
  );
}

import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CountUp from '../components/CountUp';
import MetroDiagram from '../components/MetroDiagram';
import useMedia from '../lib/useMedia';
import { LINES, CORE, STATIONS } from '../lib/metro';
import { proofFrom, PROOF_FALLBACK, readCachedBenchmark } from '../lib/benchmark';
import styles from './Landing.module.css';

const WHERE = {
  hash: { where: 'finds a gene’s score from its ID while features are built', cost: 'find O(1) average' },
  merge: { where: 'sorts each feature to find decision-tree splits', cost: 'sort O(n log n)' },
  kd: { where: 'finds the nearest patients for KNN', cost: 'search O(log n) average' },
  heap: { where: 'keeps the best neighbours and orders the triage list', cost: 'push and pop O(log n)' },
  avl: { where: 'finds a patient by ID and lists patients by risk', cost: 'find O(log n)' },
  graph: { where: 'groups similar patients and walks outward from one', cost: 'search O(V + E)' },
};

export default function Landing() {
  const vertical = useMedia('(max-width: 720px)');
  const proofRef = useRef(null);
  const proofSeen = useInView(proofRef, { once: true, margin: '0px 0px -20% 0px' });
  // No request here: a 20,000-patient benchmark takes many seconds, so it only runs on the
  // Benchmark station. Show that result if this browser session has one, else docs/DSA.md.
  const [proof] = useState(() => {
    const cached = readCachedBenchmark(20000);
    return cached ? { ...proofFrom(cached), live: true } : { ...PROOF_FALLBACK, live: false };
  });

  const scrollToProof = (e) => {
    e.preventDefault();
    proofRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    proofRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.page}>
      <header className={`${styles.hero} on-night`}>
        <nav className={styles.nav} aria-label="Main">
          <span className={styles.brand}>Cancer Risk Pipeline</span>
          <Link to="/map" className={styles.navLink}>
            Open the app
          </Link>
        </nav>
        <div className={styles.heroBody}>
          <div className={styles.heroText}>
            <h1 className={styles.headline}>A cancer-risk pipeline, built on data structures.</h1>
            <p className={styles.lede}>
              Four models predict cancer risk from gene data. Every step runs on a data structure written by
              hand in C++ — and you can ride through each one.
            </p>
            <div className={styles.actions}>
              <Link to="/map" className="btn btn-night">
                Start the journey
              </Link>
              <a href="#proof" onClick={scrollToProof} className={styles.quietLink}>
                See the benchmark
              </a>
            </div>
          </div>
          <div className={styles.heroMap}>
            <MetroDiagram
              orientation={vertical ? 'vertical' : 'horizontal'}
              mode="hero"
              speed={0.78}
              title="Metro map: the core line runs through eight stations, Data to Benchmark. Six coloured lines, one per data structure, stop at the stations where they do work."
            />
          </div>
        </div>
      </header>

      <main>
        <section className={styles.section} aria-labelledby="how">
          <h2 id="how" className={styles.h2}>
            How it works
          </h2>
          <p className={styles.sectionLede}>Eight steps, in order. Each one hands its result to the next.</p>
          <ol className={styles.route}>
            {STATIONS.map((s) => (
              <li key={s.id} className={styles.routeStop}>
                <span className={styles.routeDot} aria-hidden="true" />
                <span className={styles.routeName}>
                  <span className={styles.routeNum}>{s.n}</span> {s.name}
                </span>
                <span className={styles.routeText}>{s.short}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="lines">
          <h2 id="lines" className={styles.h2}>
            The lines
          </h2>
          <p className={styles.sectionLede}>
            Each colour is one data structure. A line stops at a station when that structure does real work there.
          </p>
          <ul className={styles.lines}>
            {LINES.map((l) => (
              <li key={l.key} className={styles.lineRow}>
                <span className={styles.swatch} style={{ background: l.day }} aria-hidden="true" />
                <span className={styles.lineName}>{l.name}</span>
                <span className={styles.lineWhere}>{WHERE[l.key].where}</span>
                <span className={styles.lineCost}>{WHERE[l.key].cost}</span>
              </li>
            ))}
            <li className={styles.lineRow}>
              <span className={`${styles.swatch} ${styles.swatchCore}`} aria-hidden="true" />
              <span className={styles.lineName}>{CORE.name}</span>
              <span className={styles.lineWhere}>linked list of patients, waiting-room queue, undo stack</span>
              <span className={styles.lineCost}>push and pop O(1)</span>
            </li>
          </ul>
        </section>

        <section
          id="proof"
          ref={proofRef}
          tabIndex={-1}
          className={`${styles.section} ${styles.proof}`}
          aria-labelledby="proof-title"
        >
          <h2 id="proof-title" className={styles.h2}>
            Does it matter?
          </h2>
          <p className={styles.sectionLede}>
            {proof.live ? 'Measured on this server on 20,000 patients, ' : 'Measured on 20,000 patients, '}
            the same job done the simple way and with our structure.
          </p>
          <dl className={styles.numbers}>
            {proof.items.map((item) => (
              <div key={item.key} className={styles.number}>
                <dt className={styles.numberLabel}>{item.label}</dt>
                <dd className={styles.numberValue}>
                  <CountUp value={item.factor} start={proofSeen} format={(v) => `${Math.round(v)}×`} />
                  <span className={styles.numberUnit}> faster</span>
                </dd>
                <dd className={styles.numberNote}>{item.note}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>
            <strong>Cancer Risk Pipeline</strong>, a Data Structures &amp; Algorithms course project.
          </p>
          <p>
            <a href="https://github.com/Abdulrahman10724/Cancer-Diagnosis-System">Source on GitHub</a>
          </p>
          <p className="muted">Student project — not for real medical use.</p>
        </div>
      </footer>
    </div>
  );
}

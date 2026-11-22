import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppState } from '../state/AppState';
import PageHeader from '../components/PageHeader';
import styles from './Home.module.css';

function Tick({ done }) {
  const reduceMotion = useReducedMotion();
  return (
    <span className={`${styles.tick} ${done ? styles.tickDone : ''}`} aria-hidden="true">
      {done && (
        <svg width="18" height="18" viewBox="0 0 18 18">
          <motion.path
            d="M3.5 9.5l3.5 3.5 7.5-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </svg>
      )}
    </span>
  );
}

export default function Home() {
  const { state } = useAppState();
  const { status } = state;
  const loaded = status.modelsTrained;
  const picked = Boolean(state.selectedPatient);
  const checked = Object.keys(state.results).length > 0;

  const steps = [
    {
      title: 'Load the data',
      text: 'Read the gene and patient files and train the 4 AI models.',
      done: loaded,
      to: '/start',
      linkState: { autoLoad: true },
      action: 'Load data',
    },
    {
      title: 'Add or pick a patient',
      text: 'Add a new patient with their gene scores, or choose one already in the list.',
      done: picked,
      to: '/add-patient',
      action: 'Add patient',
      alt: { to: '/check-risk', label: 'Pick an existing patient' },
    },
    {
      title: 'Check the risk',
      text: 'See what each model thinks, and why.',
      done: checked,
      to: '/check-risk',
      action: 'Check risk',
    },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <div>
      <PageHeader
        title="Cancer Risk Checker"
        purpose="Four AI models look at a patient's gene scores and each guess the chance of cancer. Follow the three steps."
      />

      <ol className={styles.steps}>
        {steps.map((step, i) => {
          const isNext = i === next;
          return (
            <li key={step.title} className={`${styles.step} ${isNext ? styles.next : ''} ${step.done ? styles.done : ''}`}>
              <div className={styles.stepHead}>
                <span className={styles.number}>{i + 1}</span>
                <Tick done={step.done} />
                <span className="visually-hidden">{step.done ? 'Done' : 'Not done yet'}</span>
              </div>
              <h2 className={styles.stepTitle}>{step.title}</h2>
              <p className={styles.stepText}>{step.text}</p>
              <div className={styles.stepActions}>
                <Link
                  to={step.to}
                  state={step.linkState}
                  className={`btn ${isNext ? 'btn-primary btn-large' : ''}`}
                >
                  {step.done ? (i === 0 ? 'Reload data' : step.action) : step.action}
                </Link>
                {step.alt && (
                  <Link to={step.alt.to} className="btn btn-quiet">
                    {step.alt.label}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <ul className={styles.status} aria-label="Status">
        {state.server === 'offline' ? (
          <li className={styles.statusBad}>Server not running</li>
        ) : loaded ? (
          <>
            <li>Data loaded</li>
            <li>{status.geneticCount} genes</li>
            <li>{status.patientCount} patients</li>
            <li>4 models trained</li>
          </>
        ) : (
          <li>Data not loaded yet</li>
        )}
      </ul>

      <section className={styles.learn} aria-labelledby="learn-heading">
        <h2 id="learn-heading">Want to see how it works inside?</h2>
        <p>
          New here?{' '}
          <button type="button" className="btn btn-quiet" onClick={() => window.dispatchEvent(new Event('cds:tour'))}>
            Take the tour
          </button>
        </p>
        <p>
          <Link to="/accuracy">Model accuracy</Link> shows how often each model is right.{' '}
          <Link to="/linked-list">Patient list</Link> and <Link to="/hash-table">Gene lookup</Link>{' '}
          show the two data structures the program uses to store patients and genes.
        </p>
      </section>
    </div>
  );
}

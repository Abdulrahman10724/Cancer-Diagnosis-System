import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { pct0, riskLevel, score } from '../lib/format';
import Help from './Help';
import { CountUp, RiskBadge, RiskBar } from './Risk';
import styles from './FinalResult.module.css';

function verdictSentence(votes) {
  if (votes >= 3) return 'Most said cancer.';
  if (votes === 2) return 'They are split half and half.';
  return 'Most said no cancer.';
}

// The big card: final result from the four models
export default function FinalResult({ patient, result, average, votesShown, votes, phase, compact = false }) {
  const reduceMotion = useReducedMotion();
  const done = phase === 'done';
  const voting = phase === 'voting' || done;
  const level = done ? riskLevel(average) : null;

  return (
    <section className={`${styles.card} ${compact ? styles.compact : ''}`} aria-labelledby={`final-${patient.patient_id}`}>
      <div className={styles.top}>
        <h2 id={`final-${patient.patient_id}`} className={styles.title}>
          Final result for {patient.name}
          <Help term="Final result">
            Each of the 4 models makes its own guess. The final result counts how many of
            them say cancer, and shows the average of their chances.
          </Help>
        </h2>
      </div>

      {!voting && (
        <p className={styles.pending}>
          {phase === 'idle' ? 'Press Check risk to ask the 4 models.' : 'Waiting for the 4 models…'}
        </p>
      )}

      {voting && result && (
        <>
          <div className={styles.row}>
            <AnimatePresence>
              {done && (
                <motion.span
                  initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  <RiskBadge risk={average} size="lg" />
                </motion.span>
              )}
            </AnimatePresence>
            <p className={styles.votes}>
              <strong className="num">{votesShown}</strong> of 4 models say cancer
              {!done && '…'}
            </p>
            <p className={styles.average}>
              Average chance <strong><CountUp value={Math.round(average * 100)} /></strong>
            </p>
          </div>
          <RiskBar
            value={average}
            color={level ? `var(--${level})` : 'var(--border-strong)'}
            height={18}
            lineLabel
            label={`Average chance ${pct0(average)}`}
          />
          {done && !compact && (
            <motion.p
              className={styles.caption}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Each model looked at this patient&apos;s average gene score ({score(result.featureRaw)})
              and made its own guess. {verdictSentence(votes)}
            </motion.p>
          )}
        </>
      )}
    </section>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import styles from './SplitFlap.module.css';

/** Text as split-flap tiles that flip in one after another (each <= 300ms). */
export default function SplitFlap({ text, delay = 0, label }) {
  const reduce = useReducedMotion();
  return (
    <span className={styles.board} aria-label={label || text} role="img">
      {text.split('').map((ch, i) => (
        <motion.span
          key={`${i}-${ch}`}
          aria-hidden="true"
          className={ch === ' ' ? styles.gap : styles.tile}
          initial={reduce ? false : { rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ delay: reduce ? 0 : delay + i * 0.04, duration: 0.28, ease: [0.3, 1.3, 0.5, 1] }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import { bandShape, pct } from '../lib/format';
import styles from './Gel.module.css';

// A stained band. Sharp when the model is confident, smeared when it is not.

export default function Band({ risk, color, y, wellY, delay = 0, migrate, label, ariaLabel, onClick }) {
  const reduceMotion = useReducedMotion();
  const { height, blur } = bandShape(risk);
  const top = y - height / 2;

  // Migration: spring from the well to the risk position (the one orchestrated moment).
  // Any later change (a new K) is a short tween that answers the user's action.
  const transition = migrate
    ? { type: 'spring', stiffness: 120, damping: 20, delay }
    : { type: 'tween', duration: 0.25, ease: 'easeOut' };

  const Tag = onClick ? motion.button : motion.div;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={styles.bandButton}
      onClick={onClick}
      aria-label={ariaLabel}
      initial={reduceMotion || !migrate ? false : { y: wellY }}
      animate={{ y: top }}
      transition={reduceMotion ? { duration: 0 } : transition}
    >
      <span
        className={styles.band}
        style={{ height, background: color, filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none' }}
      />
      <span className={styles.bandLabel}>{label ?? pct(risk)}</span>
    </Tag>
  );
}

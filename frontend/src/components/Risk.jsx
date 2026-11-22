import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { RISK_WORD, riskLevel } from '../lib/format';
import styles from './Risk.module.css';

function RiskIcon({ level }) {
  if (level === 'low') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (level === 'medium') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        <path d="M7 3.5v4.2M7 9.8v.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.5l6 10.5H1z" fill="currentColor" />
    </svg>
  );
}

// Risk is always colour + word + icon
export function RiskBadge({ risk, level: forced, size = 'md', label }) {
  const level = forced || riskLevel(risk);
  return (
    <span className={`${styles.badge} ${styles[level]} ${size === 'lg' ? styles.large : ''}`}>
      <RiskIcon level={level} />
      {label || RISK_WORD[level]}
    </span>
  );
}

// Animated number, e.g. a percentage counting up from where it was
export function CountUp({ value, suffix = '%', decimals = 0, delay = 0, duration = 0.9 }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const current = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      current.current = value;
      setShown(value);
      return undefined;
    }
    const controls = animate(current.current, value, {
      duration,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, delay, duration, reduceMotion]);

  return (
    <span className="num">
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// Horizontal bar from 0 to 100% with the 50% cancer line marked
export function RiskBar({ value, color, delay = 0, showLine = true, lineLabel = false, height = 12, label }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={styles.barWrap}>
      <div
        className={styles.track}
        style={{ height }}
        role="img"
        aria-label={label || `${Math.round(value * 100)}%`}
      >
        <motion.div
          className={styles.fill}
          style={{ background: color }}
          initial={reduceMotion ? false : { width: '0%' }}
          animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18, delay }}
        />
        {showLine && <span className={styles.line} aria-hidden="true" />}
      </div>
      {showLine && lineLabel && (
        <span className={styles.lineLabel} aria-hidden="true">
          Cancer line 50%
        </span>
      )}
    </div>
  );
}

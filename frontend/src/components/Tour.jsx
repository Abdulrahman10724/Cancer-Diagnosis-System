import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion, motion } from 'framer-motion';
import { TOUR_KEY } from '../lib/tour';
import styles from './Tour.module.css';


const STEPS = [
  { targets: ['start', 'start-mobile'], title: 'Load data', text: 'Start here. Load the gene and patient files so the 4 AI models can learn from them.' },
  { targets: ['add'], title: 'Add patient', text: 'Add a patient with their gene scores. You can also use the patients that are already there.' },
  { targets: ['check'], title: 'Check risk', text: 'The main screen. Pick a patient and watch each model make its guess, then ask why.' },
  { targets: ['accuracy'], title: 'Model accuracy', text: 'See how often each model was right on genes it never saw during training.' },
];

function findTarget(names) {
  for (const name of names) {
    const els = document.querySelectorAll(`[data-tour="${name}"]`);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export default function Tour({ open, onClose }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [dontShow, setDontShow] = useState(true);
  const [boxHeight, setBoxHeight] = useState(0);
  const boxRef = useRef(null);
  const step = STEPS[index];

  const measure = useCallback(() => {
    const el = findTarget(step.targets);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  const close = useCallback(() => {
    if (dontShow) {
      try {
        window.localStorage.setItem(TOUR_KEY, '1');
      } catch {
        // Storage unavailable: the tour may show again next time
      }
    }
    setIndex(0);
    onClose();
  }, [dontShow, onClose]);

  useLayoutEffect(() => {
    if (open && boxRef.current) setBoxHeight(boxRef.current.offsetHeight);
  }, [open, index]);

  // Focus the dialog, trap Tab inside it, Esc skips
  useEffect(() => {
    if (!open) return undefined;
    const box = boxRef.current;
    const primary = box && box.querySelector('[data-primary]');
    if (primary) primary.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      if (e.key !== 'Tab' || !box) return;
      const items = Array.from(box.querySelectorAll('button, input'));
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, index, close]);

  if (!open) return null;

  const pad = 6;
  const spot = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // Sidebar targets: tooltip to the right. Bottom tab bar targets: tooltip above.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const boxW = Math.min(340, vw - 32);
  const boxH = boxHeight || 240;
  let pos = { top: vh / 2 - boxH / 2, left: Math.max(16, vw / 2 - boxW / 2) };
  if (spot) {
    const fitsRight = spot.left + spot.width + 16 + boxW <= vw - 16;
    if (fitsRight) {
      pos = {
        top: Math.max(16, Math.min(vh - boxH - 16, spot.top + spot.height / 2 - boxH / 2)),
        left: spot.left + spot.width + 16,
      };
    } else {
      pos = {
        top: Math.max(16, spot.top - boxH - 16),
        left: Math.max(16, Math.min(vw - boxW - 16, spot.left + spot.width / 2 - boxW / 2)),
      };
    }
  }

  return (
    <div className={styles.layer}>
      {spot ? (
        <motion.div
          className={styles.spot}
          animate={spot}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
        />
      ) : (
        <div className={styles.dim} />
      )}
      <motion.div
        ref={boxRef}
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        style={pos}
        key={index}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <p className={styles.count}>
          Step {index + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className={styles.title}>{step.title}</h2>
        <p id="tour-text">{step.text}</p>
        <label className={styles.check}>
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          Don&apos;t show again
        </label>
        <div className={styles.actions}>
          <button type="button" className="btn btn-quiet" onClick={close}>
            Skip tour
          </button>
          <span className={styles.spacer} />
          {index > 0 && (
            <button type="button" className="btn" onClick={() => setIndex((i) => i - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            data-primary
            onClick={() => (index === STEPS.length - 1 ? close() : setIndex((i) => i + 1))}
          >
            {index === STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

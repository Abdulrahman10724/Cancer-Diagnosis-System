import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './Drawer.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Side panel (right) or sheet (bottom). Traps focus while open, closes on Esc,
// returns focus on close.
export default function Drawer({ open, title, onClose, children, side = 'right', headerExtra }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel && panel.querySelector(FOCUSABLE);
    if (first) first.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const target = returnFocusRef.current;
      if (target && typeof target.focus === 'function') target.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.scrim}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          />
          <motion.div
            ref={panelRef}
            className={`${styles.panel} ${side === 'bottom' ? styles.bottom : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            initial={reduceMotion ? false : side === 'bottom' ? { y: 40, opacity: 0 } : { x: 40, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : side === 'bottom' ? { y: 40, opacity: 0 } : { x: 40, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
          >
            <div className={styles.header}>
              <h2 id="drawer-title" className={styles.title}>
                {title}
              </h2>
              <div className={styles.actions}>
                {headerExtra}
                <button type="button" className="btn" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

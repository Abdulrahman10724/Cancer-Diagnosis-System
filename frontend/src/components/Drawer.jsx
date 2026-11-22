import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';
import styles from './Drawer.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Side drawer: traps focus, closes on Esc, gives focus back to what opened it. */
export default function Drawer({ open, onClose, title, children, wide = false }) {
  const reduce = useReducedMotion();
  const panel = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    const t = window.setTimeout(() => panel.current?.querySelector(FOCUSABLE)?.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      opener.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.layer}>
          <motion.div
            className={styles.scrim}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          />
          <motion.aside
            ref={panel}
            className={`${styles.panel} ${wide ? styles.wide : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 0.8, 0.3, 1] }}
          >
            <header className={styles.head}>
              <h2 className={styles.title}>{title}</h2>
              <button type="button" className={`btn btn-quiet ${styles.close}`} onClick={onClose} aria-label="Close">
                <CloseIcon size={18} />
              </button>
            </header>
            <div className={styles.body}>{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

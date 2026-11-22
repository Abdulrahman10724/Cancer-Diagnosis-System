import { useEffect, useId, useRef, useState } from 'react';
import styles from './Help.module.css';

// A small "?" button that opens a short plain-language explanation
export default function Help({ term, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What is ${term}?`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <span id={id} className={styles.popover}>
          <strong className={styles.term}>{term}</strong>
          <span>{children}</span>
        </span>
      )}
    </span>
  );
}

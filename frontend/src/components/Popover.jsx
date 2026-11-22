import { useEffect, useId, useRef, useState } from 'react';
import styles from './Popover.module.css';

/** A button that opens a small panel. Closes on Esc, outside click or a second press. */
export function Popover({ trigger, label, children, className = '', triggerClass = '', align = 'start' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e) => {
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <span className={`${styles.root} ${className}`} ref={root}>
      <button
        ref={button}
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <span id={id} role="note" className={`${styles.panel} ${align === 'end' ? styles.end : ''}`}>
          {children}
        </span>
      )}
    </span>
  );
}

/** A technical term with a one-line plain meaning behind a small "?". */
export function Term({ children, meaning }) {
  return (
    <span className={styles.term}>
      {children}
      <Popover trigger="?" label={`What is ${typeof children === 'string' ? children : 'this'}?`} triggerClass={styles.q}>
        {meaning}
      </Popover>
    </span>
  );
}

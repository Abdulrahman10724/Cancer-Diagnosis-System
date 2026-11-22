import { useId, useMemo, useRef, useState } from 'react';
import styles from './PatientPicker.module.css';

/** Search patients by ID or name and pick one (combobox). */
export default function PatientPicker({ patients, value, onChange, label = 'Patient' }) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef(null);

  const selected = patients.find((p) => p.patient_id === value);
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = q
      ? patients.filter((p) => p.patient_id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      : patients;
    return list.slice(0, 8);
  }, [patients, text]);

  const choose = (p) => {
    onChange(p.patient_id);
    setText('');
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={styles.picker}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className={styles.box}>
        <input
          ref={input}
          id={id}
          className={`input ${styles.input}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${matches[active].patient_id}` : undefined}
          placeholder={selected ? `${selected.patient_id}, ${selected.name}` : 'Type an ID or a name, e.g. P004'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          autoComplete="off"
        />
        {open && (
          <ul id={`${id}-list`} role="listbox" className={styles.list}>
            {matches.length === 0 && <li className={styles.none}>No patient matches “{text}”.</li>}
            {matches.map((p, i) => (
              <li
                key={p.patient_id}
                id={`${id}-${p.patient_id}`}
                role="option"
                aria-selected={i === active}
                className={`${styles.option} ${i === active ? styles.active : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.pid}>{p.patient_id}</span>
                <span>{p.name}</span>
                <span className={styles.meta}>age {p.age}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

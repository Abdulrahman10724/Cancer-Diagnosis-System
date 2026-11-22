import { useId } from 'react';
import styles from './Segmented.module.css';

/** Radio group drawn as a segmented control. options: [{ value, label }] */
export default function Segmented({ options, value, onChange, label, size = 'md' }) {
  const name = useId();
  return (
    <div className={`${styles.group} ${size === 'sm' ? styles.sm : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className={`${styles.option} ${value === o.value ? styles.on : ''}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className={styles.input}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

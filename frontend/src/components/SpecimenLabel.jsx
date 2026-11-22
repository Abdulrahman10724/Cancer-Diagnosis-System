import styles from './SpecimenLabel.module.css';

// LEGACY: patient label used by screens not yet redesigned
export default function SpecimenLabel({ id, name, age, compact = false }) {
  return (
    <div className={`${styles.label} ${compact ? styles.compact : ''}`}>
      <span className={styles.barcode}>{id}</span>
      {(name || age !== undefined) && (
        <span className={styles.meta}>
          {name && <span className={styles.name}>{name}</span>}
          {age !== undefined && age !== null && (
            <span className={styles.age}>{age > 0 ? `${age} years` : 'Age not recorded'}</span>
          )}
        </span>
      )}
    </div>
  );
}

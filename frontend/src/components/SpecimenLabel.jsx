import { code128B } from '../lib/code128';
import styles from './SpecimenLabel.module.css';

// A printed specimen label: Code 128 barcode of the patient ID, with name and age.
export default function SpecimenLabel({ id, name, age, compact = false }) {
  return (
    <div className={`${styles.label} ${compact ? styles.compact : ''}`}>
      <span className={styles.barcode} aria-hidden="true">
        {code128B(id)}
      </span>
      <span className="visually-hidden">Specimen {id}</span>
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

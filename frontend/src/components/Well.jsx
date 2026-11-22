import styles from './Gel.module.css';

// The loading well at the top of a lane (a slot cut into the gel)
export default function Well() {
  return <span className={styles.well} aria-hidden="true" />;
}

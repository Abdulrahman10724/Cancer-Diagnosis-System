import styles from './PageHeader.module.css';

// Every screen starts with its name and one line saying what it is for
export default function PageHeader({ title, purpose, children }) {
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      {purpose && <p className={styles.purpose}>{purpose}</p>}
      {children}
    </header>
  );
}

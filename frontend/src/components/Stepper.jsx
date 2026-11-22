import { NavLink } from 'react-router-dom';
import { useAppState } from '../state/AppState';
import styles from './Stepper.module.css';

// The sample lifecycle, in order. This is a real sequence, so it is numbered by position.
const STEPS = [
  { to: '/accession', label: 'Accession' },
  { to: '/rack', label: 'Rack' },
  { to: '/gel', label: 'Gel' },
  { to: '/report', label: 'Report' },
  { to: '/custody', label: 'Custody' },
];

const SECONDARY = [
  { to: '/proficiency', label: 'Proficiency' },
  { to: '/freezer', label: 'Freezer' },
  { to: '/setup', label: 'Setup' },
];

function Chevron() {
  return (
    <svg className={styles.chevron} width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
      <path d="M1.5 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function Stepper() {
  const { state } = useAppState();
  const navClass = ({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link);

  return (
    <header className={styles.bar}>
      <NavLink to="/setup" className={styles.wordmark}>
        Pathology Bench
      </NavLink>
      <nav aria-label="Sample lifecycle" className={styles.lifecycle}>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.to} className={styles.step}>
              {i > 0 && <Chevron />}
              <NavLink to={step.to} className={navClass}>
                {step.label}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>
      <nav aria-label="Lab tools" className={styles.secondary}>
        {state.server === 'offline' && (
          <NavLink to="/setup" className={styles.offline}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M3 9l6-6" stroke="currentColor" strokeWidth="2" />
            </svg>
            Server offline
          </NavLink>
        )}
        {SECONDARY.map((link) => (
          <NavLink key={link.to} to={link.to} className={navClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

import { Link } from 'react-router-dom';
import { STATIONS, linesAt, stationIndex } from '../lib/metro';
import { useJourney } from '../state/Journey';
import MetroBar from './MetroBar';
import LineChip from './LineChip';
import { ArrowIcon } from './Icons';
import styles from './StationLayout.module.css';

/**
 * Template for every station: metro bar, name, one sentence, ONE main panel,
 * the lines that stop here, and previous / next.
 * `todo` says what finishes this station (shown while Next is disabled).
 */
export default function StationLayout({ id, sentence, todo, children, details, resultNote = false, wide = false }) {
  const { isDone } = useJourney();
  const i = stationIndex(id);
  const station = STATIONS[i];
  const prev = STATIONS[i - 1];
  const next = STATIONS[i + 1];
  const done = isDone(id);

  return (
    <div className={styles.page}>
      <MetroBar here={id} />
      <main className={`${styles.main} ${wide ? styles.wide : ''}`}>
        <header className={styles.head}>
          <h1 className={styles.title}>{station.name}</h1>
          <p className={styles.sentence}>{sentence}</p>
        </header>

        <section className={styles.panel} aria-label={`${station.name} station`}>
          {children}
        </section>

        {details}

        <div className={styles.lines}>
          <span className={styles.linesLabel}>Lines at this station</span>
          <ul className={styles.chips}>
            {linesAt(id).map((l) => (
              <li key={l.key}>
                <LineChip line={l} station={id} />
              </li>
            ))}
          </ul>
        </div>
      </main>

      <nav className={styles.bottom} aria-label="Stations">
        <div className={styles.bottomInner}>
          {prev ? (
            <Link to={`/station/${prev.id}`} className="btn">
              <ArrowIcon left /> Previous station
            </Link>
          ) : (
            <Link to="/map" className="btn">
              <ArrowIcon left /> Back to the map
            </Link>
          )}
          <div className={styles.nextWrap}>
            {!done && todo && (
              <span className={styles.todo} id={`${id}-todo`}>
                {todo}
              </span>
            )}
            {next ? (
              done ? (
                <Link to={`/station/${next.id}`} className="btn btn-primary">
                  Next station: {next.name}
                </Link>
              ) : (
                <button type="button" className="btn btn-primary" disabled aria-describedby={`${id}-todo`}>
                  Next station
                </button>
              )
            ) : (
              <Link to="/map" className={`btn ${done ? 'btn-primary' : ''}`}>
                Back to the map
              </Link>
            )}
          </div>
        </div>
        {resultNote && <p className={styles.note}>Student project — not for real medical use.</p>}
      </nav>
    </div>
  );
}

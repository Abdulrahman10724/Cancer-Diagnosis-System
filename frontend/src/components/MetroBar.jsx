import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { STATIONS } from '../lib/metro';
import { useJourney } from '../state/Journey';
import { CheckIcon, LockIcon } from './Icons';
import styles from './MetroBar.module.css';

/** The sticky mini map on every station page: done, current and locked stations. */
export default function MetroBar({ here }) {
  const { isDone, canOpen, blockedReason, toast } = useJourney();
  const scroller = useRef(null);
  const hereRef = useRef(null);

  useEffect(() => {
    const el = hereRef.current;
    const box = scroller.current;
    if (el && box) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, [here]);

  return (
    <nav className={styles.bar} aria-label="Journey">
      <div className={styles.inner}>
        <Link to="/map" className={styles.mapLink}>
          Map
        </Link>
        <ol className={styles.stops} ref={scroller}>
          {STATIONS.map((s) => {
            const done = isDone(s.id);
            const open = canOpen(s.id);
            const isHere = s.id === here;
            const state = isHere ? 'here' : done ? 'done' : open ? 'open' : 'locked';
            const content = (
              <>
                <span className={styles.dot} aria-hidden="true">
                  {state === 'done' && <CheckIcon size={12} />}
                  {state === 'locked' && <LockIcon size={10} />}
                </span>
                <span className={styles.name}>{s.name}</span>
              </>
            );
            const label = `Station ${s.n}, ${s.name}${isHere ? ', you are here' : done ? ', done' : open ? '' : ', locked'}`;
            return (
              <li key={s.id} className={`${styles.stop} ${styles[state]}`} ref={isHere ? hereRef : undefined}>
                {open && !isHere ? (
                  <Link to={`/station/${s.id}`} className={styles.link} aria-label={label}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.link}
                    aria-label={label}
                    aria-current={isHere ? 'step' : undefined}
                    aria-disabled={!isHere || undefined}
                    onClick={() => !isHere && toast(blockedReason(s.id))}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

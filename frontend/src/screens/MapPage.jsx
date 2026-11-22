import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl, setApiUrl } from '../api/client';
import MetroDiagram from '../components/MetroDiagram';
import { CloseIcon, LockIcon, MenuIcon } from '../components/Icons';
import { metroLayout } from '../lib/geometry';
import { STATIONS, lineByKey, stationById } from '../lib/metro';
import useMedia from '../lib/useMedia';
import { useJourney } from '../state/Journey';
import styles from './MapPage.module.css';

const DRAWN = 'cds.map.drawn';
const TRAIN = 'cds.map.train';

function session(key, value) {
  try {
    if (value === undefined) return window.sessionStorage.getItem(key);
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the map simply draws again
  }
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const vertical = useMedia('(max-width: 720px)');
  const { journey, furthest, current, isDone, canOpen, blockedReason, justUnlocked, clearJustUnlocked } = useJourney();

  // Lines draw once per session; the train glides from where it was last seen
  const [draw] = useState(() => !session(DRAWN));
  const [trainFrom] = useState(() => session(TRAIN) || current.id);
  const [unlocked] = useState(justUnlocked);
  useEffect(() => {
    session(DRAWN, '1');
    session(TRAIN, current.id);
    if (justUnlocked) clearJustUnlocked();
    // run once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    session(TRAIN, current.id);
  }, [current.id]);

  const [hoverLine, setHoverLine] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tip, setTip] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const doneCount = STATIONS.filter((s) => isDone(s.id)).length;
  const states = useMemo(() => {
    const out = {};
    STATIONS.forEach((s, i) => {
      if (isDone(s.id)) out[s.id] = 'done';
      else out[s.id] = i === furthest ? 'current' : 'locked';
    });
    return out;
  }, [furthest, isDone]);

  const layout = metroLayout(vertical ? 'vertical' : 'horizontal');

  const goStation = (id) => {
    if (canOpen(id)) {
      navigate(`/station/${id}`);
      return;
    }
    const s = layout.stations.find((x) => x.id === id);
    setTip({ id, text: blockedReason(id), left: (s.x / layout.width) * 100, top: (s.y / layout.height) * 100 });
  };

  useEffect(() => {
    if (!tip) return undefined;
    const t = window.setTimeout(() => setTip(null), 2600);
    return () => window.clearTimeout(t);
  }, [tip]);

  const allDone = doneCount === STATIONS.length;
  const panelLine = selected ? lineByKey(selected) : null;

  return (
    <div className={`${styles.page} on-night`}>
      <header className={styles.head}>
        <div>
          <Link to="/" className={styles.home}>
            Cancer Risk Pipeline
          </Link>
          <p className={styles.progress}>
            {doneCount} of 8 stations done{journey.dataset ? `, dataset “${journey.dataset}”` : ''}
          </p>
        </div>
        <MapMenu open={menuOpen} setOpen={setMenuOpen} />
      </header>

      <main className={styles.main}>
        <div className={styles.lead}>
          <p className={styles.leadText}>
            This is a data-science pipeline. Each station is one step; each coloured line is a data structure we wrote,
            and it stops where it does real work.
          </p>
          <Link to={`/station/${allDone ? 'data' : current.id}`} className="btn btn-night">
            {allDone ? 'Ride again from Data' : doneCount === 0 ? 'Start at Data' : `Continue to ${current.name}`}
          </Link>
        </div>

        <div className={`${styles.mapWrap} ${vertical ? styles.vertical : ''}`}>
          <MetroDiagram
            orientation={vertical ? 'vertical' : 'horizontal'}
            mode="map"
            draw={draw}
            states={states}
            currentId={current.id}
            trainFromId={trainFrom}
            unlockedId={unlocked}
            activeLine={hoverLine || selected}
            onLineEnter={setHoverLine}
            onLineLeave={() => setHoverLine(null)}
            onLineSelect={(key) => setSelected((s) => (s === key ? null : key))}
            onStation={goStation}
            title="Pipeline map. Stations in travel order with the data-structure lines that stop at them."
          />
          <AnimatePresence>
            {tip && (
              <motion.div
                key={tip.id}
                role="status"
                className={styles.tip}
                style={{ left: `${tip.left}%`, top: `${tip.top}%` }}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <LockIcon size={12} /> {tip.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className={styles.hint}>Press a station to travel. Press a line to see what that data structure does.</p>

        <AnimatePresence>
          {panelLine && (
            <LinePanel key={panelLine.key} line={panelLine} onClose={() => setSelected(null)} canOpen={canOpen} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function LinePanel({ line, onClose, canOpen }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <motion.section
      ref={ref}
      tabIndex={-1}
      className={styles.panel}
      aria-label={`${line.name} line`}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          <span className={styles.panelSwatch} style={{ background: line.night }} aria-hidden="true" />
          {line.name}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>
      </div>
      <p className={styles.panelWhat}>{line.what}</p>
      <div className={styles.panelCols}>
        <ul className={styles.uses}>
          {line.stops.map((id) => {
            const s = stationById(id);
            return (
              <li key={id}>
                <span className={styles.useAt}>
                  {canOpen(id) ? <Link to={`/station/${id}`}>At {s.name}</Link> : <span>At {s.name}</span>}
                </span>{' '}
                {line.uses[id]}.
              </li>
            );
          })}
        </ul>
        <div>
          <h3 className={styles.costTitle}>How fast</h3>
          <ul className={styles.costs}>
            {line.complexity.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className={styles.file}>
            Code: <span className="mono">{line.file}</span>
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function MapMenu({ open, setOpen }) {
  const { reset } = useJourney();
  const [url, setUrl] = useState(getApiUrl);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, setOpen]);

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls="map-menu"
        onClick={() => {
          setOpen(!open);
          setConfirming(false);
        }}
      >
        <MenuIcon size={18} /> Menu
      </button>
      {open && (
        <div id="map-menu" className={styles.menuPanel}>
          <form
            className={styles.urlForm}
            onSubmit={(e) => {
              e.preventDefault();
              setApiUrl(url.trim());
              setOpen(false);
            }}
          >
            <label htmlFor="api-url" className={styles.menuLabel}>
              Server address
            </label>
            <div className={styles.urlRow}>
              <input id="api-url" className={styles.urlInput} value={url} onChange={(e) => setUrl(e.target.value)} />
              <button type="submit" className={styles.menuAction}>
                Save
              </button>
            </div>
          </form>
          <div className={styles.menuDivider} />
          {confirming ? (
            <div className={styles.confirm}>
              <p>Clear all progress and start again at Data?</p>
              <div className={styles.urlRow}>
                <button
                  type="button"
                  className={styles.menuAction}
                  onClick={() => {
                    reset();
                    setOpen(false);
                  }}
                >
                  Reset journey
                </button>
                <button type="button" className={styles.menuQuiet} onClick={() => setConfirming(false)}>
                  Keep progress
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.menuItem} onClick={() => setConfirming(true)}>
              Reset journey
            </button>
          )}
        </div>
      )}
    </div>
  );
}


import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STATIONS, stationIndex } from '../lib/metro';

const KEY = 'cds.journey.v1';
const EMPTY = { dataset: null, completed: {}, k: 5 };

function read() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw);
    return { ...EMPTY, ...saved, completed: saved.completed || {} };
  } catch {
    return EMPTY;
  }
}

const JourneyContext = createContext(null);
let toastId = 0;

export function JourneyProvider({ children }) {
  const [journey, setJourney] = useState(read);
  const [toasts, setToasts] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  // The station that unlocked most recently (the map pulses it once)
  const [justUnlocked, setJustUnlocked] = useState(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(journey));
    } catch {
      // Storage unavailable: progress lasts for this page only
    }
  }, [journey]);

  const toast = useCallback((text, tone = 'info') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const announce = useCallback((text) => {
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(text), 30);
  }, []);

  // Index of the furthest station the user may open
  const furthest = useMemo(() => {
    let i = 0;
    while (i < STATIONS.length - 1 && journey.completed[STATIONS[i].id]) i++;
    return i;
  }, [journey.completed]);

  const isDone = useCallback((id) => !!journey.completed[id], [journey.completed]);
  const canOpen = useCallback((id) => stationIndex(id) <= furthest, [furthest]);

  const complete = useCallback(
    (id) => {
      const current = journeyRef.current;
      if (current.completed[id]) return;
      const i = stationIndex(id);
      // Only the station at the front of the journey (or an earlier one) can be completed
      let front = 0;
      while (front < STATIONS.length - 1 && current.completed[STATIONS[front].id]) front++;
      if (i > front) return;
      setJourney((j) => ({ ...j, completed: { ...j.completed, [id]: true } }));
      const next = STATIONS[i + 1];
      if (next && i === front) {
        setJustUnlocked(next.id);
        announce(`Station ${next.n}, ${next.name}, unlocked.`);
      } else if (!next) {
        announce('Journey complete.');
      }
    },
    [announce],
  );

  // A dataset finished loading. Switching datasets resets everything after station 1.
  const datasetLoaded = useCallback(
    (name) => {
      const previous = journeyRef.current.dataset;
      const hadProgress = Object.keys(journeyRef.current.completed).some((k) => k !== 'data');
      setJourney((j) => ({ ...j, dataset: name, completed: { data: true } }));
      if (previous && previous !== name && hadProgress) {
        toast(`Now using “${name}”. Stations 2 to 8 start again, because every result changes.`, 'info');
      }
      if (!journeyRef.current.completed.data) {
        setJustUnlocked('features');
        announce('Station 2, Features, unlocked.');
      }
    },
    [announce, toast],
  );

  const setK = useCallback((k) => setJourney((j) => ({ ...j, k })), []);
  const reset = useCallback(() => {
    setJourney(EMPTY);
    setJustUnlocked(null);
    toast('Journey reset. Start again at Data.', 'info');
  }, [toast]);

  const value = useMemo(
    () => ({
      journey,
      furthest,
      current: STATIONS[furthest],
      isDone,
      canOpen,
      complete,
      datasetLoaded,
      setK,
      reset,
      toast,
      announce,
      justUnlocked,
      clearJustUnlocked: () => setJustUnlocked(null),
      blockedReason: (id) => {
        const i = stationIndex(id);
        if (i <= furthest) return null;
        return `Finish ${STATIONS[furthest].name} first.`;
      },
    }),
    [journey, furthest, isDone, canOpen, complete, datasetLoaded, setK, reset, toast, announce, justUnlocked],
  );

  return (
    <JourneyContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.text}</span>
            <button type="button" className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="vh" aria-live="assertive">
        {announcement}
      </div>
    </JourneyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error('useJourney must be used inside JourneyProvider');
  return ctx;
}

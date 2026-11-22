import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { STATIONS, stationIndex } from './lib/metro';
import { JourneyProvider, useJourney } from './state/Journey';
import Landing from './screens/Landing';
import MapPage from './screens/MapPage';
import { STATION_SCREENS } from './stations';

// Travel order of the routes, for the slide direction
function order(pathname) {
  if (pathname === '/') return 0;
  if (pathname === '/map') return 1;
  const id = pathname.replace('/station/', '');
  const i = stationIndex(id);
  return i >= 0 ? 2 + i : 1;
}

/** A locked station redirects to the furthest open one, with the reason as a toast. */
function Guard({ id, children }) {
  const { canOpen, current, blockedReason, toast } = useJourney();
  const told = useRef(false);
  const open = canOpen(id);
  useEffect(() => {
    if (!open && !told.current) {
      told.current = true;
      toast(blockedReason(id));
    }
  }, [open, id, blockedReason, toast]);
  if (!open) return <Navigate to={`/station/${current.id}`} replace />;
  return children;
}

function Page({ children, direction }) {
  const reduce = useReducedMotion();
  const offset = reduce ? 0 : 12 * direction;
  return (
    <motion.div
      custom={direction}
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -offset }}
      transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const previous = useRef(order(location.pathname));
  const now = order(location.pathname);
  const direction = now >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = now;
    window.scrollTo(0, 0);
  }, [now]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <Page direction={direction}>
              <Landing />
            </Page>
          }
        />
        <Route
          path="/map"
          element={
            <Page direction={direction}>
              <MapPage />
            </Page>
          }
        />
        {STATIONS.map((s) => {
          const Screen = STATION_SCREENS[s.id];
          return (
            <Route
              key={s.id}
              path={`/station/${s.id}`}
              element={
                <Guard id={s.id}>
                  <Page direction={direction}>
                    <Screen />
                  </Page>
                </Guard>
              }
            />
          );
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <JourneyProvider>
      <AnimatedRoutes />
    </JourneyProvider>
  );
}

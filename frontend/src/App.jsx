import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Shell from './components/Shell';
import Home from './screens/Home';
import Start from './screens/Start';
import AddPatient from './screens/Accession';
import CheckRisk from './screens/CheckRisk';
import WaitingList from './screens/Rack';
import Report from './screens/Report';
import Accuracy from './screens/Proficiency';
import LinkedList from './screens/Custody';
import HashTable from './screens/Freezer';

export default function App() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const first = useRef(true);

  // Move focus to the new page so keyboard and screen reader users start at the top
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/start" element={<Start />} />
            <Route path="/add-patient" element={<AddPatient />} />
            <Route path="/check-risk" element={<CheckRisk />} />
            <Route path="/waiting-list" element={<WaitingList />} />
            <Route path="/report" element={<Report />} />
            <Route path="/report/:patientId" element={<Report />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/linked-list" element={<LinkedList />} />
            <Route path="/hash-table" element={<HashTable />} />
            {/* Old addresses */}
            <Route path="/setup" element={<Navigate to="/start" replace />} />
            <Route path="/accession" element={<Navigate to="/add-patient" replace />} />
            <Route path="/gel" element={<Navigate to="/check-risk" replace />} />
            <Route path="/rack" element={<Navigate to="/waiting-list" replace />} />
            <Route path="/proficiency" element={<Navigate to="/accuracy" replace />} />
            <Route path="/custody" element={<Navigate to="/linked-list" replace />} />
            <Route path="/freezer" element={<Navigate to="/hash-table" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

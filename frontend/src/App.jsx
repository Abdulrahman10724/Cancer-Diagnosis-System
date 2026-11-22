import { Navigate, Route, Routes } from 'react-router-dom';
import Stepper from './components/Stepper';
import Notebook from './components/Notebook';
import Setup from './screens/Setup';
import Accession from './screens/Accession';
import Rack from './screens/Rack';
import Gel from './screens/Gel';
import Report from './screens/Report';
import Custody from './screens/Custody';
import Proficiency from './screens/Proficiency';
import Freezer from './screens/Freezer';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <Stepper />
      <div className={styles.workspace}>
        <main id="main" className={styles.main} tabIndex={-1}>
          <div className={styles.content}>
            <Routes>
              <Route path="/" element={<Navigate to="/setup" replace />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/accession" element={<Accession />} />
              <Route path="/rack" element={<Rack />} />
              <Route path="/gel" element={<Gel />} />
              <Route path="/report" element={<Report />} />
              <Route path="/report/:patientId" element={<Report />} />
              <Route path="/custody" element={<Custody />} />
              <Route path="/proficiency" element={<Proficiency />} />
              <Route path="/freezer" element={<Freezer />} />
              <Route path="*" element={<Navigate to="/setup" replace />} />
            </Routes>
          </div>
        </main>
        <Notebook />
      </div>
    </div>
  );
}

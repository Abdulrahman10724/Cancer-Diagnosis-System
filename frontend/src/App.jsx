import { Route, Routes } from 'react-router-dom';
import { STATIONS } from './lib/metro';
import Landing from './screens/Landing';

function Placeholder({ title }) {
  return (
    <main style={{ padding: 32 }}>
      <h1>{title}</h1>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/map" element={<Placeholder title="Map" />} />
      {STATIONS.map((s) => (
        <Route key={s.id} path={`/station/${s.id}`} element={<Placeholder title={s.name} />} />
      ))}
    </Routes>
  );
}

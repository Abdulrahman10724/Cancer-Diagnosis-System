import { useState } from 'react';
import { api } from '../api/client';
import StationLayout from '../components/StationLayout';
import Tabs from '../components/Tabs';
import useApi from '../lib/useApi';
import Diagnose from './predict/Diagnose';
import WaitingRoom from './predict/WaitingRoom';
import FindPatients from './predict/FindPatients';
import SimilarPatients from './predict/SimilarPatients';

export default function Predict() {
  const [tab, setTab] = useState('diagnose');
  const [patientId, setPatientId] = useState(null);
  const patients = useApi((signal) => api.patients({ signal }), []);

  return (
    <StationLayout
      id="predict"
      sentence="Pick a patient. Each model gives its own chance of cancer, then they vote."
      todo="Check one patient to continue."
      resultNote
    >
      <Tabs
        label="Predict"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'diagnose', label: 'Diagnose' },
          { id: 'waiting', label: 'Waiting room' },
          { id: 'find', label: 'Find patients' },
          { id: 'similar', label: 'Similar patients' },
        ]}
      >
        {tab === 'diagnose' && <Diagnose patients={patients} patientId={patientId} setPatientId={setPatientId} />}
        {tab === 'waiting' && <WaitingRoom patients={patients} patientId={patientId} setPatientId={setPatientId} />}
        {tab === 'find' && <FindPatients patientId={patientId} />}
        {tab === 'similar' && <SimilarPatients patients={patients} patientId={patientId} setPatientId={setPatientId} />}
      </Tabs>
    </StationLayout>
  );
}

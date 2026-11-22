import { useId } from 'react';

// Dropdown of patients (type to jump). value is a patient ID or ''.
export default function PatientPicker({ patients, value, onChange, label = 'Patient', exclude }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a patient</option>
        {patients
          .filter((p) => p.patient_id !== exclude)
          .map((p) => (
            <option key={p.patient_id} value={p.patient_id}>
              {p.name} ({p.patient_id})
            </option>
          ))}
      </select>
    </div>
  );
}

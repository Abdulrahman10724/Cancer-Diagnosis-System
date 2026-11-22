// The single wrapper around the cds_server HTTP API. Components never call fetch.
const DEFAULT_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const STORAGE_KEY = 'pathology-bench.apiUrl';

export function getApiUrl() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

let sessionUrl = null;

export function setApiUrl(url) {
  try {
    if (url && url !== DEFAULT_URL) window.localStorage.setItem(STORAGE_KEY, url);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the URL applies to this session only
  }
  sessionUrl = url || DEFAULT_URL;
}

const baseUrl = () => (sessionUrl || getApiUrl()).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, offline = false } = {}) {
    super(message);
    this.status = status;
    this.offline = offline;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const url = baseUrl() + path;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const host = baseUrl().replace(/^https?:\/\//, '');
    throw new ApiError(`Server not reachable at ${host}. Start cds_server and try again.`, {
      offline: true,
    });
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data && data.error ? data.error : `Server answered ${response.status}.`;
    throw new ApiError(message, { status: response.status });
  }
  return data;
}

const q = encodeURIComponent;

export const api = {
  status: () => request('/status'),
  loadData: (genesFile = 'data/genes.csv', patientsFile = 'data/patients.csv') =>
    request('/load', { method: 'POST', body: { genesFile, patientsFile } }),
  patients: () => request('/patients'),
  genetic: () => request('/genetic'),
  addPatient: (patient) => request('/patients', { method: 'POST', body: patient }),
  diagnoseAll: (patientId, k) =>
    request(`/diagnose?patient_id=${q(patientId)}&model=all${k ? `&k=${k}` : ''}`),
  evaluate: () => request('/evaluate'),
  queue: () => request('/queue'),
  enqueue: (patientId) => request('/queue', { method: 'POST', body: { patient_id: patientId } }),
  processQueue: (model) => request('/queue/process', { method: 'POST', body: { model } }),
  hashmap: () => request('/hashmap'),
  searchPatient: (id) => request(`/patients/search?id=${q(id)}`),
};

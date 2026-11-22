// The only place that talks to the C++ server (docs/API.md).
const DEFAULT_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const URL_KEY = 'cds.apiUrl';

export function getApiUrl() {
  try {
    return window.localStorage.getItem(URL_KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function setApiUrl(url) {
  try {
    if (!url || url === DEFAULT_URL) window.localStorage.removeItem(URL_KEY);
    else window.localStorage.setItem(URL_KEY, url.replace(/\/+$/, ''));
  } catch {
    // Storage unavailable: the default URL keeps working
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, problems = [], offline = false } = {}) {
    super(message);
    this.status = status;
    this.problems = problems;
    this.offline = offline;
  }
}

function hostLabel(url) {
  return url.replace(/^https?:\/\//, '');
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const base = getApiUrl();
  let response;
  try {
    response = await fetch(base + path, {
      method,
      signal,
      // Never reuse or wait on the browser cache: a second identical request (e.g. two
      // benchmarks) must reach the server instead of queueing behind the first one
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      `The server is not running at ${hostLabel(base)}. Start cds_server.exe and press Retry.`,
      { offline: true },
    );
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      (data && data.error) ||
      (response.status === 413 ? 'The files are larger than 5 MB.' : `The server answered ${response.status}.`);
    throw new ApiError(message, { status: response.status, problems: (data && data.problems) || [] });
  }
  return data;
}

const q = (params) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  });
  const text = s.toString();
  return text ? `?${text}` : '';
};

export const api = {
  status: (o) => request('/status', o),
  datasets: (o) => request('/datasets', o),
  selectDataset: (name) => request('/datasets/select', { method: 'POST', body: { name } }),
  upload: (payload) => request('/upload', { method: 'POST', body: payload }),

  patients: (o) => request('/patients', o),
  addPatient: (payload) => request('/patients', { method: 'POST', body: payload }),
  deletePatient: (id) => request(`/patients/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  undo: () => request('/undo', { method: 'POST' }),
  searchList: (id) => request(`/patients/search${q({ id })}`),
  searchIndex: (id) => request(`/patients/index${q({ id })}`),
  riskRange: (min, max) => request(`/patients/range${q({ min, max })}`),
  genes: (o) => request('/genetic', o),

  diagnose: (patientId, k) => request(`/diagnose${q({ patient_id: patientId, model: 'all', k })}`),
  evaluate: (o) => request('/evaluate', o),
  crossval: (k = 5, o) => request(`/crossval${q({ k })}`, o),
  features: (o) => request('/features', o),
  tree: (o) => request('/tree', o),
  kdtree: (depth = 4, o) => request(`/kdtree${q({ depth })}`, o),

  queue: () => request('/queue'),
  enqueue: (patientId) => request('/queue', { method: 'POST', body: { patient_id: patientId } }),
  processQueue: (model = 'logistic') => request('/queue/process', { method: 'POST', body: { model } }),
  triage: () => request('/triage'),
  triagePush: (patientId) => request('/triage', { method: 'POST', body: { patient_id: patientId } }),
  triageProcess: () => request('/triage/process', { method: 'POST' }),

  graph: (eps, o) => request(`/graph${q({ eps })}`, o),
  bfs: (start, eps) => request(`/graph/bfs${q({ start, eps })}`),
  hashmap: (o) => request('/hashmap', o),
  benchmark: (n, seed = 1, o) => request(`/benchmark${q({ n, seed })}`, o),
};

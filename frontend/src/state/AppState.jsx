import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { api } from '../api/client';
import { clock } from '../lib/format';

const ACTIVITY_KEY = 'cds.activity';

function readActivity() {
  try {
    const saved = window.sessionStorage.getItem(ACTIVITY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const AppStateContext = createContext(null);

const initialState = {
  // 'checking' | 'online' | 'offline'
  server: 'checking',
  serverError: null,
  status: { modelsTrained: false, geneticCount: 0, patientCount: 0 },
  patients: [],
  genes: [],
  dataError: null,
  activity: readActivity(),
  // The patient the user is working with (Home step 2)
  selectedPatient: null,
  // Latest "all models" result per patient ID (Home step 3, report)
  results: {},
  toasts: [],
};

let toastId = 0;

function reducer(state, action) {
  switch (action.type) {
    case 'server-online':
      return { ...state, server: 'online', serverError: null, status: action.status };
    case 'server-offline':
      return { ...state, server: 'offline', serverError: action.message };
    case 'data':
      return { ...state, patients: action.patients, genes: action.genes, dataError: null };
    case 'data-error':
      return { ...state, dataError: action.message };
    case 'log':
      return {
        ...state,
        activity: [
          ...state.activity,
          { id: (state.activity.at(-1)?.id || 0) + 1, time: clock(), text: action.text },
        ],
      };
    case 'select-patient':
      return { ...state, selectedPatient: action.id };
    case 'result':
      return { ...state, results: { ...state.results, [action.id]: action.result } };
    case 'clear-results':
      return { ...state, results: {} };
    case 'toast':
      return { ...state, toasts: [...state.toasts, { id: ++toastId, text: action.text, tone: action.tone }] };
    case 'toast-done':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const log = useCallback((text) => dispatch({ type: 'log', text }), []);
  const toast = useCallback((text, tone = 'success') => dispatch({ type: 'toast', text, tone }), []);
  const dismissToast = useCallback((id) => dispatch({ type: 'toast-done', id }), []);
  const selectPatient = useCallback((id) => dispatch({ type: 'select-patient', id }), []);
  const saveResult = useCallback((id, result) => dispatch({ type: 'result', id, result }), []);
  const clearResults = useCallback(() => dispatch({ type: 'clear-results' }), []);

  // Read status, then patients and genes from the server (the only data source)
  const refresh = useCallback(async () => {
    let status;
    try {
      status = await api.status();
      dispatch({ type: 'server-online', status });
    } catch (error) {
      dispatch({ type: 'server-offline', message: error.message });
      return null;
    }
    try {
      const [patients, genes] = await Promise.all([api.patients(), api.genetic()]);
      dispatch({ type: 'data', patients, genes });
    } catch (error) {
      dispatch({ type: 'data-error', message: error.message });
    }
    return status;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While the server is offline, check again every 5 seconds
  useEffect(() => {
    if (state.server !== 'offline') return undefined;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [state.server, refresh]);

  // Keep the activity list for this browser session
  useEffect(() => {
    try {
      window.sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(state.activity));
    } catch {
      // Storage unavailable: the list still works for this page
    }
  }, [state.activity]);

  const value = useMemo(
    () => ({
      state,
      refresh,
      log,
      toast,
      dismissToast,
      selectPatient,
      saveResult,
      clearResults,
    }),
    [state, refresh, log, toast, dismissToast, selectPatient, saveResult, clearResults],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { api } from '../api/client';
import { clock } from '../lib/format';

const AppStateContext = createContext(null);

const initialState = {
  // 'checking' | 'online' | 'offline'
  server: 'checking',
  serverError: null,
  status: { modelsTrained: false, geneticCount: 0, patientCount: 0 },
  patients: [],
  genes: [],
  dataError: null,
  notebook: [],
  // Patients loaded into the gel wells (max 3) and their latest results
  gelSlots: [],
};

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
        notebook: [...state.notebook, { id: state.notebook.length + 1, time: clock(), text: action.text }],
      };
    case 'gel-load':
      if (state.gelSlots.includes(action.id) || state.gelSlots.length >= 3) return state;
      return { ...state, gelSlots: [...state.gelSlots, action.id] };
    case 'gel-unload':
      return { ...state, gelSlots: state.gelSlots.filter((id) => id !== action.id) };
    default:
      return state;
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const log = useCallback((text) => dispatch({ type: 'log', text }), []);

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

  const value = useMemo(
    () => ({
      state,
      refresh,
      log,
      loadIntoGel: (id) => dispatch({ type: 'gel-load', id }),
      unloadFromGel: (id) => dispatch({ type: 'gel-unload', id }),
    }),
    [state, refresh, log],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}

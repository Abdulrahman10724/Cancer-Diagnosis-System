import { useCallback, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { MODELS } from '../lib/models';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Count "cancer" votes from the models (prediction uses the 50% line)
export function votesOf(result) {
  return MODELS.reduce((n, m) => n + (result.models[m.key].prediction === 1 ? 1 : 0), 0);
}

export function averageRisk(result) {
  return MODELS.reduce((sum, m) => sum + result.models[m.key].risk, 0) / MODELS.length;
}

/*
 * Runs "Check risk" for one patient and drives the explaining animation:
 *   flowing   - the patient's gene scores move into the four model cards
 *   analyzing - each card waits for the server (the real request runs meanwhile)
 *   resolving - cards fill one after another, 150ms apart
 *   voting    - the final result counts the cancer votes
 *   done
 * With reduced motion the result appears at once.
 */
export default function useRiskRun() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [votesShown, setVotesShown] = useState(0);
  const [error, setError] = useState(null);
  const [k, setK] = useState(5);
  const runId = useRef(0);

  const run = useCallback(
    async (patientId, kValue = 5) => {
      const id = ++runId.current;
      const alive = () => id === runId.current;
      setError(null);
      setResult(null);
      setRevealed(0);
      setVotesShown(0);
      setK(kValue);
      const request = api.diagnoseAll(patientId, kValue);
      try {
        if (reduceMotion) {
          const data = await request;
          if (!alive()) return null;
          setResult(data);
          setRevealed(MODELS.length);
          setVotesShown(votesOf(data));
          setPhase('done');
          return data;
        }
        setPhase('flowing');
        await wait(450);
        if (!alive()) return null;
        setPhase('analyzing');
        const [data] = await Promise.all([request, wait(350)]);
        if (!alive()) return null;
        setResult(data);
        setPhase('resolving');
        for (let i = 1; i <= MODELS.length; i++) {
          setRevealed(i);
          await wait(150);
        }
        await wait(300);
        if (!alive()) return null;
        setPhase('voting');
        const votes = votesOf(data);
        for (let v = 1; v <= votes; v++) {
          setVotesShown(v);
          await wait(160);
        }
        if (!alive()) return null;
        setPhase('done');
        return data;
      } catch (e) {
        if (alive()) {
          setError(e);
          setPhase('error');
        }
        return null;
      }
    },
    [reduceMotion],
  );

  // Re-run only KNN with a new K; the bar animates to the new value
  const changeK = useCallback(async (patientId, kValue) => {
    setK(kValue);
    try {
      const data = await api.diagnoseAll(patientId, kValue);
      setResult((prev) =>
        prev ? { ...prev, models: { ...prev.models, knn: data.models.knn } } : data,
      );
      setVotesShown(votesOf(data));
      return data;
    } catch (e) {
      setError(e);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setPhase('idle');
    setResult(null);
    setError(null);
  }, []);

  return { phase, result, revealed, votesShown, error, k, run, changeK, reset };
}

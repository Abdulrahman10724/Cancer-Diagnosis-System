import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { scaleLinear } from 'd3-scale';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { modelByKey } from '../lib/models';
import { bandShape, certainty, pct } from '../lib/format';
import SpecimenLabel from '../components/SpecimenLabel';
import Band from '../components/Band';
import Lane, { OutcomeTag } from '../components/Lane';
import Drawer from '../components/Drawer';
import Explain from '../components/Explain';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import gelStyles from '../components/Gel.module.css';
import screen from './Screen.module.css';
import styles from './Gel.module.css';

const TRACK_H = 400;
const K_OPTIONS = [1, 3, 5, 7, 9];
const LADDER = [0.1, 0.3, 0.5, 0.7, 0.9];
const y = scaleLinear().domain([0, 1]).range([28, TRACK_H - 28]);
const LANE_ORDER = ['logistic', 'knn', 'decision_tree', 'naive_bayes'];

function TrayItem({ patient, loaded, full, onLoad }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: patient.patient_id,
    disabled: loaded || full,
  });
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        className={`${styles.trayItem} ${isDragging ? styles.dragging : ''}`}
        onClick={() => onLoad(patient.patient_id)}
        disabled={loaded || full}
        aria-label={
          loaded
            ? `${patient.patient_id} is in the gel`
            : `Load ${patient.patient_id}, ${patient.name}, into the next well`
        }
        {...listeners}
        {...attributes}
        role={undefined}
        aria-describedby={undefined}
      >
        <SpecimenLabel id={patient.patient_id} name={patient.name} compact />
        {loaded && <span className={styles.inGel}>In gel</span>}
      </button>
    </li>
  );
}

function WellSlots({ slots, patients, onUnload }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'wells' });
  return (
    <div ref={setNodeRef} className={`${styles.slots} ${isOver ? styles.slotsOver : ''}`}>
      {[0, 1, 2].map((i) => {
        const id = slots[i];
        const patient = patients.find((p) => p.patient_id === id);
        return (
          <div key={i} className={`${styles.slot} ${id ? styles.slotFilled : ''}`}>
            {id ? (
              <>
                <span>
                  <strong>{id}</strong>
                  {patient && <span className={styles.slotName}> {patient.name}</span>}
                </span>
                <button type="button" className="btn btn-quiet" onClick={() => onUnload(id)}>
                  Remove<span className="visually-hidden"> {id} from the gel</span>
                </button>
              </>
            ) : (
              <span className={styles.slotEmpty}>Well {i + 1} empty</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KControl({ value, onChange, patientId }) {
  const onKeyDown = (event) => {
    const i = K_OPTIONS.indexOf(value);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(K_OPTIONS[Math.min(K_OPTIONS.length - 1, i + 1)]);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(K_OPTIONS[Math.max(0, i - 1)]);
    }
  };
  return (
    <div className={gelStyles.kControl}>
      <span className={gelStyles.kLabel} id={`k-${patientId}`}>
        <span className={gelStyles.swatch} style={{ background: 'var(--gel-knn)' }} aria-hidden="true" />
        KNN neighbors (K)
      </span>
      <div className={gelStyles.kOptions} role="radiogroup" aria-labelledby={`k-${patientId}`} onKeyDown={onKeyDown}>
        {K_OPTIONS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === value}
            tabIndex={k === value ? 0 : -1}
            className={gelStyles.kOption}
            onClick={() => onChange(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function PatientGroup({ id, patient, result, k, runId, groupIndex, onK, onOpen }) {
  const votes = result.consensus.cancer;
  const meanRisk = LANE_ORDER.reduce((sum, key) => sum + result.models[key].risk, 0) / 4;
  return (
    <div className={gelStyles.group}>
      <div className={gelStyles.groupHead}>
        <span className={gelStyles.groupTitle}>
          {id}
          {patient && <span className={gelStyles.groupName}> {patient.name}</span>}
        </span>
        <KControl value={k} onChange={(value) => onK(id, value)} patientId={id} />
      </div>
      <div className={gelStyles.lanes}>
        {LANE_ORDER.map((key, laneIndex) => {
          const model = modelByKey(key);
          const m = result.models[key];
          return (
            <Lane
              key={key}
              title={key === 'knn' ? `KNN, K=${m.k}` : model.short}
              swatch={model.gel}
              footer={<OutcomeTag prediction={m.prediction} />}
            >
              <Band
                key={`${runId}-${key}`}
                risk={m.risk}
                color={model.gel}
                y={y(m.risk)}
                wellY={0}
                migrate
                delay={(laneIndex + groupIndex) * 0.08}
                ariaLabel={`${model.name}, ${id}: ${pct(m.risk)} risk, ${m.prediction === 1 ? 'cancerous' : 'non-cancerous'}. Open the explanation.`}
                onClick={() => onOpen(id, key)}
              />
            </Lane>
          );
        })}
        <Lane
          wide
          title="Consensus"
          swatch="var(--gel-consensus)"
          footer={<span>{votes} of 4 say cancerous</span>}
        >
          <Band
            key={`${runId}-consensus`}
            risk={meanRisk}
            color="var(--gel-consensus)"
            y={y(meanRisk)}
            wellY={0}
            migrate
            delay={(4 + groupIndex) * 0.08}
            label={`Mean ${pct(meanRisk)}`}
            ariaLabel={`Consensus for ${id}: ${votes} of 4 models say cancerous, mean risk ${pct(meanRisk)}`}
          />
        </Lane>
      </div>
    </div>
  );
}

function notebookLine(id, result) {
  const votes = result.consensus.cancer;
  const uncertain = LANE_ORDER.filter((key) => certainty(result.models[key].risk) < 0.25).map((key) => {
    const m = result.models[key];
    if (key === 'knn') return `KNN uncertain (votes ${m.explain.votesCancer}–${m.explain.votesSafe})`;
    return `${modelByKey(key).short} uncertain (${pct(m.risk)})`;
  });
  const split = votes === 2 ? ' Models disagree.' : '';
  return `${id} gel run: ${votes} of 4 cancerous.${split}${uncertain.length ? ` ${uncertain.join(', ')}.` : ''}`;
}

export default function Gel() {
  const { state, log, loadIntoGel, unloadFromGel } = useAppState();
  const [results, setResults] = useState({});
  const [kValues, setKValues] = useState({});
  const [runId, setRunId] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [dragId, setDragId] = useState(null);
  const [drawer, setDrawer] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const slots = state.gelSlots;
  const full = slots.length >= 3;

  const tray = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return state.patients.filter(
      (p) => !f || p.patient_id.toLowerCase().includes(f) || p.name.toLowerCase().includes(f),
    );
  }, [state.patients, filter]);

  const runGel = async () => {
    setRunning(true);
    setError(null);
    try {
      const entries = await Promise.all(
        slots.map(async (id) => [id, await api.diagnoseAll(id, kValues[id] || 5)]),
      );
      const next = Object.fromEntries(entries);
      setResults(next);
      setRunId((r) => r + 1);
      entries.forEach(([id, result]) => log(notebookLine(id, result)));
    } catch (e) {
      setError(e);
    } finally {
      setRunning(false);
    }
  };

  const changeK = async (id, k) => {
    setKValues((prev) => ({ ...prev, [id]: k }));
    try {
      const result = await api.diagnoseAll(id, k);
      setResults((prev) => ({ ...prev, [id]: result }));
      const knn = result.models.knn;
      log(`${id} KNN with K=${k}: votes ${knn.explain.votesCancer}–${knn.explain.votesSafe}, ${pct(knn.risk)}.`);
    } catch (e) {
      setError(e);
    }
  };

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const onDragEnd = (event) => {
    setDragId(null);
    if (event.over && event.over.id === 'wells') loadIntoGel(event.active.id);
  };

  const ran = slots.filter((id) => results[id]);
  const drawerData = drawer && results[drawer.id];
  const drawerModel = drawer && modelByKey(drawer.model);

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Gel</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Gel</h1>
        <p className={screen.lede}>
          Each lane is one model. A band sinks further the higher that model puts the cancer
          risk. Load up to three patients side by side.
        </p>
      </div>

      {state.server === 'checking' && <LoadingState />}

      {state.server === 'online' && !state.status.modelsTrained && (
        <EmptyState
          title="Models are not trained yet"
          action={
            <Link className="btn btn-primary" to="/setup">
              Go to Setup
            </Link>
          }
        >
          Load the data on Setup, then come back to run a gel.
        </EmptyState>
      )}

      {state.server === 'online' && state.status.modelsTrained && (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDragId(e.active.id)}
          onDragCancel={() => setDragId(null)}
          onDragEnd={onDragEnd}
        >
          <div className={styles.loading}>
            <section className={styles.trayPanel} aria-labelledby="tray-heading">
              <div className={styles.trayHead}>
                <h2 id="tray-heading">Sample tray</h2>
                <div className="field">
                  <label htmlFor="tray-filter" className="visually-hidden">
                    Find a patient
                  </label>
                  <input
                    id="tray-filter"
                    className="input"
                    placeholder="Find by ID or name"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </div>
              <p className="hint">
                Drag a label onto the wells, or select it and press Enter.
              </p>
              {tray.length === 0 ? (
                <p className="hint">
                  {state.patients.length === 0 ? (
                    <>No patients yet. <Link to="/accession">Add one from Accession</Link>.</>
                  ) : (
                    'No patient matches that search.'
                  )}
                </p>
              ) : (
                <ul className={styles.tray}>
                  {tray.map((p) => (
                    <TrayItem
                      key={p.patient_id}
                      patient={p}
                      loaded={slots.includes(p.patient_id)}
                      full={full}
                      onLoad={loadIntoGel}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.wellsPanel} aria-labelledby="wells-heading">
              <h2 id="wells-heading">Wells</h2>
              <WellSlots slots={slots} patients={state.patients} onUnload={unloadFromGel} />
              <div className={screen.row}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runGel}
                  disabled={slots.length === 0 || running}
                >
                  {running ? 'Running gel…' : 'Run gel'}
                </button>
                {slots.length === 0 && <span className="hint">Load at least one sample.</span>}
              </div>
            </section>
          </div>

          <DragOverlay>
            {dragId ? (
              <div className={styles.overlay}>
                <SpecimenLabel
                  id={dragId}
                  name={(state.patients.find((p) => p.patient_id === dragId) || {}).name}
                  compact
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {error && (
        <ErrorState
          title="Gel not run"
          message={error.message}
          command={error.offline ? START_COMMAND : undefined}
        />
      )}

      {ran.length > 0 && (
        <section className={screen.section} aria-labelledby="gel-heading">
          <h2 id="gel-heading" className="visually-hidden">
            Gel results
          </h2>
          <div
            className={gelStyles.bench}
            style={{ '--track-h': `${TRACK_H}px` }}
            tabIndex={0}
            role="region"
            aria-label="Gel results. Scroll sideways to see all lanes."
          >
            <div className={gelStyles.gel}>
              <div
                className={gelStyles.threshold}
                style={{ top: 48 + 8 + 48 + y(0.5) }}
                aria-hidden="true"
              />
              <div className={gelStyles.ladder} aria-hidden="true">
                <div className={gelStyles.ladderHead}>Ladder</div>
                <div className={gelStyles.ladderTrack}>
                  <span className={gelStyles.ladderEnd} style={{ top: 0 }}>0 safe</span>
                  {LADDER.map((v) => (
                    <span key={v} className={gelStyles.ladderMark} style={{ top: y(v) }}>
                      <span className={gelStyles.ladderNum}>
                        {v === 0.5 ? 'Threshold 0.5' : v.toFixed(1)}
                      </span>
                    </span>
                  ))}
                  <span className={gelStyles.ladderEnd} style={{ bottom: 0 }}>1 cancer</span>
                </div>
              </div>
              {ran.map((id, groupIndex) => (
                <PatientGroup
                  key={id}
                  id={id}
                  patient={state.patients.find((p) => p.patient_id === id)}
                  result={results[id]}
                  k={kValues[id] || 5}
                  runId={runId}
                  groupIndex={groupIndex}
                  onK={changeK}
                  onOpen={(pid, model) => setDrawer({ id: pid, model })}
                />
              ))}
            </div>
          </div>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendBand} style={{ height: bandShape(0.02).height }} />
              Sharp band = confident
            </span>
            <span className={styles.legendItem}>
              <span
                className={styles.legendBand}
                style={{ height: bandShape(0.5).height, filter: `blur(${bandShape(0.5).blur}px)` }}
              />
              Smeared band = uncertain
            </span>
            <span className="hint">Select a band to see why the model placed it there.</span>
          </div>
          <div className={screen.row}>
            {ran.map((id) => (
              <Link key={id} className="btn" to={`/report/${encodeURIComponent(id)}`}>
                Open report for {id}
              </Link>
            ))}
            <Link className="btn btn-quiet" to="/proficiency">
              How accurate is each model?
            </Link>
          </div>
        </section>
      )}

      <p className={screen.footer}>Educational project — not for clinical use.</p>

      <Drawer
        open={Boolean(drawerData)}
        title={drawerModel ? `${drawerModel.name}: ${drawer.id}` : ''}
        onClose={closeDrawer}
      >
        {drawerData && <Explain model={drawer.model} data={drawerData} genes={state.genes} />}
      </Drawer>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { bucketFor } from '../lib/hash';
import { fixed, score } from '../lib/format';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import screen from './Screen.module.css';
import styles from './Freezer.module.css';

const BOX = 64; // positions per freezer box (8 x 8)
const SIDE = 8;

export default function Freezer() {
  const { state, log } = useAppState();
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null);
  const [box, setBox] = useState(0);
  const [selected, setSelected] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [trace, setTrace] = useState(null);

  useEffect(() => {
    if (state.server !== 'online') return undefined;
    let cancelled = false;
    api
      .hashmap()
      .then((m) => !cancelled && setMap(m))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [state.server, state.status.geneticCount]);

  const stats = useMemo(() => {
    if (!map) return null;
    const lengths = map.buckets.map((b) => b.items.length);
    return {
      collisions: lengths.filter((n) => n > 1).length,
      empty: lengths.filter((n) => n === 0).length,
      longest: Math.max(0, ...lengths),
    };
  }, [map]);

  const runTrace = (event) => {
    event.preventDefault();
    const key = keyInput.trim();
    if (!key || !map) return;
    const { hash, index } = bucketFor(key, map.bucketCount);
    const bucket = map.buckets[index];
    const position = bucket.items.findIndex((item) => item.key === key);
    setTrace({ key, hash, index, position, length: bucket.items.length });
    setBox(Math.floor(index / BOX));
    setSelected(index);
    log(
      position >= 0
        ? `Freezer trace ${key}: bucket ${index}, found at chain position ${position + 1}.`
        : `Freezer trace ${key}: bucket ${index}, key not stored.`,
    );
  };

  const onGridKey = (event) => {
    const start = box * BOX;
    const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: SIDE, ArrowUp: -SIDE };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const current = selected === null || selected < start || selected >= start + BOX ? start : selected + keys[event.key];
    setSelected(Math.max(start, Math.min(start + BOX - 1, current)));
  };

  if (state.server === 'offline') {
    return (
      <div className={screen.screen}>
        <div className={screen.head}>
          <h1>Freezer</h1>
        </div>
        <ErrorState title="Server not running" message={state.serverError} command={START_COMMAND} />
      </div>
    );
  }

  const boxes = map ? Math.ceil(map.bucketCount / BOX) : 0;
  const selectedBucket = map && selected !== null ? map.buckets[selected] : null;

  return (
    <div className={screen.screen}>
      <div className={screen.head}>
        <h1>Freezer</h1>
        <p className={screen.lede}>
          The mutation index is a hash table. A gene ID is hashed to a bucket number, the
          position in the freezer. Two genes in one position are a collision; they share the
          slot as a chain.
        </p>
      </div>

      {error && <ErrorState title="Freezer index not available" message={error.message} command={error.offline ? START_COMMAND : undefined} />}
      {!map && !error && <LoadingState>Reading the freezer index…</LoadingState>}

      {map && map.size === 0 && (
        <EmptyState
          title="The freezer is empty"
          action={
            <Link className="btn btn-primary" to="/setup">
              Go to Setup
            </Link>
          }
        >
          Load the data on Setup to store the genes.
        </EmptyState>
      )}

      {map && map.size > 0 && (
        <>
          <dl className={styles.stats}>
            <div><dt>Genes stored</dt><dd className="num">{map.size}</dd></div>
            <div><dt>Buckets</dt><dd className="num">{map.bucketCount}</dd></div>
            <div><dt>Load factor</dt><dd className="num">{fixed(map.loadFactor, 2)}</dd></div>
            <div><dt>Collisions</dt><dd className="num">{stats.collisions}</dd></div>
            <div><dt>Longest chain</dt><dd className="num">{stats.longest}</dd></div>
          </dl>
          <p className="hint">
            The table doubles its buckets when the load factor passes 0.75, so chains stay
            short.
          </p>

          <form className={styles.trace} onSubmit={runTrace}>
            <div className="field">
              <label htmlFor="trace-key">Gene ID</label>
              <input
                id="trace-key"
                className="input"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="GENE_014"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!keyInput.trim()}>
              Trace key
            </button>
          </form>

          {trace && (
            <ol className={styles.steps} aria-live="polite">
              <li>
                h = h × 31 + character code, for each character of &quot;{trace.key}&quot;
              </li>
              <li className="num">
                hash(&quot;{trace.key}&quot;) = {trace.hash.toString()}
              </li>
              <li className="num">
                {trace.hash.toString()} mod {map.bucketCount} = <strong>{trace.index}</strong>
              </li>
              <li>
                {trace.position >= 0
                  ? `Found in bucket ${trace.index}, position ${trace.position + 1} of ${trace.length} in its chain.`
                  : `Bucket ${trace.index} holds ${trace.length} ${trace.length === 1 ? 'key' : 'keys'}; ${trace.key} is not one of them.`}
              </li>
            </ol>
          )}

          <div className={styles.boxTabs} role="group" aria-label="Freezer boxes">
            {Array.from({ length: boxes }, (_, b) => (
              <button
                key={b}
                type="button"
                className="btn"
                aria-pressed={box === b}
                onClick={() => setBox(b)}
              >
                Box {b + 1}
                <span className={styles.range}>
                  {b * BOX}–{Math.min(map.bucketCount, (b + 1) * BOX) - 1}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.layout}>
            <div
              className={styles.box}
              tabIndex={0}
              role="group"
              aria-label={`Box ${box + 1}, buckets ${box * BOX} to ${(box + 1) * BOX - 1}. Use the arrow keys to read each position.`}
              aria-describedby="bucket-detail"
              onKeyDown={onGridKey}
              onFocus={() => (selected === null || Math.floor(selected / BOX) !== box) && setSelected(box * BOX)}
            >
              {map.buckets.slice(box * BOX, (box + 1) * BOX).map((bucket) => {
                const isSelected = selected === bucket.index;
                const isTraced = trace && trace.index === bucket.index;
                return (
                  <span
                    key={bucket.index}
                    className={`${styles.cell} ${isSelected ? styles.selected : ''} ${isTraced ? styles.traced : ''}`}
                    onClick={() => setSelected(bucket.index)}
                    aria-hidden="true"
                  >
                    <span className={styles.cellNum}>{bucket.index}</span>
                    <span className={styles.tubes}>
                      {bucket.items.slice(0, 3).map((item) => (
                        <span key={item.key} className={styles.tubeTop} />
                      ))}
                    </span>
                    {bucket.items.length > 3 && <span className={styles.more}>+{bucket.items.length - 3}</span>}
                  </span>
                );
              })}
            </div>

            <div id="bucket-detail" className={styles.detail} aria-live="polite">
              {selectedBucket ? (
                <>
                  <h2 className={styles.detailTitle}>Bucket {selectedBucket.index}</h2>
                  {selectedBucket.items.length === 0 ? (
                    <p className="hint">Empty position.</p>
                  ) : (
                    <>
                      <p className="hint">
                        {selectedBucket.items.length === 1
                          ? 'One gene in this position.'
                          : `${selectedBucket.items.length} genes share this position (a collision), chained in order:`}
                      </p>
                      <ol className={styles.chainList}>
                        {selectedBucket.items.map((item) => (
                          <li key={item.key}>
                            <strong>{item.key}</strong> score {score(item.value)}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </>
              ) : (
                <p className="hint">Select a position, or trace a gene ID.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

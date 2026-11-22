import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api } from '../api/client';
import { useAppState } from '../state/AppState';
import { bucketFor } from '../lib/hash';
import { score } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Help from '../components/Help';
import { EmptyState, ErrorState, LoadingState, START_COMMAND } from '../components/States';
import styles from './HashTable.module.css';

const PAGE = 64;

export default function HashTable() {
  const { state, log } = useAppState();
  const reduceMotion = useReducedMotion();
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [input, setInput] = useState('');
  const [trace, setTrace] = useState(null);
  const [stage, setStage] = useState(0);

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

  const shared = useMemo(() => (map ? map.buckets.filter((b) => b.items.length > 1).length : 0), [map]);

  // Reveal the lookup steps one after another
  useEffect(() => {
    if (!trace) return undefined;
    if (reduceMotion) {
      setStage(4);
      return undefined;
    }
    setStage(1);
    const timers = [2, 3, 4].map((s, i) => setTimeout(() => setStage(s), (i + 1) * 450));
    return () => timers.forEach(clearTimeout);
  }, [trace, reduceMotion]);

  const lookup = (e) => {
    e.preventDefault();
    const key = input.trim();
    if (!key || !map) return;
    const { hash, index } = bucketFor(key, map.bucketCount);
    const box = map.buckets[index];
    const item = box.items.find((it) => it.key === key) || null;
    setTrace({ key, hash, index, item, count: box.items.length, n: Date.now() });
    setPage(Math.floor(index / PAGE));
    setSelected(index);
    log(item ? `Looked up gene ${key}: box ${index}, found in 1 step.` : `Looked up gene ${key}: box ${index}, gene not stored.`);
  };

  const pages = map ? Math.ceil(map.bucketCount / PAGE) : 0;
  const selectedBox = map && selected !== null ? map.buckets[selected] : null;
  const showTrace = trace && map;

  const onGridKey = (e) => {
    const start = page * PAGE;
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const cur = selected === null || selected < start || selected >= start + PAGE ? start : selected + moves[e.key];
    setSelected(Math.max(start, Math.min(start + PAGE - 1, cur)));
  };

  return (
    <div>
      <PageHeader
        title="Gene lookup (hash table)"
        purpose="Genes are stored in a hash table. A formula turns the gene name into a box number, so the program can jump straight to the right box instead of searching everything."
      />

      {error && <ErrorState title="Could not read the gene boxes" message={error.offline ? 'The server is not running. Start cds_server and press Retry.' : error.message} command={error.offline ? START_COMMAND : undefined} />}
      {!map && !error && state.server === 'online' && <LoadingState lines={4}>Reading the gene boxes…</LoadingState>}
      {map && map.size === 0 && (
        <EmptyState title="No genes stored yet" action={<Link className="btn btn-primary" to="/start" state={{ autoLoad: true }}>Load data</Link>}>
          Load the data to fill the boxes.
        </EmptyState>
      )}

      {map && map.size > 0 && (
        <>
          <p className={styles.stats}>
            {map.size} genes in {map.bucketCount} boxes, {shared} boxes shared.
            <Help term="Shared box (collision)">
              Sometimes two gene names give the same box number. Both genes are then kept in that
              box, one after the other. This is called a collision. The table gets more boxes when
              it fills up, so this stays rare.
            </Help>
          </p>

          <form className={styles.lookup} onSubmit={lookup}>
            <div className="field">
              <label htmlFor="gene-key">Gene ID</label>
              <input id="gene-key" className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="GENE_014" autoComplete="off" />
            </div>
            <button type="submit" className="btn btn-primary btn-large" disabled={!input.trim()}>
              Look up gene
            </button>
          </form>

          {showTrace && (
            <ol className={styles.steps} aria-live="polite" key={trace.n}>
              {[
                <>
                  <span className={styles.stepLabel}>Gene name</span>
                  <strong>{trace.key}</strong>
                </>,
                <>
                  <span className={styles.stepLabel}>Formula</span>
                  <span>
                    Each letter is turned into a number and mixed in (h = h × 31 + letter):{' '}
                    <strong className={styles.wrap}>{trace.hash.toString()}</strong>
                  </span>
                </>,
                <>
                  <span className={styles.stepLabel}>Box number</span>
                  <span>
                    Divide by {map.bucketCount} boxes and keep the remainder: <strong>box {trace.index}</strong>
                  </span>
                </>,
                trace.item ? (
                  <>
                    <span className={styles.stepLabel}>Result</span>
                    <span className={styles.foundText}>Found in 1 step</span>
                  </>
                ) : (
                  <>
                    <span className={styles.stepLabel}>Result</span>
                    <span className={styles.missText}>Box {trace.index} does not contain {trace.key}. It is not stored.</span>
                  </>
                ),
              ].map((content, i) => (
                <AnimatePresence key={i}>
                  {stage > i && (
                    <motion.li
                      className={styles.step}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {content}
                    </motion.li>
                  )}
                </AnimatePresence>
              ))}
            </ol>
          )}

          <AnimatePresence>
            {showTrace && stage >= 4 && trace.item && (
              <motion.div
                className={styles.geneCard}
                initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
              >
                <strong>{trace.item.key}</strong>
                <span>Mutation score {score(trace.item.value)}</span>
                <span className="hint">
                  The patient list needs to walk patient by patient. Here the program went straight to the right box.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.pager} role="group" aria-label="Box pages">
            {Array.from({ length: pages }, (_, p) => (
              <button key={p} type="button" className="btn" aria-pressed={page === p} onClick={() => setPage(p)}>
                Boxes {p * PAGE}–{Math.min(map.bucketCount, (p + 1) * PAGE) - 1}
              </button>
            ))}
          </div>

          <div className={styles.layout}>
            <div
              className={styles.grid}
              tabIndex={0}
              role="group"
              aria-label={`Boxes ${page * PAGE} to ${(page + 1) * PAGE - 1}. Use the arrow keys to look inside each box.`}
              aria-describedby="box-detail"
              onKeyDown={onGridKey}
              onFocus={() => (selected === null || Math.floor(selected / PAGE) !== page) && setSelected(page * PAGE)}
            >
              {map.buckets.slice(page * PAGE, (page + 1) * PAGE).map((box) => {
                const isShared = box.items.length > 1;
                const isTraced = showTrace && stage >= 3 && trace.index === box.index;
                return (
                  <span
                    key={box.index}
                    aria-hidden="true"
                    onClick={() => setSelected(box.index)}
                    className={[
                      styles.box,
                      box.items.length ? styles.filled : '',
                      isShared ? styles.shared : '',
                      selected === box.index ? styles.selected : '',
                      isTraced ? styles.traced : '',
                    ].join(' ')}
                  >
                    <span className={styles.boxNum}>{box.index}</span>
                    <span className={styles.dots}>
                      {box.items.slice(0, 3).map((it) => (
                        <span key={it.key} className={styles.geneDot} />
                      ))}
                    </span>
                  </span>
                );
              })}
            </div>

            <div id="box-detail" className={styles.detail} aria-live="polite">
              {selectedBox ? (
                <>
                  <h2 className={styles.detailTitle}>Box {selectedBox.index}</h2>
                  {selectedBox.items.length === 0 && <p className="hint">Empty box.</p>}
                  {selectedBox.items.length === 1 && <p className="hint">One gene in this box.</p>}
                  {selectedBox.items.length > 1 && (
                    <p className="hint">Shared box (collision): {selectedBox.items.length} genes got the same box number.</p>
                  )}
                  <ul className={styles.items}>
                    {selectedBox.items.map((it) => (
                      <li key={it.key}>
                        <strong>{it.key}</strong> score {score(it.value)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="hint">Click a box, or look up a gene, to see what is inside.</p>
              )}
              <div className={styles.legend} aria-hidden="true">
                <span><span className={`${styles.box} ${styles.legendBox}`} /> Empty</span>
                <span><span className={`${styles.box} ${styles.filled} ${styles.legendBox}`}><span className={styles.geneDot} /></span> One gene</span>
                <span><span className={`${styles.box} ${styles.filled} ${styles.shared} ${styles.legendBox}`}><span className={styles.geneDot} /><span className={styles.geneDot} /></span> Shared box (collision)</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import { metroLayout } from '../lib/geometry';
import { LINES } from '../lib/metro';
import { LockGlyph, CheckGlyph, TrainGlyph } from './Icons';
import styles from './MetroDiagram.module.css';

const INTERCHANGE = new Set(['train', 'predict', 'benchmark']);
const dsCount = (id) => LINES.filter((l) => l.stops.includes(id)).length;

/**
 * The night metro map.
 * mode "hero": decorative, draws once. mode "map": stations and lines are interactive.
 * states: { [stationId]: 'done' | 'current' | 'locked' }
 */
export default function MetroDiagram({
  orientation = 'horizontal',
  mode = 'map',
  draw = true,
  speed = 1,
  states = {},
  currentId = null,
  activeLine = null,
  onLineEnter,
  onLineLeave,
  onLineSelect,
  onStation,
  title,
}) {
  const reduce = useReducedMotion();
  const animate = draw && !reduce;
  const L = metroLayout(orientation);
  const horizontal = L.orientation === 'horizontal';
  const interactive = mode === 'map';

  // Timing (seconds): core first, each data-structure line staggered 120ms
  const coreDur = 0.8 * speed;
  const lineDelay = (j) => 0.3 * speed + j * 0.12;
  const lineDur = 0.75 * speed;
  const along = (p, start, length) => (horizontal ? p.x - start : p.y - start) / length;
  const coreStart = horizontal ? 192 : 138;
  const trackStart = horizontal ? 192 : 138;

  const pathAnim = (delay, duration) =>
    animate
      ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { delay, duration, ease: 'easeInOut' } }
      : {};
  const popAnim = (delay) =>
    animate
      ? { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { delay, duration: 0.22 } }
      : {};
  const fadeAnim = (delay) =>
    animate ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 0.3 } } : {};
  const drawEnd = lineDelay(LINES.length - 1) + lineDur;

  const lineOpacity = (key) => (activeLine && activeLine !== key ? 0.25 : 1);
  const keyActivate = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const current = L.stations.find((s) => s.id === currentId);

  // Core segments leading into a locked station are dashed
  const lockedSegments = L.stations
    .map((s, i) => (i > 0 && states[s.id] === 'locked' ? [L.stations[i - 1], s] : null))
    .filter(Boolean);

  return (
    <svg
      className={`${styles.svg} ${interactive ? styles.interactive : ''}`}
      viewBox={`0 0 ${L.width} ${L.height}`}
      role={interactive ? 'group' : 'img'}
      aria-label={title}
    >
      {/* Data-structure lines: connectors, track, stop dots, name */}
      {L.tracks.map((t, j) => {
        const lineProps = interactive
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': `${t.name} line. Stops at ${t.stops.map((s) => cap(s.id)).join(', ')}. Press Enter for details.`,
              'aria-pressed': activeLine === t.key,
              onMouseEnter: () => onLineEnter?.(t.key),
              onMouseLeave: () => onLineLeave?.(t.key),
              onFocus: () => onLineEnter?.(t.key),
              onBlur: () => onLineLeave?.(t.key),
              onClick: () => onLineSelect?.(t.key),
              onKeyDown: keyActivate(() => onLineSelect?.(t.key)),
            }
          : {};
        const glow = activeLine === t.key;
        return (
          <g
            key={t.key}
            className={`${styles.line} ${glow ? styles.glow : ''}`}
            style={{ opacity: lineOpacity(t.key), '--c': t.night }}
            {...lineProps}
          >
            {/* wide invisible hit area */}
            {interactive && <path d={t.d} className={styles.hit} />}
            {t.stops.map((s) => (
              <motion.path
                key={s.id}
                d={s.connector}
                className={styles.connector}
                {...fadeAnim(lineDelay(j) + along(s, trackStart, t.length) * lineDur)}
              />
            ))}
            <motion.path d={t.d} className={styles.track} {...pathAnim(lineDelay(j), lineDur)} />
            {t.stops.map((s) => (
              <motion.circle
                key={`dot-${s.id}`}
                cx={s.x}
                cy={s.y}
                r={6}
                className={styles.stopDot}
                style={{ transformOrigin: `${s.x}px ${s.y}px` }}
                {...popAnim(lineDelay(j) + along(s, trackStart, t.length) * lineDur)}
              />
            ))}
            <motion.text
              x={t.label.x}
              y={t.label.y}
              textAnchor={t.label.anchor}
              className={styles.lineName}
              transform={t.label.rotate ? `rotate(-90 ${t.label.x} ${t.label.y})` : undefined}
              {...fadeAnim(lineDelay(j))}
            >
              {t.name}
            </motion.text>
          </g>
        );
      })}

      {/* Core line */}
      <g
        className={styles.line}
        style={{ opacity: lineOpacity('core'), '--c': 'var(--rail)' }}
        {...(interactive
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': 'Core line: linked list, queue, stack and arrays. Stops at every station. Press Enter for details.',
              'aria-pressed': activeLine === 'core',
              onMouseEnter: () => onLineEnter?.('core'),
              onMouseLeave: () => onLineLeave?.('core'),
              onFocus: () => onLineEnter?.('core'),
              onBlur: () => onLineLeave?.('core'),
              onClick: () => onLineSelect?.('core'),
              onKeyDown: keyActivate(() => onLineSelect?.('core')),
            }
          : {})}
      >
        {interactive && <path d={L.core.d} className={styles.hit} />}
        <motion.path
          d={L.core.d}
          className={`${styles.core} ${activeLine === 'core' ? styles.glowPath : ''}`}
          {...pathAnim(0, coreDur)}
        />
        <motion.text
          x={L.core.label.x}
          y={L.core.label.y}
          textAnchor={L.core.label.anchor}
          className={styles.lineName}
          transform={L.core.label.rotate ? `rotate(-90 ${L.core.label.x} ${L.core.label.y})` : undefined}
          {...fadeAnim(0)}
        >
          Core line
        </motion.text>
      </g>

      {lockedSegments.map(([a, b]) => (
        <motion.path
          key={`lock-${b.id}`}
          d={horizontal ? `M${a.x + 16},${a.y} H${b.x - 16}` : `M${a.x},${a.y + 16} V${b.y - 16}`}
          className={styles.dashMask}
          {...fadeAnim(animate ? drawEnd : 0)}
        />
      ))}

      {/* Stations */}
      {L.stations.map((s) => {
        const state = states[s.id] || (interactive ? 'locked' : 'open');
        const capsule = INTERCHANGE.has(s.id);
        const delay = along(s, coreStart, L.core.length) * coreDur;
        const label = L.stationLabel(s);
        const number = L.stationNumber(s);
        const stationProps = interactive
          ? {
              role: 'link',
              tabIndex: 0,
              'aria-label': `Station ${s.n}, ${s.name}, ${stateWord(state)}. ${dsCount(s.id)} data-structure lines stop here.`,
              'aria-disabled': state === 'locked' || undefined,
              onClick: () => onStation?.(s.id),
              onKeyDown: keyActivate(() => onStation?.(s.id)),
            }
          : {};
        const w = capsule ? (horizontal ? 44 : 26) : 26;
        const h = capsule ? (horizontal ? 26 : 44) : 26;
        return (
          <motion.g
            key={s.id}
            className={`${styles.station} ${styles[state]}`}
            style={{ transformOrigin: `${s.x}px ${s.y}px` }}
            {...stationProps}
            {...popAnim(delay)}
          >
            {interactive && <circle cx={s.x} cy={s.y} r={30} className={styles.hitStation} />}
            {state === 'current' && !reduce && (
              <rect
                x={s.x - w / 2 - 8}
                y={s.y - h / 2 - 8}
                width={w + 16}
                height={h + 16}
                rx={(Math.min(w, h) + 16) / 2}
                className={styles.pulse}
              />
            )}
            <rect x={s.x - w / 2} y={s.y - h / 2} width={w} height={h} rx={Math.min(w, h) / 2} className={styles.stop} />
            {state === 'done' && <CheckGlyph x={s.x} y={s.y} className={styles.glyphDone} />}
            {state === 'locked' && <LockGlyph x={s.x} y={s.y} className={styles.glyphLock} />}
            <text x={number.x} y={number.y} textAnchor={number.anchor} className={styles.stationNumber}>
              {s.n}
            </text>
            <text x={label.x} y={label.y} textAnchor={label.anchor} className={styles.stationName}>
              {s.name}
            </text>
          </motion.g>
        );
      })}

      {/* Train marker at the current station */}
      {interactive && current && (
        <motion.g
          className={styles.train}
          initial={false}
          animate={horizontal ? { x: current.x - 52, y: current.y - 9 } : { x: current.x - 9, y: current.y - 52 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.22, 0.8, 0.3, 1] }}
          aria-hidden="true"
        >
          <TrainGlyph vertical={!horizontal} />
        </motion.g>
      )}
    </svg>
  );
}

function cap(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function stateWord(state) {
  if (state === 'done') return 'done';
  if (state === 'current') return 'current station';
  if (state === 'locked') return 'locked';
  return '';
}

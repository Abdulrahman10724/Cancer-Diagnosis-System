// Shared metro geometry for the landing hero and the map.
// Horizontal: core line left -> right, data-structure tracks run below as parallel lines.
// Vertical (phones): core line top -> bottom, tracks run to its left.
import { LINES, STATIONS } from './metro';

export function metroLayout(orientation = 'horizontal') {
  if (orientation === 'vertical') return vertical();
  return horizontal();
}

function horizontal() {
  const width = 1200;
  const coreY = 118;
  const nameX = 176; // line names end here (right-aligned)
  const trackStart = 192;
  const first = 250;
  const last = 1140;
  const gap = (last - first) / (STATIONS.length - 1);
  const stations = STATIONS.map((s, i) => ({ ...s, x: first + i * gap, y: coreY }));
  const at = (id) => stations.find((s) => s.id === id);
  const tracks = LINES.map((line, j) => {
    const y = 206 + j * 40;
    const stopsAt = line.stops.map((id) => at(id));
    const end = stopsAt[stopsAt.length - 1].x;
    return {
      ...line,
      d: `M${trackStart},${y} H${end}`,
      length: end - trackStart,
      stops: stopsAt.map((s) => ({ id: s.id, x: s.x, y, connector: `M${s.x},${y} V${coreY}` })),
      label: { x: nameX, y: y + 5, anchor: 'end' },
    };
  });
  return {
    orientation: 'horizontal',
    width,
    height: 206 + (LINES.length - 1) * 40 + 44,
    stations,
    tracks,
    core: { d: `M${trackStart},${coreY} H${last + 30}`, length: last + 30 - trackStart, label: { x: nameX, y: coreY + 5, anchor: 'end' } },
    stationLabel: (s) => ({ x: s.x, y: coreY - 34, anchor: 'middle' }),
    stationNumber: (s) => ({ x: s.x, y: coreY - 54, anchor: 'middle' }),
  };
}

function vertical() {
  const width = 360;
  const coreX = 196;
  const trackTop = 138;
  const first = 170;
  const gap = 72;
  const stations = STATIONS.map((s, i) => ({ ...s, x: coreX, y: first + i * gap }));
  const at = (id) => stations.find((s) => s.id === id);
  const tracks = LINES.map((line, j) => {
    const x = 26 + j * 26;
    const stopsAt = line.stops.map((id) => at(id));
    const end = stopsAt[stopsAt.length - 1].y;
    return {
      ...line,
      d: `M${x},${trackTop} V${end}`,
      length: end - trackTop,
      stops: stopsAt.map((s) => ({ id: s.id, x, y: s.y, connector: `M${x},${s.y} H${coreX}` })),
      label: { x: x + 5, y: trackTop - 10, anchor: 'start', rotate: true },
    };
  });
  const lastY = first + (STATIONS.length - 1) * gap;
  return {
    orientation: 'vertical',
    width,
    height: lastY + 48,
    stations,
    tracks,
    core: { d: `M${coreX},${trackTop} V${lastY + 24}`, length: lastY + 24 - trackTop, label: { x: coreX + 5, y: trackTop - 10, anchor: 'start', rotate: true } },
    stationLabel: (s) => ({ x: coreX + 26, y: s.y + 6, anchor: 'start' }),
    stationNumber: (s) => ({ x: coreX + 26, y: s.y - 14, anchor: 'start' }),
  };
}

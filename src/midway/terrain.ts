/**
 * The ground under the midway, as a gentle elevation field, and the contour
 * lines that show it. Plain functions with no randomness, so the same map
 * always gets the same hills, and the contours can be drawn once into the
 * cached ground layer.
 */

export interface Hill {
  /** Where the top of the hill is, in tiles. */
  x: number;
  y: number;
  /** How far, in tiles, the hill spreads before it levels out. */
  spread: number;
  /** Height at the top, in contour steps. */
  height: number;
}

/** A few low hills and a hollow, placed relative to the map's size. */
export function hillsFor(width: number, height: number): Hill[] {
  return [
    { x: width * 0.18, y: height * 0.22, spread: width * 0.22, height: 7.5 },
    { x: width * 0.84, y: height * 0.34, spread: width * 0.2, height: 6.2 },
    { x: width * 0.22, y: height * 0.8, spread: width * 0.18, height: 5.4 },
    { x: width * 0.78, y: height * 0.82, spread: width * 0.16, height: 4.6 },
    { x: width * 0.5, y: height * 0.55, spread: width * 0.14, height: -2.4 },
  ];
}

/** Elevation at a tile position: a slope down to the gate, plus the hills. */
export function elevation(hills: readonly Hill[], x: number, y: number, slope = 0): number {
  let h = -slope * y;
  for (const hill of hills) {
    const dx = x - hill.x;
    const dy = y - hill.y;
    h += hill.height * Math.exp(-(dx * dx + dy * dy) / (2 * hill.spread * hill.spread));
  }
  return h;
}

export type Segment = readonly [x1: number, y1: number, x2: number, y2: number];

export interface Contour {
  level: number;
  segments: Segment[];
}

/**
 * Contour lines of `field` over the area [0, width] × [0, height], one for
 * every whole level, by marching squares on a grid `step` tiles apart.
 */
export function contours(
  field: (x: number, y: number) => number,
  width: number,
  height: number,
  step = 0.25,
): Contour[] {
  const cols = Math.round(width / step);
  const rows = Math.round(height / step);
  const values: number[] = [];
  let low = Infinity;
  let high = -Infinity;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const v = field(i * step, j * step);
      values.push(v);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  }
  const value = (i: number, j: number) => values[j * (cols + 1) + i];

  const result: Contour[] = [];
  for (let level = Math.ceil(low); level <= Math.floor(high); level++) {
    const segments: Segment[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // Corners clockwise from the top left, and where the level crosses
        // each edge between them.
        const corners = [
          [i, j, value(i, j)],
          [i + 1, j, value(i + 1, j)],
          [i + 1, j + 1, value(i + 1, j + 1)],
          [i, j + 1, value(i, j + 1)],
        ] as const;
        const crossings: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const [ax, ay, av] = corners[k];
          const [bx, by, bv] = corners[(k + 1) % 4];
          if (av >= level === bv >= level) continue;
          const s = (level - av) / (bv - av);
          crossings.push([(ax + (bx - ax) * s) * step, (ay + (by - ay) * s) * step]);
        }
        // Two crossings make one segment; four (a saddle) make two.
        for (let k = 0; k + 1 < crossings.length; k += 2) {
          const [a, b] = [crossings[k], crossings[k + 1]];
          segments.push([a[0], a[1], b[0], b[1]]);
        }
      }
    }
    result.push({ level, segments });
  }
  return result;
}

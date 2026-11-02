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
 * every whole level, by marching squares on a grid `step` tiles apart. When
 * a side is not a whole number of steps, the last cell on it is narrower, so
 * the grid still ends exactly on the edge.
 */
export function contours(
  field: (x: number, y: number) => number,
  width: number,
  height: number,
  step = 0.25,
): Contour[] {
  const xs = gridLines(width, step);
  const ys = gridLines(height, step);
  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const values: number[] = [];
  let low = Infinity;
  let high = -Infinity;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const v = field(xs[i], ys[j]);
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
          [xs[i], ys[j], value(i, j)],
          [xs[i + 1], ys[j], value(i + 1, j)],
          [xs[i + 1], ys[j + 1], value(i + 1, j + 1)],
          [xs[i], ys[j + 1], value(i, j + 1)],
        ] as const;
        const crossings: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const [ax, ay, av] = corners[k];
          const [bx, by, bv] = corners[(k + 1) % 4];
          if (av >= level === bv >= level) continue;
          const s = (level - av) / (bv - av);
          crossings.push([ax + (bx - ax) * s, ay + (by - ay) * s]);
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

/** Grid positions `step` apart from 0, ending exactly on `size`. */
function gridLines(size: number, step: number): number[] {
  const count = Math.ceil(size / step - 1e-9);
  const lines: number[] = [];
  for (let i = 0; i < count; i++) lines.push(i * step);
  lines.push(size);
  return lines;
}

export type Polygon = readonly (readonly [x: number, y: number])[];

export interface Terrace {
  level: number;
  /** Pieces of grid cells that are at or above `level`; together they fill it. */
  cells: Polygon[];
}

/**
 * The ground above each whole level of `field`, as filled shapes, so the
 * terrain can be drawn as stacked terraces. Each cell of a grid `step` tiles
 * apart contributes the part of itself at or above the level (filled
 * marching squares), over [x0, x1] × [y0, y1]. Cells wholly above the level
 * come back as plain squares.
 */
export function terraces(
  field: (x: number, y: number) => number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  step = 0.5,
): Terrace[] {
  const xs = gridLines(x1 - x0, step).map((x) => x + x0);
  const ys = gridLines(y1 - y0, step).map((y) => y + y0);
  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const values: number[] = [];
  let low = Infinity;
  let high = -Infinity;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const v = field(xs[i], ys[j]);
      values.push(v);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
  }
  const value = (i: number, j: number) => values[j * (cols + 1) + i];

  const result: Terrace[] = [];
  for (let level = Math.ceil(low); level <= Math.floor(high); level++) {
    const cells: Polygon[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const corners = [
          [xs[i], ys[j], value(i, j)],
          [xs[i + 1], ys[j], value(i + 1, j)],
          [xs[i + 1], ys[j + 1], value(i + 1, j + 1)],
          [xs[i], ys[j + 1], value(i, j + 1)],
        ] as const;
        // Walk the corners clockwise, keeping those above the level and the
        // points where the level crosses an edge.
        const shape: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const [ax, ay, av] = corners[k];
          const [bx, by, bv] = corners[(k + 1) % 4];
          if (av >= level) shape.push([ax, ay]);
          if (av >= level !== bv >= level) {
            const s = (level - av) / (bv - av);
            shape.push([ax + (bx - ax) * s, ay + (by - ay) * s]);
          }
        }
        // A saddle with only the top right and bottom left corners above the
        // level: the contours pair the crossings round each of those corners,
        // so the ground above is two separate corners, not one band across.
        const [tl, tr, br, bl] = corners.map(([, , v]) => v >= level);
        if (tr && bl && !tl && !br) cells.push(shape.slice(0, 3), shape.slice(3));
        else if (shape.length >= 3) cells.push(shape);
      }
    }
    result.push({ level, cells });
  }
  return result;
}

/** The area of a polygon, positive when its points run clockwise on screen. */
export function polygonArea(points: Polygon): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    sum += ax * by - bx * ay;
  }
  return sum / 2;
}

/** A repeatable number in [0, 1) for a grid position. */
export function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Stipple dots for printed terrain: one candidate every `step` tiles over
 * [0, width] × [0, height], kept when its hash falls under `density(x, y)`,
 * and jittered within its cell. The same map always gets the same dots.
 */
export function stipple(
  width: number,
  height: number,
  density: (x: number, y: number) => number,
  step = 0.25,
): [number, number][] {
  const dots: [number, number][] = [];
  for (let j = 0; j * step < height; j++) {
    for (let i = 0; i * step < width; i++) {
      const x = (i + 0.2 + hash(i, j, 1) * 0.6) * step;
      const y = (j + 0.2 + hash(i, j, 2) * 0.6) * step;
      if (x < width && y < height && hash(i, j, 3) < density(x, y)) dots.push([x, y]);
    }
  }
  return dots;
}

/**
 * Which tint a terrace is printed in: the lowest step gets the lightest, the
 * highest the darkest, spread evenly over the tints there are.
 */
export function terraceTint(level: number, lowest: number, highest: number, tints: number) {
  if (highest <= lowest) return 0;
  return Math.round(((level - lowest) / (highest - lowest)) * (tints - 1));
}

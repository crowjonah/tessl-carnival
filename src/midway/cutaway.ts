/**
 * The midway as a floating slice of earth: the two front faces of the
 * island, the rock strata printed on them, and the roots that reach into
 * them. Plain functions with no randomness and no canvas, so the same map
 * always gets the same cross-section, and it can be drawn once into the
 * cached ground layer.
 *
 * Along a face, `s` is the distance in tiles from the island's front corner,
 * and depth is in world pixels below the surface.
 */

import { hash } from './terrain';
import { toScreen, type MidwayMap, type Point } from './world';

/** How far the terrain reaches past the back hedge, under the trees, in tiles. */
export const ISLAND_MARGIN = 3;
/** How far the terrain reaches past the front hedge, to the cliff edge, in tiles. */
export const ISLAND_LIP = 1;
/** The island's depth from the surface to its underside, in world pixels. */
export const CUTAWAY_DEPTH = 76;
/** How far the underside wanders above or below CUTAWAY_DEPTH. */
export const UNDERSIDE_RAG = 5;
/** How far the longest roots hang below the underside. */
export const ROOT_DANGLE = 10;
/** How far apart, in tiles, a face's profile is sampled. */
const STATION_STEP = 0.25;

export interface Face {
  /** The island's front corner, where every face starts, in tiles. */
  from: Point;
  /** The unit direction in tiles along the face, away from the corner. */
  dir: Point;
  /** The face's length in tiles. */
  length: number;
}

export interface Faces {
  /** Along the front edge, past y = height, facing down-left. */
  left: Face;
  /** Along the front edge, past x = width, facing down-right. */
  right: Face;
}

/** The island's two exposed faces, both starting at its front corner. */
export function islandFaces(map: Pick<MidwayMap, 'width' | 'height'>): Faces {
  const from = { x: map.width + ISLAND_LIP, y: map.height + ISLAND_LIP };
  return {
    left: { from, dir: { x: -1, y: 0 }, length: map.width + ISLAND_LIP + ISLAND_MARGIN },
    right: { from, dir: { x: 0, y: -1 }, length: map.height + ISLAND_LIP + ISLAND_MARGIN },
  };
}

/** The tile position `s` tiles along a face. */
export function facePoint(face: Face, s: number): Point {
  return { x: face.from.x + face.dir.x * s, y: face.from.y + face.dir.y * s };
}

/**
 * Each stratum's top, below the subsoil: `base` pixels deep, and up to
 * `bend` pixels deeper where the ground above is higher, so the layers echo
 * the terraces over them and the bend fades with depth.
 */
const STRATA = [
  { base: 16, bend: 6 },
  { base: 28, bend: 5 },
  { base: 40, bend: 4 },
  { base: 52, bend: 3 },
  { base: 63, bend: 2 },
] as const;
/** How deep the topsoil is under the lowest terrace, and how much deeper under the highest. */
const TOPSOIL = { base: 3, steps: 6 };
/** How far, in pixels, each boundary ripples either way along the face. */
const RIPPLE = 1.5;

/** How many strata a section has: the topsoil, the subsoil and the rock below. */
export const STRATA_COUNT = STRATA.length + 2;

export interface Section {
  /** Distances along the face the profile is sampled at, from 0 to its length. */
  stations: number[];
  /**
   * For each stratum, top to bottom, the depth of its top at each station.
   * The first, the topsoil, starts at the surface.
   */
  strata: number[][];
  /** The depth of the underside at each station. */
  underside: number[];
}

/**
 * Cross-sections of both faces of the island over the elevation `field`.
 * The topsoil thickens a step for every terrace level above it, so the
 * stacked terraces show in section; the rock strata below bend smoothly
 * with the ground. Heights are scaled over both faces together, so the two
 * faces meet exactly at the front corner.
 */
export function crossSections(
  map: Pick<MidwayMap, 'width' | 'height'>,
  field: (x: number, y: number) => number,
): { left: Section; right: Section } {
  const faces = islandFaces(map);
  const sample = (face: Face) => {
    const stations = gridLines(face.length, STATION_STEP);
    const heights = stations.map((s) => {
      const p = facePoint(face, s);
      return field(p.x, p.y);
    });
    return { stations, heights };
  };
  const left = sample(faces.left);
  const right = sample(faces.right);
  const all = [...left.heights, ...right.heights];
  const low = Math.min(...all);
  const span = Math.max(...all) - low || 1;
  const levels = Math.floor(Math.max(...all)) - Math.floor(low) || 1;

  const section = ({ stations, heights }: typeof left, salt: number): Section => ({
    stations,
    strata: [
      stations.map(() => 0),
      heights.map(
        (h) => TOPSOIL.base + (TOPSOIL.steps * (Math.floor(h) - Math.floor(low))) / levels,
      ),
      ...STRATA.map(({ base, bend }, k) =>
        stations.map(
          (s, i) =>
            base + bend * ((heights[i] - low) / span) + RIPPLE * Math.sin(s * 0.9 + k * 1.7),
        ),
      ),
    ],
    underside: stations.map((s) => CUTAWAY_DEPTH + rag(s, salt)),
  });
  return { left: section(left, 1), right: section(right, 2) };
}

/**
 * The underside's wander at `s`: a repeatable value per whole tile, joined
 * by straight lines, and zero at the corner so both faces meet there.
 */
function rag(s: number, salt: number): number {
  const at = (i: number) => (i === 0 ? 0 : (hash(i, salt, 7) * 2 - 1) * UNDERSIDE_RAG);
  const i = Math.floor(s);
  return at(i) + (at(i + 1) - at(i)) * (s - i);
}

/** Grid positions `step` apart from 0, ending exactly on `size`. */
function gridLines(size: number, step: number): number[] {
  const count = Math.ceil(size / step - 1e-9);
  const lines: number[] = [];
  for (let i = 0; i < count; i++) lines.push(i * step);
  lines.push(size);
  return lines;
}

/** A root, as points along a face ([s, depth]), and its width where it starts. */
export interface Strand {
  points: [s: number, depth: number][];
  width: number;
}

/**
 * The roots of a plant standing over a face at `s`: a taproot reaching
 * `reach` (0 to 1) of the way down the island, and side roots that spread
 * from it. A reach of 1 hangs past the underside. Repeatable for a `seed`,
 * and every point stays within the face's length.
 */
export function roots(s: number, reach: number, length: number, seed: number): Strand[] {
  const clamp = (v: number) => Math.max(0.1, Math.min(length - 0.1, v));
  const deepest = CUTAWAY_DEPTH + ROOT_DANGLE;
  const bottom = reach * deepest;
  const tap: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const depth = (bottom * i) / 6;
    const sway = i === 0 ? 0 : (hash(i, seed, 11) - 0.5) * 0.5 * reach;
    tap.push([clamp(s + sway), depth]);
  }
  const strands: Strand[] = [{ points: tap, width: 1 + reach * 1.6 }];
  const sides = 2 + Math.round(reach * 2);
  for (let k = 0; k < sides; k++) {
    const [ss, sd] = tap[1 + Math.floor((k * 4) / sides)];
    const way = k % 2 === 0 ? 1 : -1;
    const spread = (0.6 + hash(k, seed, 12) * 0.8) * (0.4 + reach);
    const drop = (6 + hash(k, seed, 13) * 10) * (0.5 + reach);
    strands.push({
      points: [
        [ss, sd],
        [clamp(ss + way * spread * 0.5), Math.min(deepest, sd + drop * 0.4)],
        [clamp(ss + way * spread), Math.min(deepest, sd + drop)],
      ],
      width: 0.6 + reach * 0.8,
    });
  }
  return strands;
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The world-pixel box the whole island covers, from its back corner to the
 * lowest root under its front corner, not counting what stands on it.
 */
export function islandBounds(map: Pick<MidwayMap, 'width' | 'height'>): Bounds {
  const m = ISLAND_MARGIN;
  const w = map.width + ISLAND_LIP;
  const h = map.height + ISLAND_LIP;
  const back = toScreen(-m, -m);
  const left = toScreen(-m, h);
  const right = toScreen(w, -m);
  const front = toScreen(w, h);
  return {
    left: left.x,
    right: right.x,
    top: back.y,
    bottom: front.y + CUTAWAY_DEPTH + UNDERSIDE_RAG + ROOT_DANGLE,
  };
}

/** Which game's booth the plumbing under the island feeds. */
export const PLUMBED_GAME = 'water-cannon';

export interface PipeRoute {
  side: keyof Faces;
  /** Where the buried main leaves the booth's pad, in tiles. */
  from: Point;
  /** Where it reaches the island's edge, in tiles. */
  to: Point;
  /** How far along the face it comes out. */
  s: number;
  /** How far along the same face the cistern it feeds from sits. */
  tank: number;
}

/** How far, in tiles, the cistern sits along the face from where the main comes out. */
const TANK_OFFSET = 2.5;
/** How deep the pipe runs along the face to the cistern, in world pixels. */
export const PIPE_RUN_DEPTH = 30;

/**
 * The water main from the Water Cannon booth to the nearer front face, in a
 * straight line from the middle of the pad's side that faces it. Undefined
 * when the midway has no Water Cannon booth.
 */
export function pipeRoute(
  map: Pick<MidwayMap, 'width' | 'height' | 'booths'>,
): PipeRoute | undefined {
  const booth = map.booths.find((b) => b.gameId === PLUMBED_GAME);
  if (!booth) return undefined;
  const faces = islandFaces(map);
  // The cistern sits further along the face, or back towards the corner
  // when that would run off the end.
  const tank = (side: keyof Faces, s: number) =>
    s + TANK_OFFSET + 1 <= faces[side].length ? s + TANK_OFFSET : s - TANK_OFFSET;
  const toLeft = map.height - (booth.y + booth.h);
  const toRight = map.width - (booth.x + booth.w);
  if (toLeft <= toRight) {
    const x = booth.x + booth.w / 2;
    return {
      side: 'left',
      from: { x, y: booth.y + booth.h },
      to: { x, y: map.height + ISLAND_LIP },
      s: map.width + ISLAND_LIP - x,
      tank: tank('left', map.width + ISLAND_LIP - x),
    };
  }
  const y = booth.y + booth.h / 2;
  return {
    side: 'right',
    from: { x: booth.x + booth.w, y },
    to: { x: map.width + ISLAND_LIP, y },
    s: map.height + ISLAND_LIP - y,
    tank: tank('right', map.height + ISLAND_LIP - y),
  };
}

export type RelicKind = 'ring' | 'ticket-roll' | 'sign';

export interface Relic {
  kind: RelicKind;
  side: keyof Faces;
  s: number;
  depth: number;
}

/** How far, in tiles, a relic keeps from the pipes, the trees' roots and the ends of its face. */
export const RELIC_CLEARANCE = 2.5;

/**
 * Three buried relics: a ring and a ticket roll on the longer face and a
 * sign fragment on the other, each kept clear of the face's ends and of
 * everything in `avoid`, the distances along each face where pipes and
 * roots already are.
 */
export function placeRelics(faces: Faces, avoid: Record<keyof Faces, readonly number[]>): Relic[] {
  const wanted: Omit<Relic, 'side'>[][] = [
    [
      { kind: 'ring', s: 0.3, depth: 50 },
      { kind: 'ticket-roll', s: 0.7, depth: 30 },
    ],
    [{ kind: 'sign', s: 0.5, depth: 42 }],
  ];
  // The longer face holds two; on a tie, the left.
  const order: (keyof Faces)[] =
    faces.right.length > faces.left.length ? ['right', 'left'] : ['left', 'right'];
  const relics: Relic[] = [];
  order.forEach((side, i) => {
    const { length } = faces[side];
    const taken = [...avoid[side]];
    for (const relic of wanted[i]) {
      const s = clearSpot(relic.s * length, length, taken);
      if (s === undefined) continue;
      taken.push(s);
      relics.push({ ...relic, side, s });
    }
  });
  return relics;
}

/** The nearest spot to `s` at least RELIC_CLEARANCE from both ends and everything `taken`. */
function clearSpot(s: number, length: number, taken: readonly number[]): number | undefined {
  const c = RELIC_CLEARANCE;
  const clear = (v: number) =>
    v >= c && v <= length - c && taken.every((t) => Math.abs(v - t) >= c);
  for (let d = 0; d <= length; d += 0.25) {
    if (clear(s + d)) return s + d;
    if (clear(s - d)) return s - d;
  }
  return undefined;
}

export interface LipTree extends Point {
  /** The face whose cross-section shows its roots. */
  side: keyof Faces;
  /** How far along that face it stands. */
  s: number;
}

/**
 * Trees on the lip between the front hedge and the cliff edge, whose roots
 * show in the cross-section: two over each face, clear of the gate.
 */
export function lipTrees(map: Pick<MidwayMap, 'width' | 'height' | 'avenueX'>): LipTree[] {
  const { from } = islandFaces(map).left;
  const front = map.height + ISLAND_LIP / 2;
  const side = map.width + ISLAND_LIP / 2;
  const left = [2.4, Math.max(map.avenueX + 5, map.width - 4.6)];
  const right = [3.6, Math.round(map.height * 0.55) + 0.4];
  return [
    ...left.map((x) => ({ x, y: front, side: 'left' as const, s: from.x - x })),
    ...right.map((y) => ({ x: side, y, side: 'right' as const, s: from.y - y })),
  ];
}

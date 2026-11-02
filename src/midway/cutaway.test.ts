import { describe, expect, it } from 'vitest';
import {
  crossSections,
  CUTAWAY_DEPTH,
  facePoint,
  islandBounds,
  islandFaces,
  lipTrees,
  pipeRoute,
  placeRelics,
  RELIC_CLEARANCE,
  ROOT_DANGLE,
  roots,
  STRATA_COUNT,
  UNDERSIDE_RAG,
} from './cutaway';
import { cameraBounds, cameraTarget, zoomFor } from './framing';
import { elevation, hillsFor } from './terrain';
import { isBlocked, layoutMidway, toScreen } from './world';

const GAMES = ['hook-a-duck', 'ring-toss', 'water-cannon', 'whack-a-mole'];
const map = layoutMidway(GAMES);
const hills = hillsFor(map.width, map.height);
const field = (x: number, y: number) => elevation(hills, x, y, 0.12);

describe('islandFaces', () => {
  it('starts both faces at one front corner, in front of the walkable map', () => {
    const { left, right } = islandFaces(map);
    expect(left.from).toEqual(right.from);
    expect(left.from.x).toBeGreaterThanOrEqual(map.width);
    expect(left.from.y).toBeGreaterThanOrEqual(map.height);
    // Each face runs the whole front edge and past the back of the map.
    expect(facePoint(left, left.length).x).toBeLessThan(0);
    expect(facePoint(right, right.length).y).toBeLessThan(0);
  });
});

describe('crossSections', () => {
  const sections = crossSections(map, field);

  it('meets at the front corner, so the two faces join up', () => {
    sections.left.strata.forEach((tops, k) =>
      expect(tops[0]).toBeCloseTo(sections.right.strata[k][0]),
    );
    expect(sections.left.underside[0]).toBeCloseTo(sections.right.underside[0]);
  });

  it('keeps every stratum in order, from the surface to the underside', () => {
    for (const { stations, strata, underside } of [sections.left, sections.right]) {
      expect(strata).toHaveLength(STRATA_COUNT);
      stations.forEach((_, i) => {
        expect(strata[0][i]).toBe(0);
        for (let k = 1; k < strata.length; k++)
          expect(strata[k][i]).toBeGreaterThan(strata[k - 1][i]);
        expect(underside[i]).toBeGreaterThan(strata[strata.length - 1][i]);
        expect(Math.abs(underside[i] - CUTAWAY_DEPTH)).toBeLessThanOrEqual(UNDERSIDE_RAG);
      });
    }
  });

  it('samples each face from its corner to its end', () => {
    const faces = islandFaces(map);
    expect(sections.left.stations[0]).toBe(0);
    expect(sections.left.stations.at(-1)).toBe(faces.left.length);
    expect(sections.right.stations.at(-1)).toBe(faces.right.length);
  });

  it('thickens the topsoil under higher terraces', () => {
    const { stations, strata } = sections.left;
    const faces = islandFaces(map);
    const heights = stations.map((s) => {
      const p = facePoint(faces.left, s);
      return field(p.x, p.y);
    });
    const lowest = heights.indexOf(Math.min(...heights));
    const highest = heights.indexOf(Math.max(...heights));
    expect(strata[1][highest]).toBeGreaterThan(strata[1][lowest]);
  });

  it('gives the same map the same section every time', () => {
    expect(crossSections(map, field)).toEqual(sections);
  });
});

describe('roots', () => {
  it('stays on the face and never hangs past the dangle', () => {
    for (const reach of [0.12, 0.7, 1]) {
      for (const strand of roots(1, reach, 20, 3)) {
        for (const [s, depth] of strand.points) {
          expect(s).toBeGreaterThan(0);
          expect(s).toBeLessThan(20);
          expect(depth).toBeGreaterThanOrEqual(0);
          expect(depth).toBeLessThanOrEqual(CUTAWAY_DEPTH + ROOT_DANGLE);
        }
      }
    }
  });

  it('reaches deeper the bigger the plant', () => {
    const deepest = (reach: number) =>
      Math.max(...roots(5, reach, 20, 1).flatMap((r) => r.points.map(([, d]) => d)));
    expect(deepest(1)).toBeGreaterThan(deepest(0.12) * 4);
  });
});

describe('pipeRoute', () => {
  it('runs from the Water Cannon booth to the nearer front face', () => {
    const booth = map.booths.find((b) => b.gameId === 'water-cannon')!;
    const pipe = pipeRoute(map)!;
    const faces = islandFaces(map);
    const end = facePoint(faces[pipe.side], pipe.s);
    expect(end.x).toBeCloseTo(pipe.to.x);
    expect(end.y).toBeCloseTo(pipe.to.y);
    // It leaves the booth's own pad.
    expect(pipe.from.x).toBeGreaterThanOrEqual(booth.x);
    expect(pipe.from.x).toBeLessThanOrEqual(booth.x + booth.w);
    expect(pipe.from.y).toBeGreaterThanOrEqual(booth.y);
    expect(pipe.from.y).toBeLessThanOrEqual(booth.y + booth.h);
    // The cistern it feeds is on the same face.
    expect(pipe.tank).toBeGreaterThan(0);
    expect(pipe.tank).toBeLessThan(faces[pipe.side].length);
  });

  it('is left out when there is no Water Cannon booth', () => {
    expect(pipeRoute(layoutMidway(['ring-toss']))).toBeUndefined();
  });
});

describe('placeRelics', () => {
  it('buries a ring, a ticket roll and a sign, clear of the pipes and roots', () => {
    const faces = islandFaces(map);
    const pipe = pipeRoute(map)!;
    const avoid = { left: [] as number[], right: [] as number[] };
    for (const tree of lipTrees(map)) avoid[tree.side].push(tree.s);
    avoid[pipe.side].push(pipe.s, pipe.tank);
    const relics = placeRelics(faces, avoid);
    expect(relics.map((r) => r.kind).sort()).toEqual(['ring', 'sign', 'ticket-roll']);
    for (const relic of relics) {
      const { length } = faces[relic.side];
      expect(relic.s).toBeGreaterThanOrEqual(RELIC_CLEARANCE);
      expect(relic.s).toBeLessThanOrEqual(length - RELIC_CLEARANCE);
      for (const s of avoid[relic.side])
        expect(Math.abs(relic.s - s)).toBeGreaterThanOrEqual(RELIC_CLEARANCE);
      expect(relic.depth).toBeLessThan(CUTAWAY_DEPTH - UNDERSIDE_RAG);
    }
  });
});

describe('lipTrees', () => {
  it('stands outside the walkable map, over its own face', () => {
    const faces = islandFaces(map);
    for (const tree of lipTrees(map)) {
      expect(isBlocked(map, Math.floor(tree.x), Math.floor(tree.y))).toBe(true);
      expect(tree.x >= map.width || tree.y >= map.height).toBe(true);
      const p = facePoint(faces[tree.side], tree.s);
      expect(tree.side === 'left' ? p.x : p.y).toBeCloseTo(tree.side === 'left' ? tree.x : tree.y);
    }
  });
});

describe('islandBounds', () => {
  it('holds the whole walkable map and the cross-section under its front corner', () => {
    const box = islandBounds(map);
    for (const [x, y] of [
      [0, 0],
      [map.width, 0],
      [0, map.height],
      [map.width, map.height],
    ]) {
      const p = toScreen(x, y);
      expect(p.x).toBeGreaterThan(box.left);
      expect(p.x).toBeLessThan(box.right);
      expect(p.y).toBeGreaterThanOrEqual(box.top);
      expect(p.y).toBeLessThan(box.bottom);
    }
    const front = toScreen(islandFaces(map).left.from.x, islandFaces(map).left.from.y);
    expect(box.bottom).toBe(front.y + CUTAWAY_DEPTH + UNDERSIDE_RAG + ROOT_DANGLE);
  });

  it('grows with the map, but stays finite', () => {
    const big = islandBounds(layoutMidway(Array.from({ length: 12 }, (_, i) => `game-${i}`)));
    const small = islandBounds(map);
    expect(big.bottom).toBeGreaterThan(small.bottom);
    expect(Number.isFinite(big.bottom)).toBe(true);
  });
});

describe('framing', () => {
  const HORIZON = -24;
  const bounds = cameraBounds(map, HORIZON);

  it('lets the camera reach the bottom of the cross-section, and no further', () => {
    expect(bounds.bottom).toBeGreaterThan(islandBounds(map).bottom);
    expect(bounds.bottom - islandBounds(map).bottom).toBeLessThan(40);
  });

  for (const [width, height] of [
    [1280, 840 - 60],
    [390, 844 - 60],
  ]) {
    it(`shows the cutaway beside the gate at ${width}x${height}`, () => {
      const zoom = zoomFor(width, height);
      const view = { w: width / zoom, h: height / zoom };
      // Standing just inside the gate, where every visit starts.
      const feet = toScreen(map.spawn.x, map.spawn.y);
      const cam = cameraTarget(bounds, feet, view);
      // The player stays on screen, clear of the edges.
      expect(feet.x - cam.x).toBeGreaterThan(view.w * 0.2);
      expect(feet.x - cam.x).toBeLessThan(view.w * 0.8);
      expect(feet.y - cam.y).toBeGreaterThan(view.h * 0.2);
      expect(feet.y - cam.y).toBeLessThan(view.h * 0.8);
      // The front corner's whole cross-section is in view under them.
      const corner = toScreen(islandFaces(map).left.from.x, islandFaces(map).left.from.y);
      const below = corner.y + CUTAWAY_DEPTH;
      const onScreen = corner.x > cam.x && corner.x < cam.x + view.w;
      const face = toScreen(map.spawn.x, islandFaces(map).left.from.y);
      expect(onScreen || (face.x > cam.x && face.x < cam.x + view.w)).toBe(true);
      expect(Math.min(below, face.y + CUTAWAY_DEPTH)).toBeLessThan(cam.y + view.h);
    });
  }

  it('never moves past its bounds, however far the focus goes', () => {
    const view = { w: 400, h: 300 };
    for (const focus of [
      { x: -1e6, y: -1e6 },
      { x: 1e6, y: 1e6 },
    ]) {
      const cam = cameraTarget(bounds, focus, view);
      expect(cam.x).toBeGreaterThanOrEqual(bounds.left);
      expect(cam.x + view.w).toBeLessThanOrEqual(bounds.right);
      expect(cam.y).toBeGreaterThanOrEqual(bounds.top);
      expect(cam.y + view.h).toBeLessThanOrEqual(bounds.bottom);
    }
  });
});

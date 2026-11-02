import { describe, expect, it } from 'vitest';
import {
  contours,
  elevation,
  hillsFor,
  polygonArea,
  stipple,
  terraces,
  terraceTint,
  type Polygon,
  type Segment,
} from './terrain';

/** Walks the segments end to end and returns the closed rings they form. */
function rings(segments: readonly Segment[]): number[] {
  const key = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`;
  const ends = new Map<string, number[]>();
  segments.forEach(([x1, y1, x2, y2], index) => {
    for (const k of [key(x1, y1), key(x2, y2)]) ends.set(k, [...(ends.get(k) ?? []), index]);
  });
  // Every endpoint is shared by exactly two segments: no loose ends.
  for (const owners of ends.values()) expect(owners).toHaveLength(2);
  const seen = new Set<number>();
  const sizes: number[] = [];
  for (let start = 0; start < segments.length; start++) {
    if (seen.has(start)) continue;
    let size = 0;
    let index = start;
    let at = key(segments[start][0], segments[start][1]);
    while (!seen.has(index)) {
      seen.add(index);
      size++;
      const [x1, y1, x2, y2] = segments[index];
      at = at === key(x1, y1) ? key(x2, y2) : key(x1, y1);
      index = ends.get(at)!.find((other) => other !== index)!;
    }
    // The walk came back to the segment it started from.
    expect(index).toBe(start);
    sizes.push(size);
  }
  return sizes;
}

describe('elevation', () => {
  it('peaks at the top of a hill and levels out far away', () => {
    const hills = [{ x: 5, y: 5, spread: 2, height: 4 }];
    expect(elevation(hills, 5, 5)).toBeCloseTo(4);
    expect(elevation(hills, 6, 5)).toBeLessThan(4);
    expect(elevation(hills, 50, 50)).toBeCloseTo(0);
  });

  it('falls with the slope towards larger y', () => {
    expect(elevation([], 0, 10, 0.5)).toBeCloseTo(-5);
  });
});

describe('contours', () => {
  it('draws a closed ring round a single hill at each whole level', () => {
    const hills = [{ x: 5, y: 5, spread: 1.5, height: 3.5 }];
    const lines = contours((x, y) => elevation(hills, x, y), 10, 10);
    expect(lines.map((c) => c.level)).toEqual([1, 2, 3]);
    for (const { level, segments } of lines) {
      expect(segments.length).toBeGreaterThan(0);
      for (const [x1, y1, x2, y2] of segments) {
        // Both ends of every segment sit at its level, near enough, and apart.
        expect(elevation(hills, x1, y1)).toBeCloseTo(level, 1);
        expect(elevation(hills, x2, y2)).toBeCloseTo(level, 1);
        expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThan(0);
      }
      // The segments join up into one closed ring.
      expect(rings(segments)).toEqual([segments.length]);
    }
    // Higher rings are smaller.
    expect(lines[2].segments.length).toBeLessThan(lines[0].segments.length);
  });

  it('gives the same lines every time for the same map', () => {
    const hills = hillsFor(24, 24);
    const field = (x: number, y: number) => elevation(hills, x, y, 0.12);
    expect(contours(field, 24, 24)).toEqual(contours(field, 24, 24));
  });

  it('draws nothing on flat ground', () => {
    expect(contours(() => 0.5, 4, 4)).toEqual([]);
  });

  it('keeps every segment inside the map', () => {
    const hills = hillsFor(24, 20);
    const lines = contours((x, y) => elevation(hills, x, y, 0.12), 24, 20);
    for (const { segments } of lines) {
      for (const [x1, y1, x2, y2] of segments) {
        for (const x of [x1, x2]) expect(x).toBeGreaterThanOrEqual(0);
        for (const x of [x1, x2]) expect(x).toBeLessThanOrEqual(24);
        for (const y of [y1, y2]) expect(y).toBeGreaterThanOrEqual(0);
        for (const y of [y1, y2]) expect(y).toBeLessThanOrEqual(20);
      }
    }
  });

  it('covers exactly the area asked for when it is not a whole number of steps', () => {
    // Sizes on, just above and just below a multiple of the step.
    for (const size of [1, 1.05, 1.14, 0.9, 1.4]) {
      const lines = contours((x, y) => x + y, size, size, 0.25);
      const points = lines.flatMap((c) => c.segments.flat());
      expect(points.length).toBeGreaterThan(0);
      expect(Math.max(...points)).toBeLessThanOrEqual(size);
      // No boundary strip is left out either.
      expect(Math.max(...points)).toBeCloseTo(size);
      expect(Math.min(...points)).toBeGreaterThanOrEqual(0);
      // The highest whole level in the corner is still found.
      expect(lines.at(-1)!.level).toBe(Math.floor(2 * size));
    }
  });

  it('samples the far edge exactly on a partial last cell', () => {
    // y = 1 lies inside the narrow last row of a 1.1-tall area.
    const line = contours((_x, y) => y, 2, 1.1, 0.4).find((c) => c.level === 1)!;
    expect(line.segments.length).toBeGreaterThan(0);
    for (const [x1, y1, x2, y2] of line.segments) {
      expect(y1).toBeCloseTo(1);
      expect(y2).toBeCloseTo(1);
      expect(Math.max(x1, x2)).toBeLessThanOrEqual(2);
    }
    expect(Math.max(...line.segments.flatMap(([x1, , x2]) => [x1, x2]))).toBeCloseTo(2);
  });
});

describe('terraces', () => {
  const area = (cells: readonly Polygon[]) => cells.reduce((sum, c) => sum + polygonArea(c), 0);

  it('fills the ground at or above each whole level, smaller as it climbs', () => {
    const hills = [{ x: 5, y: 5, spread: 1.5, height: 3.5 }];
    const steps = terraces((x, y) => elevation(hills, x, y), 0, 0, 10, 10, 0.25);
    expect(steps.map((s) => s.level)).toEqual([1, 2, 3]);
    expect(area(steps[0].cells)).toBeLessThan(100);
    for (let k = 1; k < steps.length; k++) {
      expect(area(steps[k].cells)).toBeGreaterThan(0);
      expect(area(steps[k].cells)).toBeLessThan(area(steps[k - 1].cells));
    }
    // Level 2 is about the disc where the hill is over 2 tall.
    const r = 1.5 * Math.sqrt(2 * Math.log(3.5 / 2));
    expect(area(steps[1].cells)).toBeCloseTo(Math.PI * r * r, 0);
  });

  it('winds every piece clockwise and keeps it inside the area', () => {
    const hills = hillsFor(24, 20);
    const steps = terraces((x, y) => elevation(hills, x, y, 0.12), -2, -2, 26, 22);
    for (const { cells } of steps) {
      for (const cell of cells) {
        expect(polygonArea(cell)).toBeGreaterThan(0);
        for (const [x, y] of cell) {
          expect(x).toBeGreaterThanOrEqual(-2);
          expect(x).toBeLessThanOrEqual(26);
          expect(y).toBeGreaterThanOrEqual(-2);
          expect(y).toBeLessThanOrEqual(22);
        }
      }
    }
  });

  it('covers the whole area at a level everything is above', () => {
    const [step] = terraces((x) => 1 + (x - 2) * 0.1, 2, 3, 7, 5);
    expect(step.level).toBe(1);
    expect(area(step.cells)).toBeCloseTo(10);
  });

  it('ends its edges on the contour lines of the same level', () => {
    const field = (x: number) => x * 0.5;
    const [step] = terraces(field, 0, 0, 4, 4, 0.5).filter((s) => s.level === 1);
    const xs = step.cells.flatMap((c) => c.map(([x]) => x));
    expect(Math.min(...xs)).toBeCloseTo(2);
    expect(area(step.cells)).toBeCloseTo(8);
  });

  it('gives the same shapes every time for the same map', () => {
    const hills = hillsFor(24, 24);
    const field = (x: number, y: number) => elevation(hills, x, y, 0.12);
    expect(terraces(field, 0, 0, 24, 24)).toEqual(terraces(field, 0, 0, 24, 24));
  });
});

describe('stipple', () => {
  it('scatters the same dots every time, inside the area', () => {
    const dots = stipple(6, 4, () => 0.3);
    expect(dots).toEqual(stipple(6, 4, () => 0.3));
    for (const [x, y] of dots) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(6);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(4);
    }
  });

  it('stays sparse: about the density asked for, none where it is zero', () => {
    const candidates = (6 / 0.25) * (4 / 0.25);
    const dots = stipple(6, 4, () => 0.2);
    expect(dots.length / candidates).toBeGreaterThan(0.12);
    expect(dots.length / candidates).toBeLessThan(0.28);
    expect(stipple(6, 4, (x) => (x < 3 ? 0 : 1)).every(([x]) => x >= 3 - 0.25)).toBe(true);
  });
});

describe('terraceTint', () => {
  it('runs from the lightest tint at the bottom to the darkest at the top', () => {
    expect(terraceTint(-2, -2, 6, 7)).toBe(0);
    expect(terraceTint(6, -2, 6, 7)).toBe(6);
    const all = [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((level) => terraceTint(level, -2, 6, 7));
    expect(all).toEqual([...all].sort((a, b) => a - b));
  });

  it('uses the first tint when there is only one level', () => {
    expect(terraceTint(3, 3, 3, 7)).toBe(0);
  });
});

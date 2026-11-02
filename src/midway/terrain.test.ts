import { describe, expect, it } from 'vitest';
import { contours, elevation, hillsFor, type Segment } from './terrain';

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

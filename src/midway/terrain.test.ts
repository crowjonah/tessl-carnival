import { describe, expect, it } from 'vitest';
import { contours, elevation, hillsFor } from './terrain';

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
      // Every point of the line sits at its level, near enough.
      for (const [x1, y1] of segments) expect(elevation(hills, x1, y1)).toBeCloseTo(level, 1);
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
});

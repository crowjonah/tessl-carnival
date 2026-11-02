import { describe, expect, it } from 'vitest';
import {
  CASTS_PER_ROUND,
  CAST_TIME,
  CATCH_RADIUS,
  DIP_TIME,
  DUCK_NUMBERS,
  DUCK_SPEED,
  HOOK,
  HOOK_ANGLE,
  STREAM,
  castHook,
  createState,
  duckAngle,
  duckUnderHook,
  moveDucks,
  resolveCast,
  step,
  streamPoint,
  wrapAngle,
  type HookADuckState,
} from './game';

const SPACING = (Math.PI * 2) / DUCK_NUMBERS.length;
/** Duck 7 carries the 50. */
const BIG_DUCK = DUCK_NUMBERS.indexOf(50);

/** Puts duck `i` exactly under the hook at the moment the hook dips. */
function lineUpAtDip(state: HookADuckState, i: number) {
  state.offset = wrapAngle(HOOK_ANGLE - i * SPACING - DUCK_SPEED * DIP_TIME);
}

/** Puts the hook exactly halfway between two ducks when it dips. */
function lineUpMissAtDip(state: HookADuckState) {
  state.offset = wrapAngle(HOOK_ANGLE - SPACING / 2 - DUCK_SPEED * DIP_TIME);
}

/** Casts, then steps until the cast is over. */
function castAndFinish(state: HookADuckState) {
  expect(castHook(state)).toBe(true);
  step(state, DIP_TIME);
  step(state, CAST_TIME - DIP_TIME);
}

describe('hook a duck', () => {
  it('starts with every cast and no score', () => {
    const state = createState();
    expect(state.casts).toBe(CASTS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.cast).toBeNull();
    expect(state.lastCatch).toBeNull();
    expect(state.phase).toBe('playing');
  });

  it('keeps the ducks on the loop at its boundary', () => {
    const state = createState();
    state.offset = Math.PI * 2 - 0.01;
    moveDucks(state, 0.05);
    expect(state.offset).toBeGreaterThanOrEqual(0);
    expect(state.offset).toBeCloseTo(0.02);
    expect(wrapAngle(Math.PI * 2)).toBe(0);
    expect(wrapAngle(-0.5)).toBeCloseTo(Math.PI * 2 - 0.5);
  });

  it('keeps the ducks on the loop after a very large update', () => {
    const state = createState();
    moveDucks(state, 10_000);
    expect(state.offset).toBeGreaterThanOrEqual(0);
    expect(state.offset).toBeLessThan(Math.PI * 2);
    expect(state.offset).toBeCloseTo(wrapAngle(DUCK_SPEED * 10_000));
    for (let i = 0; i < DUCK_NUMBERS.length; i++) {
      const a = duckAngle(state, i);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(Math.PI * 2);
    }
  });

  it('uses exactly one cast per cast, hit or miss', () => {
    const hit = createState();
    lineUpAtDip(hit, 0);
    castAndFinish(hit);
    expect(hit.casts).toBe(CASTS_PER_ROUND - 1);
    expect(hit.score).toBeGreaterThan(0);

    const miss = createState();
    lineUpMissAtDip(miss);
    castAndFinish(miss);
    expect(miss.casts).toBe(CASTS_PER_ROUND - 1);
    expect(miss.score).toBe(0);
  });

  it('rejects a cast while the hook is already down', () => {
    const state = createState();
    expect(castHook(state)).toBe(true);
    const inProgress = state.cast;
    expect(castHook(state)).toBe(false);
    step(state, DIP_TIME + 0.01);
    expect(castHook(state)).toBe(false);
    expect(state.casts).toBe(CASTS_PER_ROUND - 1);
    expect(state.cast).toBe(inProgress);
  });

  it('can cast again once the hook is back up', () => {
    const state = createState();
    castAndFinish(state);
    expect(state.cast).toBeNull();
    expect(castHook(state)).toBe(true);
    expect(state.casts).toBe(CASTS_PER_ROUND - 2);
  });

  it('catches a duck right under the hook and scores its exact number', () => {
    const state = createState();
    lineUpAtDip(state, BIG_DUCK);
    castAndFinish(state);
    expect(state.lastCatch?.duck).toBe(BIG_DUCK);
    expect(state.lastCatch?.points).toBe(50);
    expect(state.score).toBe(50);
  });

  it('scores each duck its own number', () => {
    DUCK_NUMBERS.forEach((points, i) => {
      const state = createState();
      lineUpAtDip(state, i);
      castAndFinish(state);
      expect(state.score).toBe(points);
    });
  });

  it('misses when the hook dips between ducks', () => {
    const state = createState();
    lineUpMissAtDip(state);
    castAndFinish(state);
    expect(state.lastCatch).toEqual({ duck: null, points: 0, age: expect.any(Number) });
    expect(state.score).toBe(0);
  });

  it('catches a duck just inside the catch radius, and not one just outside', () => {
    const state = createState();
    // Near the hook the loop runs sideways, so a small angle is close to a distance.
    const angleFor = (distance: number) => HOOK_ANGLE - Math.asin(distance / STREAM.rx);
    state.offset = angleFor(CATCH_RADIUS - 1);
    expect(
      Math.hypot(streamPoint(state.offset).x - HOOK.x, streamPoint(state.offset).y - HOOK.y),
    ).toBeLessThanOrEqual(CATCH_RADIUS);
    expect(duckUnderHook(state)).toBe(0);
    state.offset = angleFor(CATCH_RADIUS + 2);
    expect(duckUnderHook(state)).toBeNull();
  });

  it('resolves the catch where the ducks are at the dip, even in one large step', () => {
    const state = createState();
    lineUpAtDip(state, BIG_DUCK);
    castHook(state);
    step(state, CAST_TIME);
    expect(state.score).toBe(50);
    expect(state.cast).toBeNull();
  });

  it('awards a catch only once, however often it is stepped or resolved', () => {
    const state = createState();
    lineUpAtDip(state, BIG_DUCK);
    castHook(state);
    step(state, DIP_TIME);
    expect(state.score).toBe(50);
    resolveCast(state);
    step(state, 0.01);
    resolveCast(state);
    step(state, CAST_TIME);
    resolveCast(state);
    expect(state.score).toBe(50);
  });

  it('counts the final cast before the round ends', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      lineUpMissAtDip(state);
      castAndFinish(state);
    }
    expect(state.phase).toBe('playing');
    lineUpAtDip(state, BIG_DUCK);
    castHook(state);
    expect(state.casts).toBe(0);
    step(state, DIP_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, DIP_TIME / 2);
    expect(state.score).toBe(50);
    expect(state.phase).toBe('playing');
    step(state, CAST_TIME - DIP_TIME);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(50);
  });

  it('ignores casts and steps once the round is over', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND; i++) {
      lineUpMissAtDip(state);
      castAndFinish(state);
    }
    expect(state.phase).toBe('over');
    state.casts = 1;
    lineUpAtDip(state, BIG_DUCK);
    const offset = state.offset;
    expect(castHook(state)).toBe(false);
    step(state, CAST_TIME);
    resolveCast(state);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('over');
    expect(state.offset).toBe(offset);
  });

  it('resets the casts and the score for a fresh round', () => {
    const played = createState();
    lineUpAtDip(played, BIG_DUCK);
    castAndFinish(played);
    const fresh = createState();
    expect(fresh.casts).toBe(CASTS_PER_ROUND);
    expect(fresh.score).toBe(0);
    expect(fresh.cast).toBeNull();
    expect(fresh.lastCatch).toBeNull();
    expect(fresh.phase).toBe('playing');
  });
});

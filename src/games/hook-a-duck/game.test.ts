import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CASTS_PER_ROUND,
  CAST_TIME,
  CATCH_RADIUS,
  CATCH_TIME,
  DIP_TIME,
  DUCK_NUMBERS,
  DUCK_SPEED,
  HOOK,
  HOOK_ANGLE,
  LOW_CASTS,
  PAYOUTS,
  STREAM,
  castGauge,
  castHook,
  createState,
  duckAngle,
  duckUnderHook,
  isCatchShowing,
  isLowOnCasts,
  isRoundComplete,
  moveDucks,
  resolveCast,
  scoreRecorder,
  step,
  streamPoint,
  wrapAngle,
  type HookADuckState,
} from './game';
import hookADuck from './game';

const recordScore = vi.hoisted(() => vi.fn());
vi.mock('../../carnival', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../carnival')>()),
  recordScore,
}));

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

/** Casts, then steps until the cast is over and its catch or miss has faded. */
function castAndFade(state: HookADuckState) {
  castAndFinish(state);
  step(state, CATCH_TIME);
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
    step(state, CATCH_TIME);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(50);
  });

  it('keeps the final catch on screen for its full feedback time before the round ends', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      lineUpMissAtDip(state);
      castAndFade(state);
    }
    lineUpAtDip(state, BIG_DUCK);
    castAndFinish(state);
    expect(state.cast).toBeNull();
    expect(state.lastCatch?.points).toBe(50);
    expect(state.phase).toBe('playing');
    // The catch resolved at the dip, so it has been showing for CAST_TIME - DIP_TIME.
    step(state, CATCH_TIME - (CAST_TIME - DIP_TIME) - 0.01);
    expect(isCatchShowing(state)).toBe(true);
    expect(state.phase).toBe('playing');
    expect(castHook(state)).toBe(false);
    step(state, 0.02);
    expect(isCatchShowing(state)).toBe(false);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(50);
  });

  it('keeps the final miss on screen for its full feedback time before the round ends', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND; i++) {
      lineUpMissAtDip(state);
      castAndFinish(state);
      if (i < CASTS_PER_ROUND - 1) step(state, CATCH_TIME);
    }
    expect(state.lastCatch).toEqual({ duck: null, points: 0, age: expect.any(Number) });
    expect(state.phase).toBe('playing');
    step(state, CATCH_TIME - (CAST_TIME - DIP_TIME) - 0.01);
    expect(state.phase).toBe('playing');
    step(state, 0.02);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(0);
  });

  it('scores the final catch once and ends the round after one very large step', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      lineUpMissAtDip(state);
      castAndFade(state);
    }
    lineUpAtDip(state, BIG_DUCK);
    castHook(state);
    step(state, 100);
    expect(state.score).toBe(50);
    expect(state.phase).toBe('over');
    step(state, 100);
    resolveCast(state);
    expect(state.score).toBe(50);
  });

  it('times the final catch from the dip when one step covers the whole cast', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      lineUpMissAtDip(state);
      castAndFade(state);
    }
    lineUpAtDip(state, BIG_DUCK);
    castHook(state);
    step(state, CAST_TIME);
    expect(state.lastCatch?.age).toBeCloseTo(CAST_TIME - DIP_TIME);
    expect(state.phase).toBe('playing');
    step(state, CATCH_TIME - (CAST_TIME - DIP_TIME) - 0.01);
    expect(state.phase).toBe('playing');
    step(state, 0.02);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(50);
  });

  it('lists each possible payout once, lowest first, matching the ducks', () => {
    expect(PAYOUTS).toEqual([5, 10, 20, 50]);
    expect(new Set(PAYOUTS)).toEqual(new Set(DUCK_NUMBERS));
  });

  it('shows a full gauge at the start of a round', () => {
    const gauge = castGauge(createState());
    expect(gauge.label).toBe('Casts');
    expect(gauge.low).toBe(false);
    expect(gauge.pips).toHaveLength(CASTS_PER_ROUND);
    expect(gauge.pips.every(Boolean)).toBe(true);
  });

  it('warns when casts are low, and says when they are gone', () => {
    const state = createState();
    for (let casts = CASTS_PER_ROUND; casts >= 0; casts--) {
      state.casts = casts;
      const gauge = castGauge(state);
      expect(gauge.pips.filter(Boolean)).toHaveLength(casts);
      expect(gauge.low).toBe(casts <= LOW_CASTS);
      expect(isLowOnCasts(state)).toBe(casts <= LOW_CASTS);
    }
    state.casts = LOW_CASTS + 1;
    expect(castGauge(state).label).toBe('Casts');
    for (const casts of [3, 2, 1]) {
      state.casts = casts;
      expect(castGauge(state).label).toBe('Low casts!');
    }
    state.casts = 0;
    expect(castGauge(state).label).toBe('Out of casts!');
  });

  it('uses one pip per accepted cast and none for a rejected one', () => {
    const state = createState();
    castHook(state);
    expect(castGauge(state).pips.filter(Boolean)).toHaveLength(CASTS_PER_ROUND - 1);
    castHook(state);
    step(state, DIP_TIME);
    castHook(state);
    expect(state.casts).toBe(CASTS_PER_ROUND - 1);
    expect(castGauge(state).pips.filter(Boolean)).toHaveLength(CASTS_PER_ROUND - 1);
  });

  it('rejects casts once they run out, while the last catch is still showing', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND; i++) {
      lineUpMissAtDip(state);
      castAndFinish(state);
    }
    expect(state.phase).toBe('playing');
    expect(castHook(state)).toBe(false);
    expect(state.casts).toBe(0);
  });

  it('ignores casts and steps once the round is over', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND; i++) {
      lineUpMissAtDip(state);
      castAndFade(state);
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
    expect(isCatchShowing(fresh)).toBe(false);
    expect(castGauge(fresh)).toEqual(castGauge(createState()));
    expect(castGauge(fresh).label).toBe('Casts');
    expect(fresh.casts).toBe(CASTS_PER_ROUND);
    expect(fresh.score).toBe(0);
    expect(fresh.cast).toBeNull();
    expect(fresh.lastCatch).toBeNull();
    expect(fresh.phase).toBe('playing');
  });

  it('counts the round complete once the last cast is back up, before its catch fades', () => {
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      lineUpMissAtDip(state);
      castAndFade(state);
    }
    lineUpAtDip(state, BIG_DUCK);
    expect(castHook(state)).toBe(true);
    step(state, DIP_TIME);
    expect(isRoundComplete(state)).toBe(false);
    step(state, CAST_TIME - DIP_TIME);
    expect(isRoundComplete(state)).toBe(true);
    expect(isCatchShowing(state)).toBe(true);
    expect(state.phase).toBe('playing');
  });

  it('records the score once, as soon as the round is complete', () => {
    const record = vi.fn();
    const save = scoreRecorder(record);
    const state = createState();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      lineUpMissAtDip(state);
      castAndFade(state);
      save(state);
    }
    lineUpAtDip(state, BIG_DUCK);
    castHook(state);
    step(state, DIP_TIME);
    save(state);
    expect(record).not.toHaveBeenCalled();
    step(state, CAST_TIME - DIP_TIME);
    save(state);
    expect(record).toHaveBeenCalledExactlyOnceWith(50);
    step(state, CATCH_TIME);
    expect(state.phase).toBe('over');
    save(state);
    expect(record).toHaveBeenCalledTimes(1);
  });
});

describe('hook a duck start', () => {
  let frame: FrameRequestCallback | null = null;
  let now = 0;
  let onDown: () => void = () => {};

  function startGame() {
    const ctx = new Proxy({}, { get: () => () => ({}), set: () => true });
    const canvas = {
      getContext: () => ctx,
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'pointerdown') onDown = listener;
      },
      removeEventListener: () => {},
    };
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      frame = null;
    });
    return hookADuck.start(canvas as unknown as HTMLCanvasElement);
  }

  /** Runs the animation loop for `seconds`, in 50 ms frames. */
  function run(seconds: number) {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      now += 50;
      frame?.(now);
    }
  }

  /** Makes every cast in the round and runs until the last one is back up. */
  function castAll() {
    for (let i = 0; i < CASTS_PER_ROUND; i++) {
      onDown();
      run(CAST_TIME + 0.05);
    }
  }

  afterEach(() => {
    recordScore.mockClear();
    vi.unstubAllGlobals();
    frame = null;
    now = 0;
  });

  it('saves the completed score when you leave during the final feedback', () => {
    const stop = startGame();
    castAll();
    stop();
    expect(recordScore).toHaveBeenCalledExactlyOnceWith('hook-a-duck', expect.any(Number));
  });

  it('saves nothing when you leave while the last cast is still down', () => {
    const stop = startGame();
    for (let i = 0; i < CASTS_PER_ROUND - 1; i++) {
      onDown();
      run(CAST_TIME + 0.05);
    }
    onDown();
    run(DIP_TIME);
    stop();
    expect(recordScore).not.toHaveBeenCalled();
  });

  it('saves the score exactly once when the round runs to the game over screen', () => {
    const stop = startGame();
    castAll();
    run(CATCH_TIME + 0.1);
    stop();
    expect(recordScore).toHaveBeenCalledTimes(1);
  });
});

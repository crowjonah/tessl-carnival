import { describe, expect, it } from 'vitest';
import {
  END_SPAWN_INTERVAL,
  HOLES,
  HOLE_RADIUS,
  MOLE_LIFETIME,
  POINTS_PER_WHACK,
  ROUND_DURATION,
  START_SPAWN_INTERVAL,
  createState,
  holeAt,
  spawnInterval,
  spawnMole,
  step,
  timeLeft,
  whack,
} from './game';

/** Always picks the first empty hole. */
const first = () => 0;
/** Always picks the last empty hole. */
const last = () => 0.99;

describe('whack-a-mole', () => {
  it('starts with no score, a full timer and every hole empty', () => {
    const state = createState();
    expect(state.score).toBe(0);
    expect(state.elapsed).toBe(0);
    expect(timeLeft(state)).toBe(ROUND_DURATION);
    expect(state.holes).toHaveLength(HOLES.length);
    expect(state.holes.every((mole) => mole === null)).toBe(true);
    expect(state.nextSpawn).toBe(START_SPAWN_INTERVAL);
    expect(state.phase).toBe('playing');
  });

  it('pops a mole up in the hole the random choice picks', () => {
    const state = createState();
    expect(spawnMole(state, () => 0.5)).toBe(4);
    expect(state.holes[4]).toEqual({ age: 0 });
  });

  it('only picks empty holes, and none when every hole is taken', () => {
    const state = createState();
    spawnMole(state, first);
    expect(spawnMole(state, first)).toBe(1);
    for (let i = 2; i < HOLES.length; i++) spawnMole(state, first);
    expect(spawnMole(state, first)).toBe(-1);
  });

  it('pops the first mole up after the starting interval', () => {
    const state = createState();
    step(state, START_SPAWN_INTERVAL - 0.25, first);
    expect(state.holes[0]).toBeNull();
    step(state, 0.25, first);
    expect(state.holes[0]).not.toBeNull();
  });

  it('keeps a mole hittable through its lifetime, then drops it back down', () => {
    const state = createState();
    spawnMole(state, first);
    step(state, MOLE_LIFETIME - 0.25, last);
    expect(state.holes[0]).not.toBeNull();
    step(state, 0.25, last);
    expect(state.holes[0]).toBeNull();
  });

  it('scores the first whack on a visible mole only', () => {
    const state = createState();
    spawnMole(state, first);
    expect(whack(state, 0)).toBe(POINTS_PER_WHACK);
    expect(state.holes[0]).toBeNull();
    expect(whack(state, 0)).toBe(0);
    expect(state.score).toBe(POINTS_PER_WHACK);
  });

  it('scores nothing for an empty hole', () => {
    const state = createState();
    expect(whack(state, 3)).toBe(0);
    expect(state.score).toBe(0);
  });

  it('scores nothing for a mole that has dropped back down', () => {
    const state = createState();
    spawnMole(state, first);
    step(state, MOLE_LIFETIME, last);
    expect(whack(state, 0)).toBe(0);
    expect(state.score).toBe(0);
  });

  it('scores nothing for a mole past its lifetime, even before a step clears it', () => {
    const state = createState();
    state.holes[2] = { age: MOLE_LIFETIME };
    expect(whack(state, 2)).toBe(0);
    expect(state.score).toBe(0);
  });

  it('pops moles up faster as the round goes on, and never at zero', () => {
    expect(spawnInterval(0)).toBe(START_SPAWN_INTERVAL);
    expect(spawnInterval(ROUND_DURATION)).toBeCloseTo(END_SPAWN_INTERVAL);
    expect(spawnInterval(ROUND_DURATION * 2)).toBeCloseTo(END_SPAWN_INTERVAL);
    for (let t = 1; t <= ROUND_DURATION; t++) {
      expect(spawnInterval(t)).toBeLessThan(spawnInterval(t - 1));
      expect(spawnInterval(t)).toBeGreaterThan(0);
    }
  });

  it('spaces spawns closer together late in a played round', () => {
    const state = createState();
    const spawnTimes: number[] = [];
    while (state.phase === 'playing') {
      const before = state.nextSpawn;
      step(state, 0.01, first);
      if (state.nextSpawn > before) spawnTimes.push(state.elapsed);
      // Clear the holes so every spawn has room.
      state.holes = state.holes.map(() => null);
    }
    const gaps = spawnTimes.slice(1).map((t, i) => t - spawnTimes[i]);
    expect(gaps.length).toBeGreaterThan(2);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]);
    expect(gaps.every((gap) => gap > 0)).toBe(true);
  });

  it('ends the round exactly at its duration', () => {
    const state = createState();
    step(state, ROUND_DURATION - 0.5, last);
    expect(state.phase).toBe('playing');
    step(state, 0.5, first);
    expect(state.phase).toBe('over');
    expect(state.elapsed).toBe(ROUND_DURATION);
    expect(timeLeft(state)).toBe(0);
  });

  it('ends the round when a step crosses the duration, with no scoring or spawning after', () => {
    const state = createState();
    step(state, ROUND_DURATION - 0.1, first);
    state.holes[5] = { age: 0 };
    step(state, 5, first);
    expect(state.phase).toBe('over');
    expect(state.elapsed).toBe(ROUND_DURATION);
    expect(state.holes.every((mole) => mole === null)).toBe(true);

    state.holes[5] = { age: 0 };
    expect(whack(state, 5)).toBe(0);
    state.holes[5] = null;
    step(state, 10, first);
    expect(state.holes.every((mole) => mole === null)).toBe(true);
    expect(state.score).toBe(0);
  });

  it('starts a fresh round from scratch', () => {
    const played = createState();
    spawnMole(played, first);
    whack(played, 0);
    step(played, ROUND_DURATION, first);

    const fresh = createState();
    expect(fresh).toEqual({
      holes: HOLES.map(() => null),
      bonks: [],
      elapsed: 0,
      nextSpawn: START_SPAWN_INTERVAL,
      score: 0,
      phase: 'playing',
    });
    expect(spawnInterval(fresh.elapsed)).toBe(START_SPAWN_INTERVAL);
  });

  it('finds the hole under a click', () => {
    expect(holeAt(HOLES[4].x, HOLES[4].y)).toBe(4);
    expect(holeAt(HOLES[0].x + HOLE_RADIUS, HOLES[0].y)).toBe(0);
    expect(holeAt(0, 0)).toBe(-1);
  });
});

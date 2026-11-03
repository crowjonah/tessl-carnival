import { describe, expect, it } from 'vitest';
import {
  END_SPAWN_INTERVAL,
  FEEDBACK_TIME,
  LOW_TIME,
  REWARD_RULE,
  HOLES,
  HOLE_RADIUS,
  MOLE_LIFETIME,
  POINTS_PER_WHACK,
  ROUND_DURATION,
  START_SPAWN_INTERVAL,
  createState,
  frameSeconds,
  holeAt,
  isLowTime,
  spawnInterval,
  spawnMole,
  step,
  timeLeft,
  timeReadout,
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
      feedback: [],
      elapsed: 0,
      nextSpawn: START_SPAWN_INTERVAL,
      score: 0,
      phase: 'playing',
    });
    expect(spawnInterval(fresh.elapsed)).toBe(START_SPAWN_INTERVAL);
  });

  it('keeps the overshoot past a spawn, so a mole due at 1 s is gone by 2 s', () => {
    const state = createState();
    step(state, 1.5, first);
    expect(state.holes[0]).toEqual({ age: 0.5 });
    step(state, 0.5, first);
    expect(state.elapsed).toBe(2);
    expect(state.holes[0]).toBeNull();
    expect(whack(state, 0)).toBe(0);
  });

  it('spawns every mole due inside one long step, at its own time', () => {
    const state = createState();
    // Spawns are due at 1 s and about 1.98 s; the first expires at 2 s.
    step(state, 2.5, first);
    expect(state.holes[0]).toBeNull();
    expect(state.holes[1]?.age).toBeCloseTo(2.5 - (1 + spawnInterval(1)));
    expect(state.nextSpawn).toBeCloseTo(
      1 + spawnInterval(1) + spawnInterval(1 + spawnInterval(1)) - 2.5,
    );
  });

  it('ends the same whether time comes in one step or many', () => {
    const random = () => 0.37;
    const partitions = [[10], [3, 0.7, 2.2, 4.1], Array.from({ length: 100 }, () => 0.1)];
    const results = partitions.map((steps) => {
      const state = createState();
      for (const dt of steps) step(state, dt, random);
      return state;
    });
    for (const state of results.slice(1)) {
      expect(state.elapsed).toBeCloseTo(results[0].elapsed);
      expect(state.nextSpawn).toBeCloseTo(results[0].nextSpawn);
      expect(state.holes.map((mole) => mole !== null)).toEqual(
        results[0].holes.map((mole) => mole !== null),
      );
      state.holes.forEach((mole, i) => {
        if (mole) expect(mole.age).toBeCloseTo(results[0].holes[i]!.age);
      });
    }
  });

  it('counts the whole of a slow frame', () => {
    expect(frameSeconds(null, 500)).toBe(0);
    expect(frameSeconds(1000, 1100)).toBeCloseTo(0.1);
    expect(frameSeconds(1000, 3000)).toBe(2);
    expect(frameSeconds(1000, 900)).toBe(0);
  });

  it('finishes the round after 30 seconds of slow frames', () => {
    const state = createState();
    let last: number | null = null;
    let frames = 0;
    // 100 ms frames: the first frame starts the clock, then 300 more cover 30 s.
    for (let time = 0; frames <= 300; time += 100, frames++) {
      step(state, frameSeconds(last, time), first);
      last = time;
      if (frames < 300) expect(state.phase).toBe('playing');
    }
    expect(state.phase).toBe('over');
    expect(timeLeft(state)).toBe(0);
  });

  it('finds the hole under a click', () => {
    expect(holeAt(HOLES[4].x, HOLES[4].y)).toBe(4);
    expect(holeAt(HOLES[0].x + HOLE_RADIUS, HOLES[0].y)).toBe(0);
    expect(holeAt(0, 0)).toBe(-1);
  });

  describe('feedback', () => {
    it('shows the reward rule from the points a whack scores', () => {
      expect(REWARD_RULE).toBe(`+${POINTS_PER_WHACK} per whack, 0 per miss`);
    });

    it('shows a hit with its points, once', () => {
      const state = createState();
      spawnMole(state, first);
      whack(state, 0);
      expect(state.feedback).toEqual([{ hole: 0, points: POINTS_PER_WHACK, age: 0 }]);
      expect(state.score).toBe(POINTS_PER_WHACK);
    });

    it('shows a miss as zero points, with no penalty', () => {
      const state = createState();
      spawnMole(state, first);
      whack(state, 0);
      whack(state, 0);
      whack(state, 3);
      expect(state.feedback).toEqual([
        { hole: 0, points: 0, age: 0 },
        { hole: 3, points: 0, age: 0 },
      ]);
      expect(state.score).toBe(POINTS_PER_WHACK);
    });

    it('keeps feedback on screen for its full lifetime, then drops it', () => {
      const state = createState();
      whack(state, 3);
      step(state, FEEDBACK_TIME - 0.01, last);
      expect(state.feedback).toHaveLength(1);
      expect(state.feedback[0].age).toBeCloseTo(FEEDBACK_TIME - 0.01);
      step(state, 0.01, last);
      expect(state.feedback).toHaveLength(0);
    });

    it('shows the last hit in full before the round is over, without extra playing time', () => {
      const state = createState();
      step(state, ROUND_DURATION - 0.1, last);
      state.holes[4] = { age: 0 };
      whack(state, 4);
      const score = state.score;

      step(state, 0.1, first);
      expect(state.phase).toBe('ending');
      expect(state.elapsed).toBe(ROUND_DURATION);
      expect(timeLeft(state)).toBe(0);
      expect(state.feedback).toHaveLength(1);

      // Nothing scores or spawns while the last feedback fades.
      state.holes[2] = { age: 0 };
      expect(whack(state, 2)).toBe(0);
      state.holes[2] = null;
      expect(state.feedback).toHaveLength(1);
      step(state, FEEDBACK_TIME - 0.1 - 0.01, first);
      expect(state.phase).toBe('ending');
      expect(state.holes.every((mole) => mole === null)).toBe(true);
      expect(state.elapsed).toBe(ROUND_DURATION);

      step(state, 0.01, first);
      expect(state.phase).toBe('over');
      expect(state.score).toBe(score);
      expect(state.feedback).toHaveLength(0);
    });

    it('ends the scoring window at the same moment however large the step', () => {
      for (const dt of [0.5, 5, 60]) {
        const state = createState();
        step(state, ROUND_DURATION - 0.2, last);
        whack(state, 0);
        step(state, dt, first);
        expect(state.elapsed).toBe(ROUND_DURATION);
        expect(state.phase).toBe(dt >= FEEDBACK_TIME ? 'over' : 'ending');
        expect(state.holes.every((mole) => mole === null)).toBe(true);
      }
      const short = createState();
      step(short, ROUND_DURATION - 0.2, last);
      step(short, 0.1, first);
      expect(short.phase).toBe('playing');
      expect(timeLeft(short)).toBeCloseTo(0.1);
    });

    it('ignores input after the round, and changes nothing', () => {
      const state = createState();
      step(state, ROUND_DURATION, first);
      expect(state.phase).toBe('over');
      state.holes[1] = { age: 0 };
      expect(whack(state, 1)).toBe(0);
      expect(whack(state, 5)).toBe(0);
      expect(state.feedback).toEqual([]);
      expect(state.bonks).toEqual([]);
      expect(state.score).toBe(0);
    });

    it('starts a replay with the full time budget and no feedback', () => {
      const played = createState();
      step(played, ROUND_DURATION - 0.1, last);
      whack(played, 0);
      step(played, 5, first);
      expect(played.phase).toBe('over');

      const fresh = createState();
      expect(fresh.feedback).toEqual([]);
      expect(isLowTime(fresh)).toBe(false);
      expect(timeReadout(fresh)).toEqual({
        label: 'Time',
        seconds: ROUND_DURATION,
        total: ROUND_DURATION,
        fraction: 1,
      });
    });
  });

  describe('time budget', () => {
    it('agrees with the gauge at the start, around the warning and at zero', () => {
      const state = createState();
      expect(timeReadout(state)).toMatchObject({
        label: 'Time',
        seconds: 30,
        total: 30,
        fraction: 1,
      });

      step(state, ROUND_DURATION - LOW_TIME - 0.5, last);
      expect(isLowTime(state)).toBe(false);
      expect(timeReadout(state)).toMatchObject({ label: 'Time', seconds: LOW_TIME + 1 });
      expect(timeReadout(state).fraction).toBeCloseTo((LOW_TIME + 0.5) / ROUND_DURATION);

      step(state, 0.5, last);
      expect(isLowTime(state)).toBe(true);
      expect(timeReadout(state)).toMatchObject({ label: 'Hurry!', seconds: LOW_TIME });
      expect(timeReadout(state).fraction).toBeCloseTo(LOW_TIME / ROUND_DURATION);

      step(state, LOW_TIME - 0.5, last);
      expect(timeReadout(state)).toMatchObject({ label: 'Hurry!', seconds: 1 });

      step(state, 0.5, last);
      expect(isLowTime(state)).toBe(false);
      expect(timeReadout(state)).toEqual({
        label: "Time's up!",
        seconds: 0,
        total: ROUND_DURATION,
        fraction: 0,
      });
    });
  });
});

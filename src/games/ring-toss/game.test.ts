import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  FOUL_LINE,
  LOW_RINGS,
  NECK_RADIUS,
  RESULT_TIME,
  RINGS_PER_ROUND,
  ROWS,
  bottleAt,
  createState,
  isLowRings,
  isRoundComplete,
  landRing,
  landingText,
  ringsLabel,
  rowLabel,
  ringPosition,
  step,
  swayOffset,
  throwRing,
  type RingTossState,
} from './game';

const backRow = ROWS[0];
const frontRow = ROWS[ROWS.length - 1];

function bottleIn(state: RingTossState, row: { y: number }) {
  const bottle = state.bottles.find((b) => b.y === row.y);
  if (!bottle) throw new Error('No bottle in that row');
  return bottle;
}

/** Throws at (x, y) with no sway, then lets the ring land. */
function tossAndLand(state: RingTossState, x: number, y: number) {
  state.time = 0;
  expect(throwRing(state, x, y)).toBe(true);
  step(state, FLIGHT_TIME);
}

/** Throws every ring but the last as a miss. */
function throwAllButOne(state: RingTossState) {
  for (let i = 0; i < RINGS_PER_ROUND - 1; i++) tossAndLand(state, 0, 0);
}

/** Plays a whole round of misses and lets the last result fade. */
function playOut(state: RingTossState) {
  for (let i = 0; i < RINGS_PER_ROUND; i++) tossAndLand(state, 0, 0);
  step(state, RESULT_TIME);
}

describe('ring toss', () => {
  it('starts with every ring and no score', () => {
    const state = createState();
    expect(state.rings).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.ring).toBeNull();
    expect(state.phase).toBe('playing');
  });

  it('uses exactly one ring per throw', () => {
    const state = createState();
    expect(throwRing(state, 400, 200)).toBe(true);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring).not.toBeNull();
  });

  it('will not throw a second ring while one is in the air', () => {
    const state = createState();
    throwRing(state, 400, 200);
    const inFlight = state.ring;
    step(state, FLIGHT_TIME / 2);
    expect(throwRing(state, 100, 100)).toBe(false);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring).toBe(inFlight);
  });

  it('can throw again once the ring has landed', () => {
    const state = createState();
    tossAndLand(state, 400, 200);
    expect(state.ring).toBeNull();
    expect(throwRing(state, 400, 200)).toBe(true);
    expect(state.rings).toBe(RINGS_PER_ROUND - 2);
  });

  it('scores a ring that lands on a bottle neck', () => {
    const state = createState();
    const bottle = bottleIn(state, backRow);
    tossAndLand(state, bottle.x, bottle.y);
    expect(state.score).toBe(backRow.points);
    expect(state.lastLanding?.points).toBe(backRow.points);
  });

  it('scores a ring just inside the neck, and not one just outside', () => {
    const state = createState();
    const bottle = bottleIn(state, frontRow);
    expect(bottleAt(state.bottles, bottle.x + NECK_RADIUS, bottle.y)).toBe(bottle);
    expect(bottleAt(state.bottles, bottle.x + NECK_RADIUS + 1, bottle.y)).toBeUndefined();
  });

  it('scores nothing for a miss', () => {
    const state = createState();
    const bottle = bottleIn(state, backRow);
    tossAndLand(state, bottle.x + NECK_RADIUS * 3, bottle.y);
    expect(state.score).toBe(0);
    expect(state.lastLanding?.points).toBe(0);
  });

  it('scores a landing only once, however often it is stepped', () => {
    const state = createState();
    const bottle = bottleIn(state, backRow);
    tossAndLand(state, bottle.x, bottle.y);
    step(state, FLIGHT_TIME);
    step(state, 1);
    landRing(state);
    expect(state.score).toBe(backRow.points);
  });

  it('scores more for a farther bottle than a nearer one', () => {
    const far = createState();
    const near = createState();
    const farBottle = bottleIn(far, backRow);
    const nearBottle = bottleIn(near, frontRow);
    tossAndLand(far, farBottle.x, farBottle.y);
    tossAndLand(near, nearBottle.x, nearBottle.y);
    expect(far.score).toBeGreaterThan(near.score);
    for (let i = 1; i < ROWS.length; i++) {
      expect(ROWS[i - 1].points).toBeGreaterThan(ROWS[i].points);
    }
  });

  it('lands where it was aimed, shifted by the sway at the throw', () => {
    const state = createState();
    state.time = 0.4;
    throwRing(state, 300, 150);
    expect(state.ring?.toX).toBeCloseTo(300 + swayOffset(0.4));
    expect(state.ring?.toY).toBe(150);
  });

  it('never throws a ring short of the foul line', () => {
    const state = createState();
    throwRing(state, 400, FOUL_LINE + 100);
    expect(state.ring?.toY).toBe(FOUL_LINE);
  });

  it('flies a ring from the thrower to its landing spot', () => {
    const state = createState();
    throwRing(state, 400, 100);
    const ring = state.ring!;
    expect(ringPosition(ring)).toEqual({ x: ring.fromX, y: ring.fromY });
    step(state, FLIGHT_TIME / 2);
    expect(ringPosition(ring).y).toBeCloseTo((ring.fromY + ring.toY) / 2);
  });

  it('counts the last ring, then ends the round once it lands', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) tossAndLand(state, 0, 0);
    expect(state.phase).toBe('playing');
    const bottle = bottleIn(state, backRow);
    state.time = 0;
    throwRing(state, bottle.x, bottle.y);
    expect(state.rings).toBe(0);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(backRow.points);
    expect(state.phase).not.toBe('playing');
  });

  it('keeps the final landing on screen before the round is over', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) tossAndLand(state, 0, 0);
    const bottle = bottleIn(state, backRow);
    tossAndLand(state, bottle.x, bottle.y);
    expect(state.lastLanding).toMatchObject({ points: backRow.points, age: 0 });
    expect(state.phase).not.toBe('over');
  });

  it('shows a final hit for the full result time before the round is over', () => {
    const state = createState();
    throwAllButOne(state);
    const bottle = bottleIn(state, backRow);
    tossAndLand(state, bottle.x, bottle.y);
    expect(state.phase).toBe('finishing');
    step(state, RESULT_TIME - 0.01);
    expect(state.phase).toBe('finishing');
    step(state, 0.01);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(backRow.points);
  });

  it('shows a final miss for the full result time before the round is over', () => {
    const state = createState();
    throwAllButOne(state);
    tossAndLand(state, 0, 0);
    expect(state.lastLanding?.points).toBe(0);
    expect(state.phase).toBe('finishing');
    step(state, RESULT_TIME / 2);
    expect(state.phase).toBe('finishing');
    step(state, RESULT_TIME / 2);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(0);
  });

  it('still shows the final result when one large step lands the last ring', () => {
    const state = createState();
    throwAllButOne(state);
    const bottle = bottleIn(state, backRow);
    state.time = 0;
    throwRing(state, bottle.x, bottle.y);
    step(state, 10);
    expect(state.lastLanding).toMatchObject({ points: backRow.points, age: 0 });
    expect(state.phase).toBe('finishing');
    step(state, 10);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(backRow.points);
  });

  it('throws nothing and scores nothing while the last result finishes', () => {
    const state = createState();
    throwAllButOne(state);
    const bottle = bottleIn(state, backRow);
    tossAndLand(state, bottle.x, bottle.y);
    expect(state.phase).toBe('finishing');
    expect(throwRing(state, bottle.x, bottle.y)).toBe(false);
    state.rings = 1;
    expect(throwRing(state, bottle.x, bottle.y)).toBe(false);
    expect(state.ring).toBeNull();
    expect(state.score).toBe(backRow.points);
  });

  it('ignores throws and steps once the round is over', () => {
    const state = createState();
    playOut(state);
    expect(state.phase).toBe('over');
    const bottle = bottleIn(state, backRow);
    state.rings = 1;
    expect(throwRing(state, bottle.x, bottle.y)).toBe(false);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('over');
  });

  it('resets the rings, score, result and warning for a fresh round', () => {
    const played = createState();
    playOut(played);
    expect(isLowRings(played)).toBe(true);
    const fresh = createState();
    expect(fresh.rings).toBe(RINGS_PER_ROUND);
    expect(fresh.score).toBe(0);
    expect(fresh.ring).toBeNull();
    expect(fresh.lastLanding).toBeNull();
    expect(fresh.phase).toBe('playing');
    expect(isLowRings(fresh)).toBe(false);
    expect(ringsLabel(fresh)).toBe('Rings');
  });

  it('does not use a ring for a throw that is turned down', () => {
    const state = createState();
    throwRing(state, 400, 200);
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(state.lastLanding?.points);
  });

  it('warns at LOW_RINGS or fewer, and says when no rings are left', () => {
    const state = createState();
    expect(ringsLabel(state)).toBe('Rings');
    state.rings = LOW_RINGS + 1;
    expect(isLowRings(state)).toBe(false);
    expect(ringsLabel(state)).toBe('Rings');
    for (let rings = LOW_RINGS; rings >= 1; rings--) {
      state.rings = rings;
      expect(isLowRings(state)).toBe(true);
      expect(ringsLabel(state)).toBe('Low rings!');
    }
    state.rings = 0;
    expect(isLowRings(state)).toBe(true);
    expect(ringsLabel(state)).toBe('No rings left');
  });

  it('labels each row with the points it pays', () => {
    expect(ROWS.map(rowLabel)).toEqual(ROWS.map((row) => `${row.points} pts`));
    for (const row of ROWS) {
      const fresh = createState();
      const bottle = bottleIn(fresh, row);
      tossAndLand(fresh, bottle.x, bottle.y);
      expect(fresh.score).toBe(row.points);
      expect(rowLabel(row)).toBe(`${fresh.score} pts`);
    }
  });

  it('shows a hit as the points it added and a miss as adding nothing', () => {
    expect(landingText({ points: backRow.points })).toBe(`+${backRow.points}`);
    expect(landingText({ points: 0 })).toBe('Miss +0');
  });

  it('counts the round as complete once the last ring has landed, not before', () => {
    const state = createState();
    throwAllButOne(state);
    const bottle = bottleIn(state, backRow);
    state.time = 0;
    throwRing(state, bottle.x, bottle.y);
    expect(isRoundComplete(state)).toBe(false);
    step(state, FLIGHT_TIME);
    expect(state.phase).toBe('finishing');
    expect(isRoundComplete(state)).toBe(true);
    expect(state.score).toBe(backRow.points);
  });
});

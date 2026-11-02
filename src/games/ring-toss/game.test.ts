import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  FOUL_LINE,
  NECK_RADIUS,
  RINGS_PER_ROUND,
  ROWS,
  bottleAt,
  createState,
  landRing,
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
    expect(state.phase).toBe('over');
  });

  it('ignores throws and steps once the round is over', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND; i++) tossAndLand(state, 0, 0);
    expect(state.phase).toBe('over');
    const bottle = bottleIn(state, backRow);
    state.rings = 1;
    expect(throwRing(state, bottle.x, bottle.y)).toBe(false);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('over');
  });

  it('resets the rings and the score for a fresh round', () => {
    const played = createState();
    const bottle = bottleIn(played, backRow);
    tossAndLand(played, bottle.x, bottle.y);
    const fresh = createState();
    expect(fresh.rings).toBe(RINGS_PER_ROUND);
    expect(fresh.score).toBe(0);
    expect(fresh.ring).toBeNull();
    expect(fresh.phase).toBe('playing');
  });
});

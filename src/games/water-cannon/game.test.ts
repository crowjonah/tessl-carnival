import { describe, expect, it } from 'vitest';
import {
  CANNON,
  LOW_WATER,
  RAILS,
  TANK_SIZE,
  createState,
  fire,
  isHit,
  isLowWater,
  scoreForHit,
  step,
  type Target,
} from './game';

const target: Target = { x: 400, y: 200, radius: 28, speed: 120 };

describe('water cannon', () => {
  it('starts with a full tank and no score', () => {
    const state = createState();
    expect(state.tank).toBe(TANK_SIZE);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('uses one shot of water per fire', () => {
    const state = createState();
    expect(fire(state, 400, 0)).toBe(true);
    expect(state.tank).toBe(TANK_SIZE - 1);
    expect(state.shots).toHaveLength(1);
  });

  it('cannot fire once the tank is empty', () => {
    const state = createState();
    state.tank = 0;
    expect(fire(state, 400, 0)).toBe(false);
    expect(state.shots).toHaveLength(0);
  });

  it('never fires downwards, even when aimed below the cannon', () => {
    const state = createState();
    fire(state, CANNON.x + 100, CANNON.y + 100);
    expect(state.shots[0].vy).toBeLessThan(0);
  });

  it('scores a hit and sends the target back to the start of its rail', () => {
    const state = createState();
    state.targets = [{ ...target }];
    state.shots = [{ x: target.x, y: target.y + 5, vx: 0, vy: 0 }];
    step(state, 0);
    expect(state.score).toBe(scoreForHit(target));
    expect(state.shots).toHaveLength(0);
    expect(state.targets[0].x).toBeLessThan(0);
  });

  it('ends the game when the tank is empty and the last shot has landed', () => {
    const state = createState();
    state.tank = 0;
    state.shots = [{ x: 10, y: -20, vx: 0, vy: -700 }];
    step(state, 0.1);
    expect(state.phase).toBe('over');
  });

  it('keeps playing while a shot is still in the air', () => {
    const state = createState();
    state.targets = [];
    state.tank = 0;
    state.shots = [{ x: 400, y: 300, vx: 0, vy: -700 }];
    step(state, 0.1);
    expect(state.phase).toBe('playing');
  });

  it('detects a hit inside the target and a miss outside it', () => {
    expect(isHit({ x: 410, y: 210, vx: 0, vy: 0 }, target)).toBe(true);
    expect(isHit({ x: 460, y: 200, vx: 0, vy: 0 }, target)).toBe(false);
  });

  it('scores a fast target higher than a slow one', () => {
    const slow = scoreForHit({ ...target, speed: 60 });
    const fast = scoreForHit({ ...target, speed: -180 });
    expect(Math.max(fast, slow)).toBeGreaterThanOrEqual(slow);
  });

  it('shows each rail as worth 30, 20 and 10 points from top to bottom', () => {
    expect(RAILS.map((rail) => scoreForHit(rail))).toEqual([30, 20, 10]);
  });

  it('marks the tank as low only once it reaches the low water mark', () => {
    const state = createState();
    expect(isLowWater(state)).toBe(false);
    state.tank = LOW_WATER + 1;
    expect(isLowWater(state)).toBe(false);
    state.tank = LOW_WATER;
    expect(isLowWater(state)).toBe(true);
  });

  it('marks the target that took a shot, with the points it scored', () => {
    const state = createState();
    const near = { ...target, y: 290, radius: 34, speed: 60 };
    const far = { ...target, y: 110, radius: 22, speed: 180 };
    state.targets = [far, near];
    state.shots = [{ x: near.x, y: near.y + 5, vx: 0, vy: 0 }];
    const hitAt = { x: near.x, y: near.y };
    step(state, 0);
    expect(state.splashes).toEqual([{ ...hitAt, radius: near.radius, points: 10, age: 0 }]);
    expect(state.score).toBe(10);
  });
});

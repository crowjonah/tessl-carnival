import { describe, expect, it } from 'vitest';
import { ROUND_TIME, createState, pop, step } from './game';

describe('lens check', () => {
  it('scores a pop while the round is on', () => {
    const state = createState();
    pop(state);
    expect(state.score).toBe(10);
  });

  it('ends the round when the timer runs out', () => {
    const state = createState();
    step(state, ROUND_TIME);
    expect(state.phase).toBe('over');
  });
});

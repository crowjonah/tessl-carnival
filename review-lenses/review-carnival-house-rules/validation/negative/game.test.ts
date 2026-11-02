import { describe, expect, it } from 'vitest';
import { ROUND_TIME, createState, pop, step } from './game';

// Test data the lens must not report: literal scores and a colour in a fixture.
const fixture = { score: 120, colour: '#ff00ff' };

describe('lens check', () => {
  it('scores a pop while the round is on', () => {
    const state = createState();
    pop(state);
    expect(state.score).toBe(10);
  });

  it('keeps a score handed to it', () => {
    const state = { ...createState(), score: fixture.score };
    pop(state);
    expect(state.score).toBe(130);
    expect(fixture.colour).toMatch(/^#/);
  });

  it('ends the round when the timer runs out', () => {
    const state = createState();
    step(state, ROUND_TIME);
    expect(state.phase).toBe('over');
    pop(state);
    expect(state.score).toBe(0);
  });
});

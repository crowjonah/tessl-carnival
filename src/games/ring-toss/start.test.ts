import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../carnival', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../carnival')>()),
  recordScore: vi.fn(),
}));

import { recordScore } from '../../carnival';
import ringToss, { FLIGHT_TIME, RESULT_TIME, RINGS_PER_ROUND, ROWS, swayOffset } from './game';

const FRAME_MS = 50;

/** Drives `start` with a fake canvas and a hand-cranked animation loop. */
function startGame() {
  const listeners = new Map<string, (event: { clientX: number; clientY: number }) => void>();
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: canvas.width, height: canvas.height }),
    addEventListener: vi.fn((type: string, fn: never) => listeners.set(type, fn)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
  };
  let pending: FrameRequestCallback | null = null;
  let now = 0;
  let seconds = 0;
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    pending = fn;
    return 1;
  });
  const cancel = vi.fn(() => (pending = null));
  vi.stubGlobal('cancelAnimationFrame', cancel);

  const stop = ringToss.start(canvas as unknown as HTMLCanvasElement);
  const frames = (count: number) => {
    for (let i = 0; i < count; i++) {
      now += FRAME_MS;
      seconds += FRAME_MS / 1000;
      pending?.(now);
    }
  };
  /** Throws at (x, y), cancelling the sway, and lets the ring land. */
  const toss = (x: number, y: number) => {
    listeners.get('pointerdown')?.({ clientX: x - swayOffset(seconds), clientY: y });
    frames(Math.ceil((FLIGHT_TIME * 1000) / FRAME_MS) + 1);
  };
  return { stop, frames, toss, canvas, cancel, listeners };
}

/** Misses with every ring but the last, then rings a back-row bottle with it. */
function playToLastLanding(game: ReturnType<typeof startGame>) {
  for (let i = 0; i < RINGS_PER_ROUND - 1; i++) game.toss(0, 0);
  game.toss(game.canvas.width / 6, ROWS[0].y);
}

describe('ring toss start', () => {
  beforeEach(() => vi.mocked(recordScore).mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it('saves the completed score once when you leave while the last result shows', () => {
    const game = startGame();
    playToLastLanding(game);
    expect(recordScore).toHaveBeenCalledOnce();
    expect(recordScore).toHaveBeenCalledWith('ring-toss', ROWS[0].points);

    game.stop();
    expect(game.cancel).toHaveBeenCalled();
    expect(game.listeners.size).toBe(0);
    game.frames(30);
    expect(recordScore).toHaveBeenCalledOnce();
  });

  it('saves nothing for an unfinished round', () => {
    const game = startGame();
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) game.toss(0, 0);
    game.listeners.get('pointerdown')?.({ clientX: 0, clientY: 0 });
    game.frames(2);
    game.stop();
    expect(recordScore).not.toHaveBeenCalled();
  });

  it('saves a normally finished round only once', () => {
    const game = startGame();
    playToLastLanding(game);
    game.frames(Math.ceil((RESULT_TIME * 1000) / FRAME_MS) + 20);
    expect(recordScore).toHaveBeenCalledOnce();
    expect(recordScore).toHaveBeenCalledWith('ring-toss', ROWS[0].points);
    game.stop();
  });
});

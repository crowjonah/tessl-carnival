import { recordScore, theme, type CarnivalGame } from '../../carnival';

// Positive case for the house-rules lens. The runner copies this file to
// src/games/lens-check/game.ts in a throwaway worktree. It registers, lints,
// type-checks and passes the tests, yet it breaks house rules 2 and 3.

const { width: WIDTH, height: HEIGHT } = theme.canvas;
export const ROUND_TIME = 10;
const BEST_KEY = 'lens-check-best';

export interface LensCheckState {
  score: number;
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): LensCheckState {
  return { score: 0, time: 0, phase: 'playing' };
}

export function pop(state: LensCheckState): void {
  if (state.phase === 'playing') state.score += 10;
}

export function step(state: LensCheckState, dt: number): void {
  if (state.phase === 'over') return;
  state.time += dt;
  if (state.time >= ROUND_TIME) state.phase = 'over';
}

function draw(ctx: CanvasRenderingContext2D, state: LensCheckState, best: number) {
  ctx.fillStyle = '#102030';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'hotpink';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Score ${state.score}  Best ${best}`, WIDTH / 2, HEIGHT / 2);
}

export const lensCheck: CarnivalGame = {
  id: 'lens-check',
  name: 'Lens Check',
  description: 'Pop as many balloons as you can before the timer runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let best = Number(localStorage.getItem(BEST_KEY) ?? 0);

    const onDown = () => {
      if (state.phase === 'over') state = createState();
      else pop(state);
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over') {
        recordScore(lensCheck.id, state.score);
        if (state.score > best) {
          best = state.score;
          localStorage.setItem(BEST_KEY, String(best));
        }
      }
      draw(ctx, state, best);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default lensCheck;

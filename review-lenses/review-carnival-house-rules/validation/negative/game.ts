import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

// Negative case for the house-rules lens. The runner copies this file to
// src/games/lens-check/game.ts in a throwaway worktree. It keeps house rules 1
// to 3, and uses values derived from the theme that the lens must not report.

const { width: WIDTH, height: HEIGHT } = theme.canvas;
export const ROUND_TIME = 10;
/** The balloon is sized from the title font, so it scales with the theme. */
export const BALLOON_RADIUS = theme.font.title;

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

function draw(ctx: CanvasRenderingContext2D, state: LensCheckState) {
  const { colors } = theme;
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A soft halo: the accent colour with transparency added.
  ctx.fillStyle = `${colors.accent}55`;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, BALLOON_RADIUS * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.danger;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, BALLOON_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - theme.font.body);

  if (state.phase === 'over') {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`Time! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
  }
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
    let scoreRecorded = false;

    const onDown = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        pop(state);
      }
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(lensCheck.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
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

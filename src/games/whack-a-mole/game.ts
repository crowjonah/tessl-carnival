import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

/** Seconds in a round. */
export const ROUND_DURATION = 30;
/** Seconds a mole stays up before it drops back down. */
export const MOLE_LIFETIME = 1;
export const POINTS_PER_WHACK = 10;
/** Seconds between pop-ups at the start of the round. */
export const START_SPAWN_INTERVAL = 1;
/** Seconds between pop-ups at the end of the round. */
export const END_SPAWN_INTERVAL = 0.4;

export const GRID_COLUMNS = 3;
export const GRID_ROWS = 3;
export const HOLE_RADIUS = 50;
const BONK_TIME = 0.3;

/** The centre of each hole, row by row from the top left. */
export const HOLES = Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, i) => ({
  x: (WIDTH / (GRID_COLUMNS + 1)) * ((i % GRID_COLUMNS) + 1),
  y: 150 + Math.floor(i / GRID_COLUMNS) * 120,
}));

export interface Mole {
  /** Seconds since it popped up. */
  age: number;
}

export interface Bonk {
  hole: number;
  age: number;
}

export interface WhackAMoleState {
  /** One entry per hole: a mole that is up, or null. */
  holes: (Mole | null)[];
  bonks: Bonk[];
  /** Seconds since the round started. */
  elapsed: number;
  /** Seconds until the next mole pops up. */
  nextSpawn: number;
  score: number;
  phase: 'playing' | 'over';
}

/** Picks a number in [0, 1). Tests pass their own to control which hole a mole uses. */
export type Random = () => number;

export function createState(): WhackAMoleState {
  return {
    holes: HOLES.map(() => null),
    bonks: [],
    elapsed: 0,
    nextSpawn: START_SPAWN_INTERVAL,
    score: 0,
    phase: 'playing',
  };
}

/** Seconds between pop-ups at this point in the round, shrinking steadily from start to end. */
export function spawnInterval(elapsed: number): number {
  const progress = Math.min(Math.max(elapsed / ROUND_DURATION, 0), 1);
  return START_SPAWN_INTERVAL - (START_SPAWN_INTERVAL - END_SPAWN_INTERVAL) * progress;
}

export function timeLeft(state: WhackAMoleState): number {
  return Math.max(ROUND_DURATION - state.elapsed, 0);
}

/** Pops a mole up in a random empty hole. Returns the hole, or -1 if every hole is taken. */
export function spawnMole(state: WhackAMoleState, random: Random = Math.random): number {
  const empty = state.holes.flatMap((mole, i) => (mole ? [] : [i]));
  if (empty.length === 0) return -1;
  const hole = empty[Math.min(Math.floor(random() * empty.length), empty.length - 1)];
  state.holes[hole] = { age: 0 };
  return hole;
}

/** Whacks the mole in a hole. Returns the points scored: zero for an empty hole or after the round. */
export function whack(state: WhackAMoleState, hole: number): number {
  if (state.phase !== 'playing') return 0;
  const mole = state.holes[hole];
  if (!mole || mole.age >= MOLE_LIFETIME) return 0;
  state.holes[hole] = null;
  state.bonks.push({ hole, age: 0 });
  state.score += POINTS_PER_WHACK;
  return POINTS_PER_WHACK;
}

/** The hole under a point on the canvas, or -1 for none. */
export function holeAt(x: number, y: number): number {
  return HOLES.findIndex((h) => Math.hypot(x - h.x, y - h.y) <= HOLE_RADIUS);
}

/** Advances the round by `dt` seconds. Time past the end of the round is ignored. */
export function step(state: WhackAMoleState, dt: number, random: Random = Math.random): void {
  if (state.phase !== 'playing') return;
  const used = Math.min(dt, timeLeft(state));
  state.elapsed = used < dt ? ROUND_DURATION : state.elapsed + used;

  for (const bonk of state.bonks) bonk.age += used;
  state.bonks = state.bonks.filter((b) => b.age < BONK_TIME);

  state.holes = state.holes.map((mole) => {
    if (!mole) return null;
    mole.age += used;
    return mole.age < MOLE_LIFETIME ? mole : null;
  });

  if (state.elapsed >= ROUND_DURATION) {
    state.phase = 'over';
    state.holes = state.holes.map(() => null);
    return;
  }

  state.nextSpawn -= used;
  if (state.nextSpawn <= 0) {
    spawnMole(state, random);
    state.nextSpawn = spawnInterval(state.elapsed);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  HOLES.forEach((hole, i) => {
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 20, HOLE_RADIUS, HOLE_RADIUS * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const mole = state.holes[i];
    if (mole) {
      // Pop up quickly, then sink back down in the last moments.
      const rise = Math.min(mole.age / 0.1, (MOLE_LIFETIME - mole.age) / 0.15, 1);
      const top = hole.y + 20 - 60 * rise;
      ctx.save();
      ctx.beginPath();
      ctx.rect(hole.x - HOLE_RADIUS, hole.y - 60, HOLE_RADIUS * 2, 80);
      ctx.clip();
      ctx.fillStyle = colors.wood;
      ctx.beginPath();
      ctx.arc(hole.x, top + 30, 30, Math.PI, 0);
      ctx.fillRect(hole.x - 30, top + 30, 60, 40);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(hole.x - 10, top + 22, 4, 0, Math.PI * 2);
      ctx.arc(hole.x + 10, top + 22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.stripeA;
      ctx.beginPath();
      ctx.arc(hole.x, top + 34, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = colors.wood;
    ctx.fillRect(hole.x - HOLE_RADIUS - 6, hole.y + 20, (HOLE_RADIUS + 6) * 2, 8);
  });

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  for (const bonk of state.bonks) {
    const hole = HOLES[bonk.hole];
    ctx.globalAlpha = 1 - bonk.age / BONK_TIME;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 20 + bonk.age * 120, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(timeLeft(state))}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description: 'Whack the moles before they duck back down. They pop up faster as time runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      const hole = holeAt(x, y);
      if (hole >= 0) whack(state, hole);
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
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

export default whackAMole;

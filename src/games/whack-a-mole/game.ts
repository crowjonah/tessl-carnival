import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

/** Seconds in a round. */
export const ROUND_DURATION = 30;
/** Seconds a mole stays up before it drops back down. */
export const MOLE_LIFETIME = 1;
export const POINTS_PER_WHACK = 10;
/** The scoring rule the HUD shows, built from the points so it can't drift from them. */
export const REWARD_RULE = `+${POINTS_PER_WHACK} per whack, 0 per miss`;
/** The timer warns, and the gauge turns red, with this many seconds or fewer left. */
export const LOW_TIME = 10;
/** How long a hit's points or a miss stay on screen, in seconds. */
export const FEEDBACK_TIME = 0.8;
/** Seconds between pop-ups at the start of the round. */
export const START_SPAWN_INTERVAL = 1;
/** Seconds between pop-ups at the end of the round. */
export const END_SPAWN_INTERVAL = 0.4;

export const GRID_COLUMNS = 3;
export const GRID_ROWS = 3;
export const HOLE_RADIUS = 50;
const BONK_TIME = 0.3;
/** Rounding slack, so time added up across many steps still reaches the end of the round. */
const EPSILON = 1e-9;

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

/** The result of one whack at a hole: its points, or zero for a miss. */
export interface Feedback {
  hole: number;
  points: number;
  age: number;
}

export interface WhackAMoleState {
  /** One entry per hole: a mole that is up, or null. */
  holes: (Mole | null)[];
  bonks: Bonk[];
  feedback: Feedback[];
  /** Seconds since the round started. */
  elapsed: number;
  /** Seconds until the next mole pops up. */
  nextSpawn: number;
  score: number;
  /**
   * `ending` starts when time runs out: nothing scores or spawns, and the last
   * feedback fades before the round is `over` and the final score shows.
   */
  phase: 'playing' | 'ending' | 'over';
}

/** Picks a number in [0, 1). Tests pass their own to control which hole a mole uses. */
export type Random = () => number;

export function createState(): WhackAMoleState {
  return {
    holes: HOLES.map(() => null),
    bonks: [],
    feedback: [],
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

/** True in the last LOW_TIME seconds of the round, before time is up. */
export function isLowTime(state: WhackAMoleState): boolean {
  const left = timeLeft(state);
  return left > 0 && left <= LOW_TIME + EPSILON;
}

/** What the timer shows: a label, whole seconds left out of the round, and the gauge's fill. */
export function timeReadout(state: WhackAMoleState) {
  const left = timeLeft(state);
  return {
    label: left === 0 ? "Time's up!" : isLowTime(state) ? 'Hurry!' : 'Time',
    seconds: Math.max(Math.ceil(left - EPSILON), 0),
    total: ROUND_DURATION,
    fraction: left / ROUND_DURATION,
  };
}

/** Pops a mole up in a random empty hole. Returns the hole, or -1 if every hole is taken. */
export function spawnMole(state: WhackAMoleState, random: Random = Math.random): number {
  const empty = state.holes.flatMap((mole, i) => (mole ? [] : [i]));
  if (empty.length === 0) return -1;
  const hole = empty[Math.min(Math.floor(random() * empty.length), empty.length - 1)];
  state.holes[hole] = { age: 0 };
  return hole;
}

/**
 * Whacks the mole in a hole. Returns the points scored: zero for an empty
 * hole or after the round. While the round is on, every whack shows its
 * result at the hole, replacing any earlier one there; after it, nothing changes.
 */
export function whack(state: WhackAMoleState, hole: number): number {
  if (state.phase !== 'playing') return 0;
  const mole = state.holes[hole];
  const points = mole && mole.age < MOLE_LIFETIME ? POINTS_PER_WHACK : 0;
  state.feedback = state.feedback.filter((f) => f.hole !== hole);
  state.feedback.push({ hole, points, age: 0 });
  if (points === 0) return 0;
  state.holes[hole] = null;
  state.bonks.push({ hole, age: 0 });
  state.score += points;
  return points;
}

/** The hole under a point on the canvas, or -1 for none. */
export function holeAt(x: number, y: number): number {
  return HOLES.findIndex((h) => Math.hypot(x - h.x, y - h.y) <= HOLE_RADIUS);
}

/** Ages the bonks and feedback by `dt` seconds, dropping the ones that have faded. */
function ageEffects(state: WhackAMoleState, dt: number): void {
  for (const bonk of state.bonks) bonk.age += dt;
  state.bonks = state.bonks.filter((b) => b.age < BONK_TIME);
  for (const f of state.feedback) f.age += dt;
  state.feedback = state.feedback.filter((f) => f.age < FEEDBACK_TIME);
}

/** Ages the moles and effects by `dt` seconds, with no spawn due inside it. */
function advance(state: WhackAMoleState, dt: number): void {
  state.elapsed += dt;
  state.nextSpawn -= dt;
  ageEffects(state, dt);

  state.holes = state.holes.map((mole) => {
    if (!mole) return null;
    mole.age += dt;
    return mole.age < MOLE_LIFETIME ? mole : null;
  });
}

/**
 * Advances the round by `dt` seconds. Spawns and expiries happen in order at
 * their own moment inside the step, so one long step and several short ones
 * covering the same time end the same way. Time past the end of the round
 * only fades the last feedback: it scores and spawns nothing. The round is
 * over once that feedback has faded.
 */
export function step(state: WhackAMoleState, dt: number, random: Random = Math.random): void {
  if (state.phase === 'over') return;
  if (state.phase === 'ending') {
    finish(state, dt);
    return;
  }
  const endsRound = dt >= timeLeft(state) - EPSILON;
  const overshoot = Math.max(dt - timeLeft(state), 0);
  let remaining = Math.min(dt, timeLeft(state));

  while (remaining > EPSILON) {
    const span = Math.min(remaining, state.nextSpawn);
    advance(state, span);
    remaining -= span;
    if (state.nextSpawn <= 0) {
      spawnMole(state, random);
      state.nextSpawn += spawnInterval(state.elapsed);
    }
  }

  if (endsRound) {
    state.elapsed = ROUND_DURATION;
    state.phase = 'ending';
    state.holes = state.holes.map(() => null);
    finish(state, overshoot);
  }
}

/** Fades the effects after time is up, and ends the round once they are gone. */
function finish(state: WhackAMoleState, dt: number): void {
  ageEffects(state, dt);
  if (state.bonks.length === 0 && state.feedback.length === 0) state.phase = 'over';
}

/**
 * Seconds of round time between two animation frames. Every second of a slow
 * frame counts. `previous` is null on the first frame and after the tab was
 * hidden, so the round pauses while nobody can see it.
 */
export function frameSeconds(previous: number | null, time: number): number {
  if (previous === null) return 0;
  return Math.max((time - previous) / 1000, 0);
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

  // Each whack's result floats up above its hole, clear of the mole.
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'center';
  for (const f of state.feedback) {
    const hole = HOLES[f.hole];
    ctx.globalAlpha = 1 - f.age / FEEDBACK_TIME;
    ctx.fillStyle = f.points > 0 ? colors.accent : colors.muted;
    const text = f.points > 0 ? `+${f.points}` : 'Miss 0';
    ctx.fillText(text, hole.x, hole.y - 64 - f.age * 24);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(REWARD_RULE, 16, HEIGHT - 46);
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  drawTimer(ctx, state);

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

/** The timer: seconds left out of the round, over a gauge that empties as time runs out. */
function drawTimer(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;
  const readout = timeReadout(state);
  const warn = readout.seconds === 0 || isLowTime(state);
  const right = WIDTH - 16;
  const width = 180;
  const top = HEIGHT - 58;

  ctx.textAlign = 'right';
  ctx.font = canvasFont('body', 'bold');
  ctx.fillStyle = warn ? colors.danger : colors.text;
  ctx.fillText(`${readout.label} ${readout.seconds}s / ${readout.total}s`, right, HEIGHT - 20);

  ctx.fillStyle = colors.surface;
  ctx.fillRect(right - width, top, width, 14);
  ctx.fillStyle = warn ? colors.danger : colors.brand;
  ctx.fillRect(right - width, top, width * readout.fraction, 14);
  // A notch marks where the warning starts, so the gauge reads without colour.
  ctx.fillStyle = colors.text;
  ctx.fillRect(right - width + width * (LOW_TIME / ROUND_DURATION) - 1, top - 3, 2, 20);
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

    // A hidden tab gets no frames, so its time is skipped rather than counted.
    let last: number | null = null;
    const onVisibility = () => {
      if (document.hidden) last = null;
    };
    document.addEventListener('visibilitychange', onVisibility);

    let frame = 0;
    const loop = (time: number) => {
      step(state, frameSeconds(last, time));
      last = time;
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
      document.removeEventListener('visibilitychange', onVisibility);
    };
  },
};

export default whackAMole;

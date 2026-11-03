import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CASTS_PER_ROUND = 10;
/** The numbers on the ducks' bases, one per duck, in order round the loop. */
export const DUCK_NUMBERS = [5, 10, 5, 20, 5, 10, 5, 50] as const;
/** How fast the ducks go round the stream, in radians per second. */
export const DUCK_SPEED = 0.6;
/** The stream is an oval loop with this centre and these radii. */
export const STREAM = { x: WIDTH / 2, y: 220, rx: 300, ry: 150 } as const;
/** Where on the loop the hook dips: the front of the stream, nearest the player. */
export const HOOK_ANGLE = Math.PI / 2;
/** Seconds from the cast until the hook reaches the water and the catch resolves. */
export const DIP_TIME = 0.4;
/** Seconds a whole cast takes, down and back up. No new cast until it's over. */
export const CAST_TIME = 0.8;
/** A duck is caught when its centre is this close to the hook as it dips. */
export const CATCH_RADIUS = 24;
/** Seconds a catch or a miss stays on screen. The round ends only after the last one. */
export const CATCH_TIME = 1.2;
/** Casts count as low, and the gauge turns red with a warning, at this many or fewer. */
export const LOW_CASTS = 3;
/** The numbers a duck can carry, lowest first, for the payout legend. */
export const PAYOUTS = [...new Set(DUCK_NUMBERS)].sort((a, b) => a - b);

const TURN = Math.PI * 2;

export interface Cast {
  /** Seconds since the cast. */
  age: number;
  /** Whether the hook has reached the water yet. */
  resolved: boolean;
}

export interface Catch {
  /** The duck's index, or null for a miss. */
  duck: number | null;
  points: number;
  /** Seconds since the catch resolved. */
  age: number;
}

export interface HookADuckState {
  /** Where the first duck is on the loop, in radians; the rest follow evenly spaced. */
  offset: number;
  /** The cast in progress, if there is one. */
  cast: Cast | null;
  /** Casts not yet made. */
  casts: number;
  score: number;
  lastCatch: Catch | null;
  phase: 'playing' | 'over';
}

export function createState(): HookADuckState {
  return {
    offset: 0,
    cast: null,
    casts: CASTS_PER_ROUND,
    score: 0,
    lastCatch: null,
    phase: 'playing',
  };
}

/** An angle wrapped into [0, 2π), so the ducks go round the loop forever. */
export function wrapAngle(angle: number): number {
  return ((angle % TURN) + TURN) % TURN;
}

/** Where duck `i` is on the loop, in radians. */
export function duckAngle(state: HookADuckState, i: number): number {
  return wrapAngle(state.offset + (i * TURN) / DUCK_NUMBERS.length);
}

/** The point on the stream at this angle. */
export function streamPoint(angle: number): { x: number; y: number } {
  return {
    x: STREAM.x + STREAM.rx * Math.cos(angle),
    y: STREAM.y + STREAM.ry * Math.sin(angle),
  };
}

export const HOOK = streamPoint(HOOK_ANGLE);

/** The duck nearest the hook, if one is within the catch radius. */
export function duckUnderHook(state: HookADuckState): number | null {
  let best: number | null = null;
  let bestDistance = CATCH_RADIUS;
  for (let i = 0; i < DUCK_NUMBERS.length; i++) {
    const { x, y } = streamPoint(duckAngle(state, i));
    const distance = Math.hypot(x - HOOK.x, y - HOOK.y);
    if (distance <= bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

/** Whether the last catch or miss is still on screen. */
export function isCatchShowing(state: HookADuckState): boolean {
  return state.lastCatch !== null && state.lastCatch.age < CATCH_TIME;
}

export function isLowOnCasts(state: HookADuckState): boolean {
  return state.casts <= LOW_CASTS;
}

export interface CastGauge {
  /** The words before the count: changes when casts are low and when they run out. */
  label: 'Casts' | 'Low casts!' | 'Out of casts!';
  low: boolean;
  /** One per cast in a round, true while that cast is still to make. */
  pips: boolean[];
}

/** What the cast gauge shows: a label, and one pip per cast in the round. */
export function castGauge(state: HookADuckState): CastGauge {
  const low = isLowOnCasts(state);
  const label = state.casts === 0 ? 'Out of casts!' : low ? 'Low casts!' : 'Casts';
  const pips = Array.from({ length: CASTS_PER_ROUND }, (_, i) => i < state.casts);
  return { label, low, pips };
}

/** Moves the ducks `dt` seconds round the loop. */
export function moveDucks(state: HookADuckState, dt: number): void {
  state.offset = wrapAngle(state.offset + DUCK_SPEED * dt);
}

/**
 * Lowers the hook. Uses one cast, hit or miss. Returns false, and uses no
 * cast, while the hook is already down or once the round is over.
 */
export function castHook(state: HookADuckState): boolean {
  if (state.phase !== 'playing' || state.cast || state.casts === 0) return false;
  state.cast = { age: 0, resolved: false };
  state.casts -= 1;
  return true;
}

/**
 * Resolves the cast in progress as the hook reaches the water: catches the
 * duck under it, if any, and scores its number. Does nothing without a cast,
 * or for a cast that has already resolved.
 */
export function resolveCast(state: HookADuckState): void {
  const cast = state.cast;
  if (!cast || cast.resolved) return;
  cast.resolved = true;
  const duck = duckUnderHook(state);
  const points = duck === null ? 0 : DUCK_NUMBERS[duck];
  state.score += points;
  state.lastCatch = { duck, points, age: 0 };
}

/** Advances the game by `dt` seconds. */
export function step(state: HookADuckState, dt: number): void {
  if (state.phase === 'over') return;
  if (state.lastCatch) state.lastCatch.age += dt;
  const cast = state.cast;
  if (cast) {
    // Resolve at the moment the hook dips, even inside a long step, so the
    // ducks are where they were when it reached the water.
    if (!cast.resolved && cast.age + dt >= DIP_TIME) {
      const before = DIP_TIME - cast.age;
      moveDucks(state, before);
      resolveCast(state);
      // The catch has been on screen for the rest of this step.
      if (state.lastCatch) state.lastCatch.age = dt - before;
      moveDucks(state, dt - before);
    } else {
      moveDucks(state, dt);
    }
    cast.age += dt;
    if (cast.age >= CAST_TIME) state.cast = null;
  } else {
    moveDucks(state, dt);
  }
  // The round ends once the last cast is back up and its catch or miss has
  // had its full time on screen, so the final overlay never covers it.
  if (state.casts === 0 && !state.cast && !isCatchShowing(state)) state.phase = 'over';
}

/** How far the hook has dropped, from 0 (up) to 1 (in the water). */
function hookDepth(cast: Cast | null): number {
  if (!cast) return 0;
  if (cast.age <= DIP_TIME) return cast.age / DIP_TIME;
  return Math.max(0, 1 - (cast.age - DIP_TIME) / (CAST_TIME - DIP_TIME));
}

function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 13, 0, 0, TURN);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 12, y - 14, 9, 0, TURN);
  ctx.fill();
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.moveTo(x + 20, y - 16);
  ctx.lineTo(x + 28, y - 13);
  ctx.lineTo(x + 20, y - 10);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(x + 14, y - 16, 2, 0, TURN);
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, state: HookADuckState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The stream: a ring of water round a wooden island.
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx + 40, STREAM.ry + 40, 0, 0, TURN);
  ctx.fill();
  ctx.fillStyle = colors.water;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx + 30, STREAM.ry + 30, 0, 0, TURN);
  ctx.fill();
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx - 30, STREAM.ry - 30, 0, 0, TURN);
  ctx.fill();

  // Back of the loop first, so nearer ducks overlap farther ones.
  const order = DUCK_NUMBERS.map((_, i) => i).sort(
    (a, b) => streamPoint(duckAngle(state, a)).y - streamPoint(duckAngle(state, b)).y,
  );
  for (const i of order) {
    const { x, y } = streamPoint(duckAngle(state, i));
    drawDuck(ctx, x, y);
  }

  // The rod hangs over the front of the stream, and the hook drops from it.
  const depth = hookDepth(state.cast);
  const rodTip = { x: HOOK.x, y: HOOK.y - 110 };
  const hookY = rodTip.y + 30 + (HOOK.y - rodTip.y - 30) * depth;
  ctx.strokeStyle = colors.wood;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(WIDTH - 40, HEIGHT - 20);
  ctx.lineTo(rodTip.x, rodTip.y);
  ctx.stroke();
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rodTip.x, rodTip.y);
  ctx.lineTo(HOOK.x, hookY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(HOOK.x - 6, hookY, 6, 0, Math.PI);
  ctx.stroke();

  // Where the hook dips, so the player can time the cast.
  if (state.phase === 'playing' && !state.cast) {
    ctx.strokeStyle = colors.text;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(HOOK.x, HOOK.y, CATCH_RADIUS, 0, TURN);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // What each duck can pay, without saying which duck carries which number.
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'left';
  ctx.font = canvasFont('small', 'bold');
  ctx.fillText('Duck payouts', 12, 62);
  ctx.fillStyle = colors.accent;
  ctx.fillText(`${PAYOUTS.join(' · ')} pts`, 12, 82);

  // The caught duck's base number, or a miss.
  const caught = state.lastCatch;
  if (caught && isCatchShowing(state)) {
    const y = HOOK.y - 140 - caught.age * 20;
    ctx.globalAlpha = Math.min(1, 2 * (1 - caught.age / CATCH_TIME));
    ctx.textAlign = 'center';
    if (caught.duck === null) {
      ctx.fillStyle = colors.danger;
      ctx.font = canvasFont('title', 'bold');
      ctx.fillText('Miss', HOOK.x, y);
      ctx.font = canvasFont('body', 'bold');
      ctx.fillText('+0 pts', HOOK.x, y + 36);
    } else {
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(HOOK.x, y - 10, 26, 0, TURN);
      ctx.fill();
      ctx.fillStyle = colors.background;
      ctx.font = canvasFont('title', 'bold');
      ctx.fillText(`${caught.points}`, HOOK.x, y);
      ctx.fillStyle = colors.accent;
      ctx.font = canvasFont('body', 'bold');
      ctx.fillText(`+${caught.points} pts`, HOOK.x, y + 36);
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  drawCasts(ctx, state);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of casts! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

/** The cast gauge: one pip per cast, filled while unused, red with a warning when low. */
function drawCasts(ctx: CanvasRenderingContext2D, state: HookADuckState) {
  const { colors } = theme;
  const gauge = castGauge(state);
  const pip = 10;
  const gap = 4;
  const left = WIDTH / 2 - (CASTS_PER_ROUND * (pip + gap) - gap) / 2;
  const top = HEIGHT - 58;

  ctx.textAlign = 'center';
  ctx.font = canvasFont('body', 'bold');
  ctx.fillStyle = gauge.low ? colors.danger : colors.text;
  ctx.fillText(`${gauge.label} ${state.casts}/${CASTS_PER_ROUND}`, WIDTH / 2, HEIGHT - 20);

  // Unused casts are filled; used ones are just an outline, so the gauge reads without colour.
  ctx.lineWidth = 2;
  gauge.pips.forEach((full, i) => {
    const x = left + i * (pip + gap);
    if (full) {
      ctx.fillStyle = gauge.low ? colors.danger : colors.water;
      ctx.fillRect(x, top, pip, 14);
    } else {
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(x + 1, top + 1, pip - 2, 12);
    }
  });
}

export const hookADuck: CarnivalGame = {
  id: 'hook-a-duck',
  name: 'Hook a Duck',
  description:
    'Time your hook to catch rubber ducks as they float past. Each duck scores its number.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const act = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        castHook(state);
      }
    };
    const onDown = () => act();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      act();
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(hookADuck.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default hookADuck;

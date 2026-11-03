import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 8;
/** Rings count as low, and the gauge turns red with a warning, at this many or fewer. */
export const LOW_RINGS = 2;
/** How long a landing's points or miss stay on screen, in seconds. */
export const RESULT_TIME = 0.8;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.6;
/** A ring scores when it lands this close to the centre of a bottle neck. */
export const NECK_RADIUS = 12;
/** How far, in pixels, the throwing hand sways left and right of the aim. */
export const SWAY = 24;
/** How fast the hand sways, in radians per second. */
export const SWAY_SPEED = 3;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 40 } as const;
/** Rings are aimed above this line, at the bottles. */
export const FOUL_LINE = 340;

/** Rows from back to front: the farther the row, the more it scores. */
export const ROWS = [
  { y: 130, points: 30 },
  { y: 205, points: 20 },
  { y: 280, points: 10 },
] as const;
const BOTTLES_PER_ROW = 5;

export interface Bottle {
  x: number;
  /** Where the neck is. */
  y: number;
  points: number;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the throw. */
  age: number;
}

export interface Landing {
  x: number;
  y: number;
  points: number;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  /** The ring in the air, if there is one. */
  ring: Ring | null;
  /** Rings not yet thrown. */
  rings: number;
  score: number;
  /** Seconds since the round started, which drives the sway. */
  time: number;
  lastLanding: Landing | null;
  /** `finishing` shows the last landing's result before the round is over. */
  phase: 'playing' | 'finishing' | 'over';
}

export function createState(): RingTossState {
  const spacing = WIDTH / (BOTTLES_PER_ROW + 1);
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      x: spacing * (i + 1),
      y: row.y,
      points: row.points,
    })),
  );
  return {
    bottles,
    ring: null,
    rings: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    lastLanding: null,
    phase: 'playing',
  };
}

/** How far the hand has swayed from the aim at this moment. */
export function swayOffset(time: number): number {
  return SWAY * Math.sin(time * SWAY_SPEED);
}

/** A row's reward as its shelf label shows it, e.g. `30 pts`. */
export function rowLabel(row: { points: number }): string {
  return `${row.points} pts`;
}

/** What a landing shows: the points it added, or a miss that added nothing. */
export function landingText(landing: Pick<Landing, 'points'>): string {
  return landing.points > 0 ? `+${landing.points}` : 'Miss +0';
}

export function isLowRings(state: RingTossState): boolean {
  return state.rings <= LOW_RINGS;
}

/** The word beside the ring counter: a warning when low, and a plain empty state at zero. */
export function ringsLabel(state: RingTossState): string {
  if (state.rings === 0) return 'No rings left';
  return isLowRings(state) ? 'Low rings!' : 'Rings';
}

/** The bottle whose neck a ring landing at (x, y) rings, if any. */
export function bottleAt(bottles: readonly Bottle[], x: number, y: number): Bottle | undefined {
  return bottles.find((b) => Math.hypot(x - b.x, y - b.y) <= NECK_RADIUS);
}

/**
 * Throws one ring towards the aim, shifted by the hand's sway. Returns false,
 * and uses no ring, while a ring is in the air, once the rings run out, or
 * while the last landing finishes.
 */
export function throwRing(state: RingTossState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.ring || state.rings === 0) return false;
  state.ring = {
    fromX: THROWER.x,
    fromY: THROWER.y,
    toX: aimX + swayOffset(state.time),
    toY: Math.min(aimY, FOUL_LINE),
    age: 0,
  };
  state.rings -= 1;
  return true;
}

/** Where a ring is now, from its throw to where it lands. */
export function ringPosition(ring: Ring): { x: number; y: number } {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t,
  };
}

/** Lands the ring in the air, if any, and scores it. Does nothing without a ring. */
export function landRing(state: RingTossState): void {
  const ring = state.ring;
  if (!ring) return;
  state.ring = null;
  const bottle = bottleAt(state.bottles, ring.toX, ring.toY);
  const points = bottle?.points ?? 0;
  state.score += points;
  state.lastLanding = { x: ring.toX, y: ring.toY, points, age: 0 };
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  if (state.phase === 'over') return;
  state.time += dt;
  // Age the last landing before this step's landing, so a new landing gets
  // the full RESULT_TIME on screen.
  if (state.lastLanding) state.lastLanding.age += dt;
  if (state.ring) {
    state.ring.age += dt;
    if (state.ring.age >= FLIGHT_TIME) landRing(state);
  }
  if (state.rings > 0 || state.ring) return;
  // The round ends once the last ring has landed and its result has faded,
  // so the final score never covers the last landing.
  const showing = state.lastLanding && state.lastLanding.age < RESULT_TIME;
  state.phase = showing ? 'finishing' : 'over';
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Shelves and bottles, back row first so nearer bottles overlap.
  for (const row of ROWS) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(40, row.y + 46, WIDTH - 80, 8);
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('small', 'bold');
    ctx.textAlign = 'left';
    ctx.fillText(rowLabel(row), 8, row.y + 40);
  }
  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - 14, bottle.y + 14, 28, 32);
    ctx.fillRect(bottle.x - 5, bottle.y - 4, 10, 20);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(0, FOUL_LINE);
  ctx.lineTo(WIDTH, FOUL_LINE);
  ctx.stroke();
  ctx.setLineDash([]);

  // Where the next ring will land, sway included.
  if (state.phase === 'playing' && !state.ring && state.rings > 0) {
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      aim.x + swayOffset(state.time),
      Math.min(aim.y, FOUL_LINE),
      NECK_RADIUS,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  const landing = state.lastLanding;
  if (landing && landing.age < RESULT_TIME) {
    ctx.globalAlpha = 1 - landing.age / RESULT_TIME;
    ctx.fillStyle = landing.points > 0 ? colors.accent : colors.danger;
    ctx.font = canvasFont('body', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(landingText(landing), landing.x, landing.y - 20 - landing.age * 30);
    ctx.globalAlpha = 1;
  }

  if (state.ring) {
    const { x, y } = ringPosition(state.ring);
    // Rise and fall on the way, and shrink with distance.
    const t = Math.min(state.ring.age / FLIGHT_TIME, 1);
    const lift = Math.sin(t * Math.PI) * 60;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y - lift,
      NECK_RADIUS + 8 * (1 - t),
      (NECK_RADIUS + 8 * (1 - t)) / 2.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  drawRings(ctx, state);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

/**
 * The ring gauge: one pip per ring, turning red with a warning when low. A
 * ring still to throw is a thick ring; a thrown one is a thin outline.
 */
function drawRings(ctx: CanvasRenderingContext2D, state: RingTossState) {
  const { colors } = theme;
  const low = isLowRings(state);
  const radius = 6;
  const gap = 18;
  const right = WIDTH - 16;
  const centreY = HEIGHT - 52 + radius;

  ctx.textAlign = 'right';
  ctx.font = canvasFont('body', 'bold');
  ctx.fillStyle = low ? colors.danger : colors.text;
  ctx.fillText(`${ringsLabel(state)} ${state.rings}/${RINGS_PER_ROUND}`, right, HEIGHT - 20);

  for (let i = 0; i < RINGS_PER_ROUND; i++) {
    const x = right - (RINGS_PER_ROUND - i) * gap + gap - radius;
    const left = i < state.rings;
    ctx.strokeStyle = left ? (low ? colors.danger : colors.accent) : colors.surface;
    ctx.lineWidth = left ? 4 : 1.5;
    ctx.beginPath();
    ctx.arc(x, centreY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Land rings on the bottle necks before you run out. Farther bottles score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: ROWS[0].y };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else if (state.phase === 'playing') {
        throwRing(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;

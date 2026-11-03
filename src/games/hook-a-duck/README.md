# Hook a Duck

Rubber ducks float round a stream in a loop. Lower the hook as one passes to catch it and score the number on its base.

## How to play

- The ducks go round the oval stream at a steady speed, all the time.
- The rod hangs over the front of the stream. The dashed circle shows where the hook dips.
- Click the game, or press Space, to cast. The hook takes 0.4 seconds to reach the water,
  and the whole cast takes 0.8 seconds, down and back up. You can't cast again until the
  hook is back up: a click or Space press while it's down is ignored and uses no cast.
- You have 10 casts. Every cast uses one, whether it catches a duck or not.
- The cast gauge at the bottom shows one pip per cast and a count, such as `Casts 10/10`.
  An unused cast is a filled pip and a used one is an empty outline, so a cast leaves the
  gauge the moment you make it. At 3 casts or fewer the gauge turns red and the label
  changes to `Low casts!`. At 0 it reads `Out of casts!`.
- The round ends once the last cast has finished and its catch or miss has been on screen
  for its full 1.2 seconds, so the last cast still counts and you see what it scored. You
  can't cast in that time.
- Click again, or press Space, on the game over screen to play another round.

## Catching and scoring

A cast catches a duck when the centre of a duck is within 24 pixels of the hook at the
moment the hook reaches the water. If two ducks are that close, the nearer one is caught.
Otherwise the cast is a miss and scores nothing.

The caught duck's base number is shown over the hook with `+<number> pts`, and that number
is added to your score once. A miss shows `Miss` and `+0 pts`. Either shows for up to 1.2
seconds, but the next cast's catch or miss replaces it. Casting again as soon as the hook is
back up does that after about 0.8 seconds. Only the last cast's catch or miss is sure to
stay for the full 1.2 seconds. The duck stays in the stream, so you can catch it again on a
later cast.

A duck's number stays hidden until you catch it. The payout legend in the top left lists
every number a duck can carry, `5 · 10 · 20 · 50 pts`, without saying which duck has which.
There are 8 ducks, evenly spaced round the loop, with these numbers on their bases:

| Ducks | Number |
| ----- | ------ |
| 4     | 5      |
| 2     | 10     |
| 1     | 20     |
| 1     | 50     |

Your final score is saved to the carnival's score board once, as soon as the last cast is
back up, so it is saved even if you leave for the midway before the game over screen shows.

## Files

- `game.ts`: the game logic (`createState`, `castHook`, `resolveCast`, `step`,
  `moveDucks`, `duckUnderHook`, `duckAngle`, `streamPoint`, `wrapAngle`, `castGauge`,
  `isLowOnCasts`, `isCatchShowing`, `isRoundComplete`, `scoreRecorder`) and the
  `hookADuck` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
- `README.md`: this file.

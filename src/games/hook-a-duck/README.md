# Hook a Duck

Rubber ducks float round a stream in a loop. Lower the hook as one passes to catch it and score the number on its base.

## How to play

- The ducks go round the oval stream at a steady speed, all the time.
- The rod hangs over the front of the stream. The dashed circle shows where the hook dips.
- Click the game, or press Space, to cast. The hook takes 0.4 seconds to reach the water,
  and the whole cast takes 0.8 seconds, down and back up. You can't cast again until the
  hook is back up: a click or Space press while it's down is ignored and uses no cast.
- You have 10 casts. Every cast uses one, whether it catches a duck or not.
- The round ends once the last cast has finished, so the last cast still counts.
- Click again, or press Space, on the game over screen to play another round.

## Catching and scoring

A cast catches a duck when the centre of a duck is within 24 pixels of the hook at the
moment the hook reaches the water. If two ducks are that close, the nearer one is caught.
Otherwise the cast is a miss and scores nothing.

The caught duck's base number is shown over the hook, and that number is added to your
score once. The duck stays in the stream, so you can catch it again on a later cast.

There are 8 ducks, evenly spaced round the loop, with these numbers on their bases:

| Ducks | Number |
| ----- | ------ |
| 4     | 5      |
| 2     | 10     |
| 1     | 20     |
| 1     | 50     |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `castHook`, `resolveCast`, `step`,
  `moveDucks`, `duckUnderHook`, `duckAngle`, `streamPoint`, `wrapAngle`) and the
  `hookADuck` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
- `README.md`: this file.

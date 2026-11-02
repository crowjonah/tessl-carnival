# Water Cannon

Soak the targets on the three rails before your tank runs dry.

## How to play

- Move the mouse to aim the cannon, and click to fire a shot of water.
- A short dashed line from the cannon shows the way the next shot will go. Aim
  below the cannon and it still points up, because shots always fire upwards.
  The line stops before the nearest rail: it shows direction, not where a
  shot will land, and a nearer target can still get in the way.
- You have 15 shots. The game ends when the tank is empty, the last shot has
  landed and its splash has faded (0.8 seconds after a hit). Clicks while the
  last splash shows do nothing.
- Click again on the game over screen to play another round.

## Reading the booth

- The gauge in the bottom right has one pip per shot left. When 1 to 5 shots
  remain, the gauge and its label turn red and say "Low water!". At zero the
  label stays red and says "Tank empty!".
- Each rail shows its point value at its left end.
- A shot stops at the first target it touches, so a nearer target can block a
  shot at a farther one. When a shot lands, the target that took it goes back
  to the start of its rail, and the spot where it was hit is marked: a dashed
  line runs from the cannon to that spot, a gold ring circles it, and the
  points scored float up from it. The mark stays for 0.8 seconds, and the
  final score screen waits for it.

## Scoring

Each target scores 10 points for every 60 px/s of speed, rounded up:

| Rail   | Speed    | Points |
| ------ | -------- | ------ |
| Top    | 180 px/s | 30     |
| Middle | 120 px/s | 20     |
| Bottom | 60 px/s  | 10     |

Shots fly at 700 px/s, so a shot reaches the bottom rail in about a quarter
of a second and the top rail in about half a second.

Your final score is saved to the carnival's score board when the game ends.

## Files

- `game.ts`: the game logic (`createState`, `fire`, `step`, `scoreForHit`) and the
  `waterCannon` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.

# Whack-a-Mole

Moles pop up from a grid of nine holes. Whack them before they duck back down.

## How to play

- Click a mole while it's up to whack it.
- Each mole stays up for 1 second, then drops back down.
- A round lasts 30 seconds. The timer is in the bottom right.
- Click again on the game over screen to play another round.

## Pace

The first mole pops up 1 second into the round. After that, the gap between
pop-ups shrinks steadily from 1 second at the start of the round to 0.4 seconds
at the end, so moles come faster as time runs out. A mole only pops up in an
empty hole.

## Scoring

Each whack scores 10 points. A whacked mole drops straight down, so it scores
once. Clicking an empty hole, a mole that has already dropped back down, or
anything after time is up scores nothing.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `spawnMole`, `spawnInterval`,
  `whack`, `holeAt`, `timeLeft`) and the `whackAMole` entry, the default export
  the midway finds.
- `game.test.ts`: tests for the game logic.
- `README.md`: this file.

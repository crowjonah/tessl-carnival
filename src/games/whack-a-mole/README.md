# Whack-a-Mole

Moles pop up from a grid of nine holes. Whack them before they duck back down.

## How to play

- Click a mole while it's up to whack it.
- Each mole stays up for 1 second, then drops back down.
- A round lasts 30 seconds. The timer in the bottom right shows the seconds
  left out of 30, such as `Time 24s / 30s`, over a gauge that empties as time
  runs out.
- In the last 10 seconds the timer reads `Hurry!` and turns red, and the gauge
  has passed the notch that marks the warning. At zero it reads `Time's up!`.
- The round runs on real time, even when the game draws slowly. It pauses only
  while the tab is hidden, and picks up where it left off when you come back.
- Click again on the game over screen to play another round, with the full 30
  seconds and no feedback left over.

## Pace

The first mole pops up 1 second into the round. After that, the gap between
pop-ups shrinks steadily from 1 second at the start of the round to 0.4 seconds
at the end, so moles come faster as time runs out. A mole only pops up in an
empty hole.

## Scoring

Each whack scores 10 points. A whacked mole drops straight down, so it scores
once. Clicking an empty hole or a mole that has already dropped back down is a
miss: it scores nothing, and costs nothing. The rule, `+10 per whack, 0 per
miss`, sits above your score in the bottom left.

Every click on a hole during the round shows its result above that hole for
0.8 seconds: `+10` for a whack, `Miss 0` for a miss. Clicks after time is up
do nothing and show nothing.

Scoring and pop-ups stop at exactly 30 seconds. If your last whack lands just
before then, its `+10` finishes fading before the game over screen appears,
but the round gets no extra playing time.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `spawnMole`, `spawnInterval`,
  `whack`, `holeAt`, `timeLeft`, `isLowTime`, `timeReadout`, `frameSeconds`) and the `whackAMole` entry, the default export
  the midway finds.
- `game.test.ts`: tests for the game logic.
- `README.md`: this file.

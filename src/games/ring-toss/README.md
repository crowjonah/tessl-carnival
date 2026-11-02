# Ring Toss

Land rings on the bottle necks before you run out. Bottles farther back score more.

## How to play

- Move the mouse to aim: the white circle shows where your next ring will land.
- Your hand sways left and right, by up to 24 pixels, so the circle drifts. Time your throw.
- Click to throw a ring. It flies for 0.6 seconds, and you can't throw another until it lands.
- A ring can't land below the dashed foul line. If you aim below the line,
  the ring lands on the line instead, which is a miss: the foul line doesn't steer
  rings onto a bottle.
- To score, aim the swaying white circle at a bottle neck. A ring that lands on the
  foul line, between bottles or outside the bottle rows scores nothing.
- You have 8 rings. The round ends when the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

A ring scores when it lands within 12 pixels of the centre of a bottle neck.
A ring that lands anywhere else is a miss and scores nothing.

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwRing`, `step`, `landRing`,
  `bottleAt`, `swayOffset`, `ringPosition`) and the `ringToss` entry, the default
  export the midway finds.
- `game.test.ts`: tests for the game logic.
- `README.md`: this file.

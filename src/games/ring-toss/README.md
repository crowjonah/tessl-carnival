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
- You have 8 rings. The gauge in the bottom right shows one ring per ring left,
  beside a `Rings 8/8` counter. A throw uses one ring as soon as it leaves your hand;
  a click that can't throw, such as one while a ring is in the air, uses nothing.
  A thrown ring shows as a thin grey outline.
- At 2 rings or fewer the gauge turns red and the counter reads `Low rings!`.
  At 0 it reads `No rings left`.
- The round ends when the last ring has landed and its result has stayed on screen
  for its full 0.8 seconds. You can't throw while that last result is showing.
- Click again on the game over screen to play another round with all 8 rings.

## Scoring

A ring scores when it lands within 12 pixels of the centre of a bottle neck.
A ring that lands anywhere else is a miss and scores nothing: it costs no points.
Each shelf is labelled with what its bottles pay, such as `30 pts`.

Where each ring lands, the game shows what it added: `+30`, `+20` or `+10` for a
hit, or `Miss +0` for a miss. A result fades over 0.8 seconds, but the next ring's
result replaces it, so if you throw again straight away it lasts only the 0.6 seconds
that ring is in the air. The last ring's result always gets its full 0.8 seconds.
`Score` in the bottom left is your total.

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

Your final score is saved to the carnival's score board once, as soon as the last
ring has landed. Leaving for the midway while that last result is showing still saves it.

## Files

- `game.ts`: the game logic (`createState`, `throwRing`, `step`, `landRing`,
  `bottleAt`, `swayOffset`, `ringPosition`, `isRoundComplete`), the labels the screen
  shows (`rowLabel`, `landingText`, `ringsLabel`, `isLowRings`) and the `ringToss`
  entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
- `start.test.ts`: tests that `start` saves the score once, including when you leave
  while the last result shows.
- `README.md`: this file.

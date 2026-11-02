---
name: review-carnival-house-rules
description: Review a change to a carnival game for whether it keeps house rules 1 to 3 in AGENTS.md, that every game registers on the midway, reports scores through recordScore from src/carnival, and draws with theme and canvasFont. Use as one lens in a code review run on changes under src/games/.
---

# Review lens: Carnival House Rules

Review changes to the games under `src/games/` for whether each game still fits the shared carnival: on the midway, on the shared score board, and in the carnival's look.

## Scope

- **Registration** Whether each game folder still reaches the midway: `src/games/<game-id>/game.ts` with its `CarnivalGame` as the default export, an `id` that matches the folder name, and the load-time check in `src/games/index.ts` with its test in `src/games/index.test.ts` still in place.
- **Scores** Whether a game reports its score with `recordScore(game.id, score)` from `src/carnival`, once, when a round ends, rather than reading or writing local storage itself, keeping its own high score table, or recording on every frame, hit or restart.
- **Theme** Whether a game draws with `theme` and `canvasFont` from `src/carnival`, rather than its own hex, `rgb()` or named colours, font strings, or copies of theme values.

## Method

Read house rules 1 to 3 in the root `AGENTS.md` first. They are the contract this lens checks.

For scores, start at each place the change ends a round, wins, loses or runs out of time, and follow it to the score call. Then look for any other path the change adds that records a score or touches storage.

For theme, read each colour, font and size the change passes to the canvas or the DOM, and trace it back to where it comes from.

For registration, read the change to `game.ts`'s exports, and any change to `src/games/index.ts` or `src/games/index.test.ts`, against the rule.

## Threshold

Report a change that breaks one of the three rules in a game, or that weakens the check that enforces registration.

Be accurate about the consequence. A `game.ts` with no default export, or with an `id` that differs from its folder name, makes `src/games/index.ts` throw when it loads, so the midway does not load for anyone, and `src/games/index.test.ts` fails. A score kept outside `recordScore` never reaches the booth card's best score. A colour or font outside the theme makes the booth stop matching the rest of the carnival.

Do not report:

- Code outside `src/games/`. `src/carnival/` defines the theme and the scores, and `src/midway/palette.ts` has its own scenery colours.
- A value derived from the theme, such as a theme colour with transparency added, a size computed from `theme.font` or `theme.canvas`, or a `canvasFont` call.
- Test data in `game.test.ts`, such as a literal score or a colour in a fixture.
- Anything lint, the type-checker or the tests in `npm run check` already catch, such as a missing default export or a mismatched `id` while the registry check and its test are unchanged.
- Other house rules. Testability, cleanup and README accuracy belong to the maintainability and correctness lenses.

## Reporting

- Name the house rule, the file and line, and what the player or the midway sees as a result.
- For scores, name the round-ending path and say whether it records zero times, more than once, or outside `recordScore`.
- For theme, name the literal and the `theme` key or `canvasFont` call that replaces it. If no theme value fits, say so: adding one is its own change to `src/carnival/`.
- For registration, name the export or `id` and the folder it has to match.

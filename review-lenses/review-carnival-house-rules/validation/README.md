# Validating the house-rules lens

These checks show whether `../SKILL.md` reports house rules 1 to 3 when a game
breaks them, and stays quiet when a game keeps them. Every result here is the
JSON that `tessl code review run` printed, formatted by Prettier.

## The run on record

- Lens: `review-lenses/review-carnival-house-rules/SKILL.md`, unchanged since
  4961195 (#10), git blob `a9a6e217d49f5182076a4c3ba4798ddf46bba2ba`.
- Repository at d24e110. Tessl CLI `0.119.0-beta.1`, profile `standard`,
  effort `medium`, model `gpt-6.1-sol`. Run on 2026-11-02.
- Only this lens ran (`--skill` replaces the profile's lenses), so every
  finding below comes from it.

## How to repeat it

```sh
npm ci
review-lenses/review-carnival-house-rules/validation/run.sh positive negative fb8f125 d24e110
```

Each case is one review run, so it uses review credits. For each case,
`run.sh` runs:

```sh
tessl code review run --base <base> --head <head> \
  --skill review-lenses/review-carnival-house-rules/SKILL.md --effort medium --json
```

For `positive` and `negative`, it copies the fixture to
`src/games/lens-check/` in a throwaway git worktree, runs `npm run check` there,
commits the fixture and reviews that commit. The worktree is removed afterwards
and never pushed, so no fixture registers a booth here. For a commit, it reviews
`<commit>~1..<commit>`. The output goes to `results/<case>.json`. A new run
replaces those files. Run `npm run format` afterwards, which only re-indents the JSON, and compare with `git diff results/`.

## Results

| Case       | Expected                                | Actual                                 | Match |
| ---------- | --------------------------------------- | -------------------------------------- | ----- |
| `positive` | Rule 2: storage and repeat score calls. | 3 findings: rule 2 twice, rule 3 once. | Yes   |
|            | Rule 3: hex, named colour, font string. |                                        |       |
| `negative` | No house-rule findings.                 | 0 candidates, approved.                | Yes   |
| `fb8f125`  | No house-rule findings.                 | 0 candidates, approved.                | Yes   |
| `d24e110`  | No house-rule findings.                 | 0 candidates, approved.                | Yes   |

All four match, so the lens is unchanged.

### Positive: `positive/`

A game that registers correctly and passes `npm run check`
(`results/positive.check.txt`: lint, formatting and types pass, and 62 tests
pass), so only a reviewer can catch what it does wrong:

- It keeps its own best score in `localStorage` (`BEST_KEY`): rule 2.
- It calls `recordScore` on every frame once the round is over, not once: rule 2.
- It draws with `'#102030'`, `'hotpink'` and `'bold 20px Arial'`: rule 3.

What the review reported (`results/positive.json`):

- Major, line 67: a finished round is recorded on every frame, so duplicates
  fill the 50 entries the score board keeps for each game. Rule 2.
- Major, line 52: the private best score in `localStorage` skips the shared
  module's fallback, can throw and freeze the game, and can disagree with the
  board. Rule 2.
- Nit, line 35: the colours and font are outside the theme, so the booth stops
  matching the carnival. It names `theme.colors.*` and `canvasFont`, and says no
  theme size is 20px. Rule 3.

Every expected violation was reported, with its consequence. The theme
finding's severity is `nit`, so it does not block. The lens asks for an
accurate consequence, and a mismatched look is a small one, so it is not a
miss.

### Negative: `negative/`

A game that keeps rules 1 to 3, with each exception the lens lists under "Do
not report":

- `` `${colors.accent}55` ``: a theme colour with transparency added.
- `BALLOON_RADIUS = theme.font.title` and `HEIGHT - theme.font.body`: sizes
  computed from the theme.
- `canvasFont` for every font, and `recordScore` once per round behind a
  `scoreRecorded` guard that a restart clears, as Ring Toss does.
- `game.test.ts` has a literal score and `'#ff00ff'` in a fixture.

`npm run check` passed with it in place (63 tests). The review raised no
candidate concerns at all (`results/negative.json`).

### Backtest: two historical diffs

These are the two commits since the lens arrived that change a game. The
expectations come from reading each diff before the review ran:

- **fb8f125** (#4, Water Cannon shots and rewards). Every colour the diff adds
  is `colors.accent`, `colors.danger`, `colors.water`, `colors.surface` or
  `colors.text`, and every font is `canvasFont(...)`. It does not touch scoring
  or exports. The `'#4fc3f7'` shot colour in that file dates from 756785a and is
  outside the diff, so if it came up it would have to be pre-existing, not
  introduced. Expected: nothing to report. Actual: 0 candidates.
- **d24e110** (#11, Ring Toss). A new game that imports `theme` and
  `canvasFont`, uses no colour or font literal, calls
  `recordScore(ringToss.id, state.score)` once per round behind
  `scoreRecorded`, and has `export default ringToss` with `id: 'ring-toss'`.
  Expected: nothing to report. Actual: 0 candidates.

Neither diff breaks a house rule, so the backtest only shows the lens raises no
false positives on real changes. The positive fixture is the evidence that it
catches violations.

## What this does not show

- A registration break that `npm run check` misses, such as weakening the check
  in `src/games/index.ts` or its test. No case here covers it.
- How the lens behaves alongside the other four lenses. Issue #13 covers that
  on a real pull request.
- That results stay the same from one run to the next. Each case ran once.

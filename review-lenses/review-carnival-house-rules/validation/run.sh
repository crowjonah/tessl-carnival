#!/usr/bin/env bash
# Runs the house-rules lens, and only that lens, on its validation cases.
#
#   review-lenses/review-carnival-house-rules/validation/run.sh <case>...
#
# Cases: positive, negative, fb8f125, d24e110. Each one is a real
# `tessl code review run`, so each one uses review credits.
#
# positive and negative copy a fixture to src/games/lens-check/ in a throwaway
# git worktree, commit it there, and review that commit against its parent. The
# worktree and its commit are never pushed, and the fixture never reaches
# src/games/ in this checkout. A historical case reviews that commit against
# its parent.
#
# Each case writes results/<case>.json, the review's JSON output, and
# results/<case>.check.txt for fixtures, the tail of `npm run check` in the
# worktree with the fixture in place.
#
# Results are replaced only when the review completed: its output is JSON with
# status "ok", a boolean approved and a findings list, and it exits 0, or
# non-zero with approved false. Anything else leaves the saved results as they
# were and stops the run with exit 1. A fixture whose `npm run check` fails
# stops the run before its review, so no credits go on it.
#
# run.test.sh covers these paths with stub `tessl` and `npm` commands.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(git -C "$here" rev-parse --show-toplevel)"
lens="$root/review-lenses/review-carnival-house-rules/SKILL.md"
results="$here/results"
mkdir -p "$results"

echo "lens blob: $(git -C "$root" hash-object "$lens")"
echo "repo head: $(git -C "$root" rev-parse HEAD)"
tessl --version 2>/dev/null || true

# Prints why the review output in $1, from a run that exited $2, is not a
# completed review, and fails. Prints nothing when it is one.
completed() {
  node - "$1" "$2" <<'JS'
const fs = require('fs');
const [file, code] = process.argv.slice(2);
let out;
try {
  out = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`output is not JSON (${err.message.split('\n')[0]})`);
  process.exit(1);
}
if (!out || typeof out !== 'object' || out.status !== 'ok') fail(`status is ${JSON.stringify(out && out.status)}, not "ok"`);
const outcome = out.outcome;
if (!outcome || typeof outcome.approved !== 'boolean') fail('no boolean outcome.approved');
if (!Array.isArray(outcome.findings)) fail('no outcome.findings list');
if (code !== '0' && outcome.approved) fail(`exited ${code} but approved the change`);
function fail(why) {
  console.error(why);
  process.exit(1);
}
JS
}

# Runs one review into a temporary file next to results/, and prints that
# file's path once the review completed. On failure it removes the file.
review() {
  local name="$1" dir="$2" base="$3" head="$4"
  local out code=0
  echo "== $name: $base..$head" >&2
  out="$(mktemp "$results/.$name.XXXXXX")"
  # The review exits non-zero when it requests changes; completed() decides.
  (cd "$dir" && tessl code review run --base "$base" --head "$head" \
    --skill "$lens" --effort medium --json) >"$out" || code=$?
  if ! completed "$out" "$code"; then
    echo "$name: review exited $code without a completed review; results/$name.json is unchanged" >&2
    rm -f "$out"
    return 1
  fi
  echo "$out"
}

fixture() {
  local name="$1"
  local tree check out
  tree="$(mktemp -d)/tree"
  git -C "$root" worktree add --detach --quiet "$tree" HEAD
  trap 'git -C "$root" worktree remove --force "$tree"; trap - RETURN' RETURN
  mkdir -p "$tree/src/games/lens-check"
  cp "$here/$name/game.ts" "$here/$name/game.test.ts" "$tree/src/games/lens-check/"
  # Show that lint, formatting, types and tests do not catch the case.
  ln -s "$root/node_modules" "$tree/node_modules"
  check="$(mktemp "$results/.$name.check.XXXXXX")"
  if ! (cd "$tree" && npm run check 2>&1 | tail -n 12) >"$check"; then
    cat "$check" >&2
    echo "$name: npm run check failed with the fixture in place; no review ran, results are unchanged" >&2
    rm -f "$check"
    return 1
  fi
  rm "$tree/node_modules"
  git -C "$tree" add src/games/lens-check
  git -C "$tree" -c user.name=lens-check -c user.email=lens-check@invalid \
    commit --quiet -m "lens-check: $name fixture"
  if ! out="$(review "$name" "$tree" HEAD~1 HEAD)"; then
    rm -f "$check"
    return 1
  fi
  mv "$check" "$results/$name.check.txt"
  mv "$out" "$results/$name.json"
}

historical() {
  local name="$1" out
  out="$(review "$name" "$root" "$name~1" "$name")" || return 1
  mv "$out" "$results/$name.json"
}

for case in "$@"; do
  case "$case" in
    positive | negative) fixture "$case" ;;
    *) historical "$case" ;;
  esac
done

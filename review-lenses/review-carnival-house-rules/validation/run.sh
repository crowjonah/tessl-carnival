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
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(git -C "$here" rev-parse --show-toplevel)"
lens="$root/review-lenses/review-carnival-house-rules/SKILL.md"
results="$here/results"
mkdir -p "$results"

echo "lens blob: $(git -C "$root" hash-object "$lens")"
echo "repo head: $(git -C "$root" rev-parse HEAD)"
tessl --version 2>/dev/null || true

review() {
  local name="$1" dir="$2" base="$3" head="$4"
  echo "== $name: $base..$head"
  # The review exits non-zero when it requests changes; keep its JSON anyway.
  (cd "$dir" && tessl code review run --base "$base" --head "$head" \
    --skill "$lens" --effort medium --json) >"$results/$name.json" || true
}

fixture() {
  local name="$1"
  local tree
  tree="$(mktemp -d)/tree"
  git -C "$root" worktree add --detach --quiet "$tree" HEAD
  trap 'git -C "$root" worktree remove --force "$tree"' RETURN
  mkdir -p "$tree/src/games/lens-check"
  cp "$here/$name/game.ts" "$here/$name/game.test.ts" "$tree/src/games/lens-check/"
  # Show that lint, formatting, types and tests do not catch the case.
  ln -s "$root/node_modules" "$tree/node_modules"
  (cd "$tree" && npm run check 2>&1 | tail -n 12) >"$results/$name.check.txt" || true
  rm "$tree/node_modules"
  git -C "$tree" add src/games/lens-check
  git -C "$tree" -c user.name=lens-check -c user.email=lens-check@invalid \
    commit --quiet -m "lens-check: $name fixture"
  review "$name" "$tree" HEAD~1 HEAD
}

for case in "$@"; do
  case "$case" in
    positive | negative) fixture "$case" ;;
    *) review "$case" "$root" "$case~1" "$case" ;;
  esac
done

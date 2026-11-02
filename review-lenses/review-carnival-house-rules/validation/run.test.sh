#!/usr/bin/env bash
# Checks run.sh's failure handling with stub `tessl` and `npm` commands, so it
# spends no review credits. Each case runs a copy of run.sh in a scratch git
# repository, with saved results to protect.
#
#   review-lenses/review-carnival-house-rules/validation/run.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
failures=0

# A scratch repository laid out like this one, with one commit to review.
repo="$scratch/repo"
validation="$repo/review-lenses/review-carnival-house-rules/validation"
mkdir -p "$validation/results" "$scratch/bin"
cp "$here/run.sh" "$validation/"
cp -r "$here/positive" "$here/negative" "$validation/"
echo lens >"$repo/review-lenses/review-carnival-house-rules/SKILL.md"
git -C "$repo" init --quiet
git -C "$repo" -c user.name=t -c user.email=t@invalid commit --quiet --allow-empty -m base
git -C "$repo" add .
git -C "$repo" -c user.name=t -c user.email=t@invalid commit --quiet -m change
commit="$(git -C "$repo" rev-parse --short HEAD)"

# The stubs log each call, and do what STUB_TESSL_CODE, STUB_TESSL_OUT and
# STUB_NPM_CODE say.
cat >"$scratch/bin/tessl" <<'STUB'
#!/usr/bin/env bash
echo "tessl $*" >>"$STUB_LOG"
[ "${1-}" = --version ] && exit 0
printf '%s' "${STUB_TESSL_OUT-}"
exit "${STUB_TESSL_CODE:-0}"
STUB
cat >"$scratch/bin/npm" <<'STUB'
#!/usr/bin/env bash
echo "npm $*" >>"$STUB_LOG"
echo "npm stub output"
exit "${STUB_NPM_CODE:-0}"
STUB
chmod +x "$scratch/bin/tessl" "$scratch/bin/npm"

findings='{"status":"ok","outcome":{"approved":false,"findings":[{"id":"crf-1"}]}}'
approved='{"status":"ok","outcome":{"approved":true,"findings":[]}}'
saved='{"saved": "evidence"}'

# run <name> <expected exit: 0 or fail> <review runs expected> "<case>..." [VAR=value...]
run() {
  local name="$1" expect="$2" calls="$3" cases="$4"
  shift 4
  local results="$validation/results" code=0 got case
  for case in $cases; do
    printf '%s\n' "$saved" >"$results/$case.json"
    printf 'saved check\n' >"$results/$case.check.txt"
  done
  : >"$scratch/log"
  # shellcheck disable=SC2086
  env PATH="$scratch/bin:$PATH" STUB_LOG="$scratch/log" "$@" \
    "$validation/run.sh" $cases >"$scratch/out" 2>&1 || code=$?
  got="$(grep -c '^tessl code review' "$scratch/log" || true)"
  if [ "$expect" = fail ] && [ "$code" -eq 0 ]; then
    bad "$name: run.sh exited 0, expected a failure"
  elif [ "$expect" = 0 ] && [ "$code" -ne 0 ]; then
    bad "$name: run.sh exited $code, expected 0"
  fi
  [ "$got" = "$calls" ] || bad "$name: $got review runs, expected $calls"
  if [ -n "$(find "$results" -name '.*' -type f)" ]; then
    bad "$name: left temporary files in results/"
  fi
}

bad() {
  echo "FAIL $1" >&2
  sed 's/^/  | /' "$scratch/out" >&2
  failures=$((failures + 1))
}

unchanged() {
  [ "$(cat "$validation/results/$2.json")" = "$saved" ] ||
    bad "$1: results/$2.json was replaced"
}

replaced_with() {
  [ "$(cat "$validation/results/$2.json")" = "$3" ] ||
    bad "$1: results/$2.json does not hold the new review"
}

run "tessl fails with no output" fail 1 "$commit" STUB_TESSL_CODE=7
unchanged "tessl fails with no output" "$commit"

run "tessl prints malformed JSON" fail 1 "$commit" STUB_TESSL_CODE=1 STUB_TESSL_OUT='{"status":'
unchanged "tessl prints malformed JSON" "$commit"

run "tessl reports an error" fail 1 "$commit" STUB_TESSL_CODE=1 \
  STUB_TESSL_OUT='{"status":"error","message":"not signed in"}'
unchanged "tessl reports an error" "$commit"

run "tessl output has no findings list" fail 1 "$commit" \
  STUB_TESSL_OUT='{"status":"ok","outcome":{"approved":true}}'
unchanged "tessl output has no findings list" "$commit"

run "tessl approves but exits non-zero" fail 1 "$commit" STUB_TESSL_CODE=2 STUB_TESSL_OUT="$approved"
unchanged "tessl approves but exits non-zero" "$commit"

run "fixture check fails" fail 0 positive STUB_NPM_CODE=9 STUB_TESSL_OUT="$findings"
unchanged "fixture check fails" positive
[ "$(cat "$validation/results/positive.check.txt")" = "saved check" ] ||
  bad "fixture check fails: results/positive.check.txt was replaced"

run "completed review with findings" 0 1 positive STUB_TESSL_CODE=1 STUB_TESSL_OUT="$findings"
replaced_with "completed review with findings" positive "$findings"
grep -q 'npm stub output' "$validation/results/positive.check.txt" ||
  bad "completed review with findings: results/positive.check.txt was not replaced"

run "completed review that approves" 0 1 "$commit" STUB_TESSL_OUT="$approved"
replaced_with "completed review that approves" "$commit" "$approved"

run "a failed case stops later ones" fail 1 "$commit positive" STUB_TESSL_CODE=7
unchanged "a failed case stops later ones" positive

if [ "$(git -C "$repo" worktree list --porcelain | grep -c '^worktree ')" -ne 1 ]; then
  echo "FAIL a fixture worktree was left behind" >&2
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures failed" >&2
  exit 1
fi
echo "run.sh: all stub checks pass"

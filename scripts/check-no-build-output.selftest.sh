#!/usr/bin/env bash
# Self-test for check-no-build-output.sh: builds throwaway git repos and checks it fails on
# tracked build output and passes on a clean tree.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
check="$here/check-no-build-output.sh"
fails=0

run_case() {
  local name="$1" want="$2" setup="$3"
  local dir; dir="$(mktemp -d)"
  (
    cd "$dir"
    git init -q . && git config user.email t@t.invalid && git config user.name t
    printf 'node_modules\ndist-e2e\n' > .gitignore
    mkdir -p src && echo 'x' > src/a.ts
    eval "$setup"
    git add -A >/dev/null 2>&1 || true
    git commit -qm t >/dev/null 2>&1 || true
    bash "$check" >/dev/null 2>&1
  ) && got=pass || got=fail
  rm -rf "$dir"
  if [[ "$got" == "$want" ]]; then echo "ok   $name"; else echo "FAIL $name (wanted $want, got $got)"; fails=$((fails + 1)); fi
}

run_case "a clean tree passes" pass ":"
run_case "a source folder named like a word passes (src/outline, src/builder.ts)" pass "mkdir -p src/outline && echo x > src/outline/a.ts && echo x > src/builder.ts"
run_case "dist/ at the root fails" fail "mkdir dist && echo x > dist/index.js"
run_case "dist-e2e force-added despite .gitignore fails" fail "mkdir dist-e2e && echo x > dist-e2e/index.html && git add -f dist-e2e"
run_case "a nested build folder fails" fail "mkdir -p packages/a/dist && echo x > packages/a/dist/i.js"
run_case "coverage/ fails" fail "mkdir coverage && echo x > coverage/lcov.info"
run_case "any other ignored file that is tracked fails" fail "echo x > .env.local && echo '.env*.local' >> .gitignore && git add -f .env.local"

if (( fails > 0 )); then echo "$fails case(s) failed"; exit 1; fi
echo "all cases pass"

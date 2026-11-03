#!/usr/bin/env bash
# Fails if build output is tracked in git: a known build folder anywhere in the tree, or any
# tracked file that .gitignore says to ignore (git add -f, or a folder added before its ignore
# line). Run in CI on every PR; scripts/check-no-build-output.selftest.sh checks this script.
set -euo pipefail

# Folders that only ever hold generated files.
BUILD_DIRS='(^|/)(dist|dist-[^/]+|\.dist|build|out|coverage|visual-out|playwright-report|test-results|\.vercel|\.next|\.turbo)/'

found_dirs=$(git ls-files | grep -E "$BUILD_DIRS" || true)
found_ignored=$(git ls-files -ci --exclude-standard || true)

if [[ -z "$found_dirs" && -z "$found_ignored" ]]; then
  echo "check-no-build-output: nothing generated is tracked."
  exit 0
fi

echo "check-no-build-output: build output is tracked in git. Remove it with 'git rm -r --cached <path>'"
echo "and make sure .gitignore covers it."
all=$({ printf '%s\n' "$found_dirs"; printf '%s\n' "$found_ignored"; } | sed '/^$/d' | sort -u)
echo "  $(printf '%s\n' "$all" | wc -l | tr -d ' ') files, for example:"
printf '%s\n' "$all" | head -20 | sed 's/^/    /'
exit 1

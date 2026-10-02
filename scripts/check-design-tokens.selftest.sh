#!/usr/bin/env bash
# Proves the guard still bites: builds a throwaway src/ with one violation per
# rule (plus lines that must pass), runs scripts/check-design-tokens.sh on it,
# and checks every rule fired and nothing it should ignore did.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/src/styles"
cat > "$T/src/styles/theme.css" <<'CSS'
  --scrim-solid: #123456;
CSS
cat > "$T/src/bad.tsx" <<'TSX'
export const Bad = () => (
  <div>
    <i className="h-screen" /> <i className="min-h-screen" /> <i className="max-h-screen" />
    <i style={{ height: "100vh" }} />
    <i className="text-sm" /> <i className="text-[13px]" /> <i className="text-hero" />
    <i className="rounded-lg" /> <i className="rounded" />
    <i className="shadow-md" /> <i className="shadow" />
    <i className="text-white" /> <i style={{ color: "#ff00aa" }} /> <i style={{ color: "rgb(1, 2, 3)" }} />
    <i className="bg-scrim-solid" /> <i className="bg-scrim-solid/[#fff]" />
    <i className="duration-300" /> <i className="ease-out" /> <i style={{ transition: "opacity 300ms" }} />
    {/* design-token-ignore: */}
  </div>
);
TSX
printf '.a { height: 100vh; }\n' > "$T/src/bad.css"
cat > "$T/src/good.tsx" <<'TSX'
// text-sm rounded-lg shadow-md in a comment
export const Good = () => (
  <div>
    {/* design-token-ignore: selftest, reason on the line above */}
    <i className="rounded-lg" />
    <i className="text-white" /> {/* design-token-ignore: selftest, same line */}
    <input accept="image/*" className="text-body rounded-card shadow-card duration-fast ease-standard bg-scrim-solid/40 text-on-media h-viewport" />
  </div>
);
TSX
printf '.a {\n  height: 100vh;\n  height: 100dvh;\n}\n' > "$T/src/good.css"

OUT="$(TOKEN_CHECK_ROOT="$T" "$HERE/check-design-tokens.sh")"; RC=$?
echo "$OUT"
rc=0
[ "$RC" -eq 1 ] || { echo "selftest FAIL: expected exit 1, got $RC"; rc=1; }
for rule in viewport type radius shadow color scrim motion ignore; do
  echo "$OUT" | grep -q "^FAIL \[$rule\]" || { echo "selftest FAIL: rule '$rule' did not fire"; rc=1; }
done
echo "$OUT" | grep -q "good\.\(tsx\|css\)" && { echo "selftest FAIL: flagged a line it should allow (good.*)"; rc=1; }
[ "$rc" -eq 0 ] && echo "selftest PASS: every rule fires; marked, commented and token lines pass"
exit "$rc"

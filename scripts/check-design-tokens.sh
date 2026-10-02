#!/usr/bin/env bash
# Design-token guard (P0 Foundations, Phase 4). Fails when src/ uses a raw value
# the token system replaces. The rules are the table in docs/design-audit.md §10.
#
#   scripts/check-design-tokens.sh              check src/
#   TOKEN_CHECK_ROOT=<dir> scripts/check-design-tokens.sh   check <dir>/src
#
# Escape hatch, for a value that is deliberately outside the system:
#   // design-token-ignore: <reason>        (TS/TSX; {/* … */} in JSX)
#   /* design-token-ignore: <reason> */     (CSS)
# on the offending line or the line directly above it. A marker with no reason
# is itself a failure.
#
# Plain grep -E, no PCRE, so it behaves the same on Linux and macOS.
set -u

ROOT="${TOKEN_CHECK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SRC="$ROOT/src"
THEME="$SRC/styles/theme.css"
FAILS=0
IGNORED=0

# Patterns are matched against a mirror of src/ with comments blanked out (same
# line numbers), so prose in a comment can never trip a rule. Ignore markers are
# read from the real files. Test files are skipped: they use stock classes on
# purpose.
MIRROR="$(mktemp -d)"
trap 'rm -rf "$MIRROR"' EXIT
while IFS= read -r f; do
  rel="${f#"$SRC"/}"
  mkdir -p "$MIRROR/$(dirname "$rel")"
  awk '
    # Blank comments, keep strings (so accept="image/*" is not a comment).
    # Quote state resets each line except for backtick templates.
    BEGIN { inblock = 0; tpl = 0 }
    {
      line = $0; out = ""; i = 1; n = length(line); q = tpl ? "`" : ""
      while (i <= n) {
        c = substr(line, i, 1); two = substr(line, i, 2)
        if (inblock) {
          if (two == "*/") { inblock = 0; out = out "  "; i += 2 } else { out = out " "; i++ }
        } else if (q != "") {
          out = out c
          if (c == "\\") { out = out substr(line, i + 1, 1); i += 2; continue }
          if (c == q) { q = ""; if (c == "`") tpl = 0 }
          i++
        } else if (c == "\"" || c == "\047" || c == "`") {
          q = c; if (c == "`") tpl = 1; out = out c; i++
        } else if (two == "/*") { inblock = 1; out = out "  "; i += 2 }
        else if (two == "//" && (i == 1 || substr(line, i - 1, 1) ~ /[[:space:]{;,(]/)) { out = out sprintf("%" (n - i + 1) "s", ""); break }
        else { out = out c; i++ }
      }
      print out
    }' "$f" > "$MIRROR/$rel"
done < <(find "$SRC" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) ! -name '*.test.ts' ! -name '*.test.tsx')

# A utility class token: not glued to a longer name on either side.
B='(^|[^A-Za-z0-9_-])'
E='($|[^A-Za-z0-9_-])'
SIDES='(t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee)'
COLOR_PROPS='(text|bg|border|from|via|to|fill|stroke|ring|outline|decoration|placeholder|shadow|divide|caret|accent)'

# has_reason <text>: succeeds when the text carries a marker with a reason.
has_reason() { printf '%s' "$1" | grep -Eq 'design-token-ignore:[[:space:]]*[^[:space:]*/}]'; }

# is_ignored <file> <line> <text>
is_ignored() {
  local file="$1" n="$2" text="$3" prev
  if has_reason "$text"; then return 0; fi
  if [ "$n" -gt 1 ]; then
    prev="$(sed -n "$((n - 1))p" "$file")"
    if has_reason "$prev"; then return 0; fi
  fi
  return 1
}

# report <rule> <message> <file> <line> <text>
report() {
  printf 'FAIL [%s] %s:%s  %s\n       %s\n' "$1" "${3#"$ROOT"/}" "$4" "$2" "$(printf '%s' "$5" | sed 's/^[[:space:]]*//' | cut -c1-140)"
  FAILS=$((FAILS + 1))
}


# mgrep <grep args…>: grep the comment-free mirror; prints <real file>:<line>:<real text>.
mgrep() {
  local l rel rest n
  while IFS= read -r l; do
    rel="${l%%:*}"; rest="${l#*:}"; n="${rest%%:*}"
    printf '%s:%s:%s\n' "$SRC/${rel#./}" "$n" "$(sed -n "${n}p" "$SRC/${rel#./}")"
  done < <(cd "$MIRROR" && grep -rnE "$@" . 2>/dev/null)
}

# scan <rule> <message> <regex> <globs…>   (skips files named in SKIP_FILES)
scan() {
  local rule="$1" msg="$2" re="$3"; shift 3
  local inc=() g
  for g in "$@"; do inc+=(--include="$g"); done
  local hit file n text
  while IFS= read -r hit; do
    file="${hit%%:*}"; hit="${hit#*:}"; n="${hit%%:*}"; text="${hit#*:}"
    case " ${SKIP_FILES:-} " in *" $file "*) continue ;; esac
      if is_ignored "$file" "$n" "$text"; then IGNORED=$((IGNORED + 1)); continue; fi
    report "$rule" "$msg" "$file" "$n" "$text"
  done < <(mgrep "${inc[@]}" -e "$re")
}

SKIP_FILES=""

# ── viewport height ────────────────────────────────────────────────────────
scan viewport "use h-viewport / min-h-viewport, not the bare 100vh utilities" "${B}(h|min-h|max-h)-screen${E}" '*.ts' '*.tsx' '*.css'
scan viewport "100vh ignores mobile browser toolbars; use h-viewport or 100dvh" '100vh' '*.ts' '*.tsx'
# CSS: 100vh is allowed only as the fallback line directly before a 100dvh line.
while IFS= read -r hit; do
  file="${hit%%:*}"; hit="${hit#*:}"; n="${hit%%:*}"; text="${hit#*:}"
  next="$(sed -n "$((n + 1))p" "$file")"
  if printf '%s' "$next" | grep -q '100dvh'; then continue; fi
  if is_ignored "$file" "$n" "$text"; then IGNORED=$((IGNORED + 1)); continue; fi
  report viewport "100vh in CSS must be the fallback line directly before a 100dvh line" "$file" "$n" "$text"
done < <(mgrep --include='*.css' -e '100vh')

# ── type scale ─────────────────────────────────────────────────────────────
scan type "use text-caption/small/body/lead/title/display" "${B}text-(xs|sm|base|lg|xl|[2-9]xl)${E}" '*.ts' '*.tsx' '*.css'
scan type "no arbitrary text sizes; use the type scale" "${B}text-\[[0-9.]+(px|rem|em)\]" '*.ts' '*.tsx' '*.css'
scan type "no arbitrary text sizes; use the type scale" "${B}text-\[clamp\(" '*.ts' '*.tsx' '*.css'
SKIP_FILES="$SRC/app/pages/Home.tsx"
scan type "text-hero is for the marketing page (Home.tsx) only" "${B}text-hero${E}" '*.ts' '*.tsx'
SKIP_FILES=""

# ── radius ─────────────────────────────────────────────────────────────────
scan radius "use rounded-card, rounded-control or rounded-full" "${B}rounded(-${SIDES})?-(xs|sm|md|lg|xl|2xl|3xl|4xl|btn|\[[^]]+\])${E}" '*.ts' '*.tsx' '*.css'
scan radius "bare rounded (4px) isn't in the scale" "${B}rounded([[:space:]\"'\`]|\$)" '*.ts' '*.tsx' '*.css'

# ── shadow ─────────────────────────────────────────────────────────────────
scan shadow "use shadow-card or shadow-overlay" "${B}shadow-(2xs|xs|sm|md|lg|xl|2xl|inner|\[[^]]+\])${E}" '*.ts' '*.tsx' '*.css'
scan shadow "bare shadow isn't in the scale; use shadow-card or shadow-overlay" "${B}shadow([[:space:]\"'\`]|\$)" '*.ts' '*.tsx'

# ── raw color ──────────────────────────────────────────────────────────────
scan color "use text-on-media / text-on-brand / a semantic token, not raw black or white" "${B}${COLOR_PROPS}-(white|black)(/[0-9]+|/\[[^]]+\])?${E}" '*.ts' '*.tsx' '*.css'
SKIP_FILES="$THEME"
scan color "colour literal outside theme.css; define a token there" '#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})([^0-9A-Za-z_-]|$)' '*.ts' '*.tsx' '*.css'
scan color "colour literal outside theme.css; define a token there" '(^|[^A-Za-z-])(rgba?|hsla?)\([[:space:]]*[0-9.]' '*.ts' '*.tsx' '*.css'
SKIP_FILES=""

# ── scrim-solid ────────────────────────────────────────────────────────────
# One token beyond the spec, and only ever with an opacity modifier.
scan scrim "bg-scrim-solid needs an opacity modifier: bg-scrim-solid/40" "${B}bg-scrim-solid([^/A-Za-z0-9_-]|\$)" '*.ts' '*.tsx' '*.css'
scan scrim "bg-scrim-solid takes /NN only, never a colour" "${B}bg-scrim-solid/\[?(#|rgb|hsl|oklch|var)" '*.ts' '*.tsx' '*.css'
if [ -f "$THEME" ]; then
  def="$(grep -E '^[[:space:]]*--scrim-solid:' "$THEME" | head -1)"
  if ! printf '%s' "$def" | grep -Eq -- '--scrim-solid:[[:space:]]*#0{3}(0{3})?[[:space:]]*;'; then
    report scrim "--scrim-solid must stay pure black (#000)" "$THEME" "$(grep -nE '^[[:space:]]*--scrim-solid:' "$THEME" | head -1 | cut -d: -f1)" "${def:-<missing>}"
  fi
fi

# ── motion ─────────────────────────────────────────────────────────────────
scan motion "use duration-fast or duration-base" "${B}(duration|delay)-([0-9]|\[)" '*.ts' '*.tsx' '*.css'
scan motion "use ease-standard" "${B}ease-(linear|in|out|in-out|\[)" '*.ts' '*.tsx' '*.css'
# Inline ms/s values in transition/animation/duration/delay contexts. The token
# definitions in theme.css (--duration-*, --ease-*) are the one place they live.
while IFS= read -r hit; do
  file="${hit%%:*}"; hit="${hit#*:}"; n="${hit%%:*}"; text="${hit#*:}"
  if [ "$file" = "$THEME" ] && printf '%s' "$text" | grep -Eq '^[[:space:]]*--(duration|ease)-[a-z-]+:'; then continue; fi
  if is_ignored "$file" "$n" "$text"; then IGNORED=$((IGNORED + 1)); continue; fi
  report motion "inline duration; use var(--duration-fast|base) or the Tailwind duration tokens" "$file" "$n" "$text"
done < <(mgrep --include='*.ts' --include='*.tsx' --include='*.css' -e '(^|[^A-Za-z0-9_.-])[0-9]*\.?[0-9]+m?s([^A-Za-z0-9_]|$)' | grep -E '(transition|animation|duration|delay)')

# ── the escape hatch itself ────────────────────────────────────────────────
while IFS= read -r hit; do
  file="${hit%%:*}"; hit="${hit#*:}"; n="${hit%%:*}"; text="${hit#*:}"
  has_reason "$text" && continue
  report ignore "design-token-ignore needs a reason: design-token-ignore: <why>" "$file" "$n" "$text"
done < <(grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -e 'design-token-ignore' "$SRC" 2>/dev/null)

if [ "$FAILS" -gt 0 ]; then
  printf '\ncheck-design-tokens: %d violation(s), %d ignored with a reason.\n' "$FAILS" "$IGNORED"
  exit 1
fi
printf 'check-design-tokens: 0 violations (%d lines ignored with a reason).\n' "$IGNORED"

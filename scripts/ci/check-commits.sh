#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Commit identity and privacy gate for a public repository. For every commit
# in <base>..<head> it checks:
#   - author, committer and every `Co-authored-by:` trailer use an allowed
#     no-reply address: any GitHub no-reply address at users.noreply.github.com
#     (`<id>+<login>`, a bare `<login>` or a bot's `<name>[bot]`, so outside
#     contributors who hide their e-mail pass too), or the generic no-reply
#     addresses of GitHub (web-flow merges) and Anthropic (agent co-author);
#   - author, committer and co-author names and the full message do not match
#     the personal patterns (same sources as privacy-check.sh:
#     PRIVACY_PATTERNS, PRIVACY_PATTERNS_FILE, or locally the gitignored
#     docs/internal/privacy-patterns.txt). Without patterns only the e-mail
#     rule runs, with a notice. A name equal to the login of its own GitHub
#     no-reply address is exempt: it is GitHub's default display name and
#     already public in the address.
#
# Only short shas and the kind of field that failed are printed, never the
# names, addresses, message text or patterns. Exit 1 on a finding, 2 on a
# usage or grep error.
#
# Usage: bash scripts/ci/check-commits.sh <base> <head>
#   An unknown or all-zero <base> (first push, new branch) checks every
#   commit reachable from <head>.
set -euo pipefail

base="${1:?usage: check-commits.sh <base> <head>}"
head="${2:?usage: check-commits.sh <base> <head>}"

cd "$(git rev-parse --show-toplevel)"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
chmod 700 "$work_dir"
patterns="$work_dir/patterns"

# Allowed addresses (lowercased before matching). Dots are escaped, so this
# file does not look like it contains e-mail addresses. The local part of a
# GitHub no-reply address is `<id>+<login>`, `<login>` or `<name>[bot]`.
allowed_emails=(
  '^([0-9]+\+)?[a-z0-9-]+(\[bot\])?@users\.noreply\.github\.com$'
  '^noreply@github\.com$'
  '^noreply@anthropic\.com$'
)

# --- personal patterns (never echoed) ----------------------------------------
if [[ -z "${PRIVACY_PATTERNS:-}" && -z "${PRIVACY_PATTERNS_FILE:-}" ]]; then
  main_checkout="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
  for candidate in "$PWD/docs/internal/privacy-patterns.txt" "$main_checkout/docs/internal/privacy-patterns.txt"; do
    if [[ -f "$candidate" ]]; then
      PRIVACY_PATTERNS_FILE="$candidate"
      break
    fi
  done
fi
if [[ -n "${PRIVACY_PATTERNS_FILE:-}" && ! -r "${PRIVACY_PATTERNS_FILE}" ]]; then
  echo 'check-commits: PRIVACY_PATTERNS_FILE is not readable' >&2
  exit 2
fi
{
  if [[ -n "${PRIVACY_PATTERNS_FILE:-}" ]]; then
    cat -- "$PRIVACY_PATTERNS_FILE"
    echo
  fi
  if [[ -n "${PRIVACY_PATTERNS:-}" ]]; then
    printf '%s\n' "$PRIVACY_PATTERNS"
  fi
} | tr -d '\r' | { grep -v -E '^[[:space:]]*(#|$)' || true; } >"$patterns"
personal_count="$(wc -l <"$patterns" | tr -d ' ')"
if [[ "$personal_count" -eq 0 ]]; then
  echo '::notice title=check-commits::No personal patterns (PRIVACY_PATTERNS / PRIVACY_PATTERNS_FILE); checking no-reply addresses only.'
else
  # Validate the patterns once: later matches run in pipelines, where a grep
  # error could not stop the script.
  status=0
  grep -q -i -E -f "$patterns" </dev/null || status=$?
  if [[ $status -gt 1 ]]; then
    echo 'check-commits: invalid personal pattern' >&2
    exit 2
  fi
fi

# --- commit range ------------------------------------------------------------
if ! git rev-parse --verify --quiet "${head}^{commit}" >/dev/null; then
  echo "check-commits: unknown head revision" >&2
  exit 2
fi
if [[ "$base" =~ ^0+$ ]] || ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  echo "check-commits: base not found, checking every commit reachable from head"
  range=("$head")
else
  range=("${base}..${head}")
fi
git rev-list "${range[@]}" >"$work_dir/commits"

# Returns 0 when stdin matches a personal pattern (validated above).
matches_personal() {
  [[ "$personal_count" -gt 0 ]] || return 1
  grep -q -i -E -f "$patterns"
}

# The login of a GitHub no-reply address (`<id>+<login>@users…` or
# `<login>@users…`), lowercased; empty for any other address.
noreply_login() {
  local email re='^([0-9]+\+)?([a-z0-9-]+(\[bot\])?)@users\.noreply\.github\.com$'
  email="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  if [[ "$email" =~ $re ]]; then
    printf '%s' "${BASH_REMATCH[2]}"
  fi
}

# name_is_personal <name> <email>: 0 when the name matches a personal pattern.
# A name equal to the login of its own GitHub no-reply address is GitHub's
# default display name and reveals nothing the public address does not, so it
# is not checked (the owner's patterns also match the public handle).
name_is_personal() {
  local login name
  login="$(noreply_login "$2")"
  name="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  if [[ -n "$login" && "$name" == "$login" ]]; then
    return 1
  fi
  matches_personal <<<"$1"
}

email_allowed() {
  local email
  email="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  local re
  for re in "${allowed_emails[@]}"; do
    [[ "$email" =~ $re ]] && return 0
  done
  return 1
}

findings="$work_dir/findings"
: >"$findings"
count=0
while IFS= read -r sha; do
  count=$((count + 1))
  short="${sha:0:10}"
  # One field per line: author name, author e-mail, committer name, committer e-mail.
  git log -1 --format='%an%n%ae%n%cn%n%ce' "$sha" >"$work_dir/ident"
  git log -1 --format='%B' "$sha" >"$work_dir/message"
  {
    IFS= read -r author_name
    IFS= read -r author_email
    IFS= read -r committer_name
    IFS= read -r committer_email
  } <"$work_dir/ident"

  email_allowed "$author_email" || echo "${short} author-email" >>"$findings"
  email_allowed "$committer_email" || echo "${short} committer-email" >>"$findings"
  name_is_personal "$author_name" "$author_email" && echo "${short} author-name" >>"$findings"
  name_is_personal "$committer_name" "$committer_email" && echo "${short} committer-name" >>"$findings"
  # Co-author trailers are checked field by field below, like author and
  # committer; every other line of the message is checked as text.
  { grep -v -i -E '^co-authored-by:' "$work_dir/message" || true; } >"$work_dir/body"
  matches_personal <"$work_dir/body" && echo "${short} message" >>"$findings"

  # Co-authors: "Co-authored-by: Name <address>" trailers, any case.
  while IFS= read -r trailer; do
    co_name="$(printf '%s' "$trailer" | sed -E 's/^[^:]*:[[:space:]]*//; s/[[:space:]]*<.*$//')"
    co_email="$(printf '%s' "$trailer" | sed -nE 's/.*<([^>]*)>.*/\1/p')"
    email_allowed "$co_email" || echo "${short} co-author-email" >>"$findings"
    name_is_personal "$co_name" "$co_email" && echo "${short} co-author-name" >>"$findings"
  done < <(grep -i -E '^co-authored-by:' "$work_dir/message" || true)
done <"$work_dir/commits"

if [[ -s "$findings" ]]; then
  echo 'check-commits: commits with disallowed identities or personal details (field kind only, text withheld):' >&2
  sort -u "$findings" >&2
  echo 'Use the GitHub no-reply address (git config user.email) and roles instead of names; rewrite the commits before pushing.' >&2
  exit 1
fi

echo "check-commits: ${count} commits clean (${personal_count} personal patterns + no-reply identities)"

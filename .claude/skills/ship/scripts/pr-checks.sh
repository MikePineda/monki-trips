#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Waits until every required check of a pull request's head commit has
# completed, through the REST API. Required checks come from the branch
# rules of main (ruleset); when they cannot be read, the list in
# .github/rulesets/main.json is used.
#
#   pr-checks.sh <pr-number> [timeout-seconds=2700] [interval-seconds=30]
#
# Exit 0: all required checks passed (success, neutral or skipped).
# Exit 1: a required check failed, or the timeout passed. Non-required
# failures (e2e-webkit, codeql, osv-scanner) are listed but do not fail.
set -euo pipefail

pr="${1:?usage: pr-checks.sh <pr-number> [timeout] [interval]}"
timeout="${2:-2700}"
interval="${3:-30}"

# shellcheck source=SCRIPTDIR/repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/repo.sh"

sha="$(gh api "repos/${REPO}/pulls/${pr}" --jq .head.sha)"
required="$(gh api "repos/${REPO}/rules/branches/main" \
  --jq '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context' 2>/dev/null || true)"
if [[ -z "$required" ]]; then
  top="$(git rev-parse --show-toplevel)"
  required="$(node -e '
    const rules = require(process.argv[1]).rules
    for (const r of rules) if (r.type === "required_status_checks")
      for (const c of r.parameters.required_status_checks) console.log(c.context)
  ' "$top/.github/rulesets/main.json")"
fi
echo "PR #${pr} head ${sha:0:12}; required: $(echo "$required" | paste -sd' ' -)"

started=$(date +%s)
while true; do
  # name<TAB>status<TAB>conclusion, newest run per name first.
  runs="$(gh api --paginate "repos/${REPO}/commits/${sha}/check-runs?per_page=100" \
    --jq '.check_runs | sort_by(.started_at) | reverse | .[] | [.name, .status, (.conclusion // "-")] | @tsv')"
  pending=()
  failed=()
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    line="$(printf '%s\n' "$runs" | awk -F'\t' -v n="$name" '$1 == n { print; exit }')"
    if [[ -z "$line" ]]; then
      pending+=("$name(missing)")
      continue
    fi
    status="$(cut -f2 <<<"$line")"
    conclusion="$(cut -f3 <<<"$line")"
    if [[ "$status" != 'completed' ]]; then
      pending+=("$name")
    elif [[ ! "$conclusion" =~ ^(success|neutral|skipped)$ ]]; then
      failed+=("$name=$conclusion")
    fi
  done <<<"$required"

  elapsed=$(($(date +%s) - started))
  if [[ ${#failed[@]} -gt 0 ]]; then
    echo "required checks failed: ${failed[*]}" >&2
    echo "read the log: gh api repos/${REPO}/commits/${sha}/check-runs --jq '.check_runs[] | select(.conclusion==\"failure\") | .html_url'" >&2
    exit 1
  fi
  if [[ ${#pending[@]} -eq 0 ]]; then
    optional_failed="$(printf '%s\n' "$runs" | awk -F'\t' '$2 == "completed" && $3 == "failure" { print $1 }' | sort -u | grep -vxF -f <(printf '%s\n' "$required") || true)"
    [[ -z "$optional_failed" ]] || echo "non-required checks failed (report them): $(echo "$optional_failed" | paste -sd' ' -)"
    echo "all required checks green after ${elapsed}s"
    exit 0
  fi
  if ((elapsed >= timeout)); then
    echo "timeout after ${elapsed}s; still pending: ${pending[*]}" >&2
    exit 1
  fi
  echo "${elapsed}s: waiting for ${pending[*]}"
  sleep "$interval"
done

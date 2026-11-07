#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Merges a pull request with the rebase method (the only one the ruleset
# allows) through the REST API, pinned to the head commit that passed the
# checks: if the branch moved since, GitHub refuses the merge. Prints the
# new main sha to wait for.
#
#   pr-merge.sh <pr-number> <expected-head-sha>
set -euo pipefail

pr="${1:?usage: pr-merge.sh <pr-number> <expected-head-sha>}"
sha="${2:?usage: pr-merge.sh <pr-number> <expected-head-sha>}"

# shellcheck source=SCRIPTDIR/repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/repo.sh"

gh api -X PUT "repos/${REPO}/pulls/${pr}/merge" -f merge_method=rebase -f sha="$sha" --jq .message
main_sha="$(gh api "repos/${REPO}/commits/main" --jq .sha)"
echo "main is now ${main_sha}"

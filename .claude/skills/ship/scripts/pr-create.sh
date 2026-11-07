#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Opens a pull request against main through the REST API (`gh pr` is 403 in
# cloud sessions) and prints its number and URL. If a PR for the branch is
# already open, prints that one instead.
#
#   pr-create.sh <branch> <title> <body-file>
set -euo pipefail

branch="${1:?usage: pr-create.sh <branch> <title> <body-file>}"
title="${2:?usage: pr-create.sh <branch> <title> <body-file>}"
body_file="${3:?usage: pr-create.sh <branch> <title> <body-file>}"
[[ -r "$body_file" ]] || { echo "pr-create: cannot read ${body_file}" >&2; exit 2; }

# shellcheck source=SCRIPTDIR/repo.sh
source "$(dirname "${BASH_SOURCE[0]}")/repo.sh"

existing="$(gh api "repos/${REPO}/pulls?state=open&head=${REPO%%/*}:${branch}" --jq '.[0] | select(. != null) | "\(.number) \(.html_url)"')"
if [[ -n "$existing" ]]; then
  echo "already open: ${existing}"
  exit 0
fi

gh api "repos/${REPO}/pulls" \
  -f title="$title" -f head="$branch" -f base=main -F body=@"$body_file" \
  --jq '"\(.number) \(.html_url)"'

#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Sourced by the other ship scripts: sets REPO=<owner>/<name> for `gh api`.
# Order: $GH_REPO, then the `origin` remote URL (works with https, ssh and
# the cloud session's git proxy URL, which all end in <owner>/<name>[.git]).
# `gh repo view` is not used: it needs GraphQL, which answers 403 in cloud
# sessions.

if [[ -n "${GH_REPO:-}" ]]; then
  REPO="$GH_REPO"
else
  origin_url="$(git remote get-url origin 2>/dev/null || true)"
  origin_url="${origin_url%.git}"
  origin_url="${origin_url%/}"
  name="${origin_url##*/}"
  rest="${origin_url%/*}"
  owner="${rest##*[/:]}"
  REPO="${owner}/${name}"
fi
if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "ship: cannot derive <owner>/<repo> from the origin remote; set GH_REPO" >&2
  exit 2
fi
export REPO

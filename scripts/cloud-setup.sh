#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# SessionStart hook (startup|resume), wired in .claude/settings.json.
# Cloud only: exits at once unless CLAUDE_CODE_REMOTE is "true". Never fails
# the session: no `set -e`, every step reports a status line and the script
# always exits 0. Its stdout (the status lines) becomes session context; the
# details go to .claude/cloud-setup.log (gitignored). docs/CLOUD.md explains
# each step. CI runs it too (job `cloud-parity`) and fails on any WARN line.
# scripts/ci/self-test.sh sources this file to unit-test pin_git_identity;
# sourcing only defines the function and runs no step.

# Pins the commit identity at repository scope. The cloud harness writes its
# own agent identity to the global git config, which beats the --system
# identity of the environment setup script; repo scope beats both. The
# identity is the GitHub no-reply address of the account behind `gh`, derived
# at runtime so no person is written down. Reports through `note`.
pin_git_identity() {
  local login id
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    # CI has no user token (`gh api user` needs one) and makes no commits.
    note "git identity: skipped on GitHub Actions"
    return 0
  fi
  login="$(gh api user --jq .login 2>/dev/null)"
  id="$(gh api user --jq .id 2>/dev/null)"
  if [[ "$login" =~ ^[A-Za-z0-9-]+$ && "$id" =~ ^[0-9]+$ ]] &&
    git config user.name "$login" 2>/dev/null &&
    git config user.email "${id}+${login}@users.noreply.github.com" 2>/dev/null; then
    note "git identity: ${login} (no-reply)"
  else
    note "WARN git identity: gh api user failed; commits would carry the harness identity"
  fi
}

[[ "${BASH_SOURCE[0]}" == "$0" ]] || return 0
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0
LOG=.claude/cloud-setup.log
mkdir -p .claude
: >"$LOG"
STATUS=()
note() {
  STATUS+=("$1")
  echo "cloud-setup: $1" >>"$LOG"
}
# Exports NAME=value here and, quoted, for every later Bash command of the session.
envx() {
  export "${1?}"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf 'export %s=%q\n' "${1%%=*}" "${1#*=}" >>"$CLAUDE_ENV_FILE"
  fi
}

# 1. Node from /opt/node24 (installed by the environment setup script),
#    browser and E2E settings. Playwright never downloads browsers here: its
#    CDN is not on the Trusted allowlist, Chrome for Testing is preinstalled.
if [ -x /opt/node24/bin/node ]; then
  # Drop an earlier copy first, so resumes do not grow PATH.
  rest="$(printf '%s' ":$PATH:" | sed 's#:/opt/node24/bin:#:#g; s#^:##; s#:$##')"
  envx "PATH=/opt/node24/bin${rest:+:$rest}"
fi
want="$(tr -d 'v[:space:]' <.nvmrc 2>/dev/null | cut -d. -f1)"
have="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
if [ -n "$want" ] && [ "$have" = "$want" ]; then
  note "node $(node -v), npm $(npm -v)"
else
  note "WARN node major '${have:-none}', expected ${want:-?} (.nvmrc): re-run the environment setup script"
fi
envx "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"
envx "CHROME_PATH=${CHROME_PATH:-/usr/bin/google-chrome}"
envx "E2E_WORKERS=${E2E_WORKERS:-2}"
if [ -x "$CHROME_PATH" ]; then
  note "chrome: $CHROME_PATH"
else
  note "WARN chrome: nothing executable at $CHROME_PATH; E2E cannot run"
fi

# 2. Git identity at repository scope (see pin_git_identity above).
pin_git_identity

# 3. Dependencies: only when an input of `npm ci` changed (same install as CI).
stamp=node_modules/.cloud-setup.sha256
mapfile -t inputs < <(
  printf '%s\n' scripts/cloud-setup.sh .nvmrc package-lock.json
  git ls-files '*package.json' .npmrc 2>/dev/null
)
if sha256sum --check --status "$stamp" 2>/dev/null; then
  note "deps: up to date"
else
  rm -f "$stamp"
  if timeout 420 npm ci --ignore-scripts --no-audit --no-fund >>"$LOG" 2>&1 &&
    npm rebuild --strict-allow-scripts >>"$LOG" 2>&1; then
    # node_modules/ is missing when there is nothing to install.
    { mkdir -p node_modules && sha256sum "${inputs[@]}" >"$stamp"; } 2>>"$LOG" || rm -f "$stamp"
    node scripts/install-git-hooks.mjs >>"$LOG" 2>&1
    note "deps: installed"
  else
    note "WARN deps: npm ci failed, see $LOG"
  fi
fi
if ! node scripts/ci/check-lockfile.mjs >>"$LOG" 2>&1; then
  note "WARN lockfile guard failed, see $LOG"
fi

# 4. apps/api/.env for a fresh clone (tests load .env.test on top of it).
if [ ! -f apps/api/.env ] && [ -d node_modules ] && [ -f apps/api/.env.example ]; then
  if cp apps/api/.env.example apps/api/.env && (cd apps/api && node ace generate:key) >>"$LOG" 2>&1; then
    note ".env: created"
  else
    note "WARN .env: could not create apps/api/.env, see $LOG"
  fi
fi

# 5. Postgres for Japa: Docker (postgres:17) first, system Postgres 16 as
#    fallback. Containers do not survive an idle pause, so `resume` restarts them.
if ! docker info >/dev/null 2>&1 && command -v dockerd >/dev/null 2>&1; then
  (setsid dockerd >/tmp/dockerd.log 2>&1 &)
  for _ in $(seq 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
if timeout 120 docker compose -f compose.dev.yaml up -d --wait db >>"$LOG" 2>&1; then
  note "db: docker postgres:17 on 127.0.0.1:5432"
elif service postgresql start >>"$LOG" 2>&1 &&
  su postgres -c 'psql -q' <docker/postgres/fallback.sql >>"$LOG" 2>&1; then
  note "WARN db: docker unavailable, system Postgres 16 on 5432 (CI on 17 is the authority)"
else
  note "WARN db: no Postgres; functional tests will fail (see $LOG)"
fi

# 6. Privacy patterns for the pre-push hook. Presence only, never the value.
if [ -n "${PRIVACY_PATTERNS:-}" ]; then
  note "privacy: patterns set (pre-push runs the full check)"
else
  note "privacy: patterns not set (pre-push runs the generic checks only)"
fi

printf '%s\n' "${STATUS[@]}"
exit 0

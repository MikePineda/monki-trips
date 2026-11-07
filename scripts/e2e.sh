#!/usr/bin/env bash
# End-to-end run against the real stack, from a clean slate every time:
#   1. ephemeral Postgres (compose.test.yaml, torn down with -v)
#   2. the Angular build copied into the API build (same layout as the image)
#   3. migrations on the E2E database (nothing is seeded yet)
#   4. Playwright (its webServer starts the API on the slot's port)
# Prefer `npm run e2e` from the repo root: turbo builds api/web/shared first.
# Extra arguments go to Playwright, after turbo's own `--`:
# `npm run e2e -- -- --project=mobile-chromium`.
#
# Slots: every run owns one copy of the stack, picked by E2E_SLOT (an integer,
# default 0). This script is the only place that turns a slot into names and
# ports; it exports them and compose, Playwright and the API read the env.
#
#   slot  compose project       API     Postgres  Playwright folders
#   0     monkitrips-test       3334    5433      test-results, playwright-report
#   N     monkitrips-test-N     3334+N  5433+N    test-results-N, playwright-report-N
#
# Without E2E_SLOT the first free slot is used, so two checkouts can run the
# suite at the same time. A set E2E_SLOT that is already taken stops the run.
# Teardown only removes this run's project. While another slot runs,
# Playwright gets 3 workers (E2E_WORKERS overrides).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_BUILD="apps/api/build"
WEB_DIST="apps/web/dist/web/browser"
# One directory per claimed slot, holding the owner's PID (see claim_slot). They
# live in the clone's shared git directory, so every worktree of this checkout
# sees the same locks (outside a git checkout: the temp directory).
LOCKS="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "${TMPDIR:-/tmp}")/e2e-slots"
mkdir -p "$LOCKS"
MAX_SLOT=19

if [[ ! -f "$API_BUILD/bin/server.js" || ! -f "$WEB_DIST/index.html" ]]; then
  echo "e2e: builds not found. Run 'npm run e2e' from the repo root (it builds first)." >&2
  exit 1
fi

# Names and ports of a slot, as the variables compose, Playwright and the API read.
slot_env() {
  local slot=$1
  E2E_SLOT=$slot
  E2E_PROJECT="monkitrips-test"
  E2E_RESULTS_DIR="test-results"
  E2E_REPORT_DIR="playwright-report"
  if ((slot > 0)); then
    E2E_PROJECT+="-$slot"
    E2E_RESULTS_DIR+="-$slot"
    E2E_REPORT_DIR+="-$slot"
  fi
  E2E_API_PORT=$((3334 + slot))
  E2E_DB_PORT=$((5433 + slot))
}

# True when something accepts TCP connections on 127.0.0.1:<port>. Node instead
# of lsof, which is missing from minimal Linux images and cloud VMs.
port_in_use() {
  node -e '
    const socket = require("node:net").connect({ host: "127.0.0.1", port: Number(process.argv[1]) })
    const done = (code) => { socket.destroy(); process.exit(code) }
    socket.setTimeout(500, () => done(1))
    socket.on("connect", () => done(0))
    socket.on("error", () => done(1))
  ' "$1"
}

# True when one of the slot's ports is taken or the slot's compose project
# still has containers (a run that was not torn down).
slot_busy() {
  slot_env "$1"
  local port
  for port in "$E2E_API_PORT" "$E2E_DB_PORT"; do
    if port_in_use "$port"; then
      return 0
    fi
  done
  [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$E2E_PROJECT")" ]]
}

# Claims a slot for this run (mkdir is atomic, so two runs starting together
# never get the same one). A lock whose owner is gone is taken over.
LOCK=""
claim_slot() {
  local lock="$LOCKS/slot-$1" owner
  if mkdir "$lock" 2>/dev/null; then
    echo $$ >"$lock/pid"
    LOCK=$lock
    return 0
  fi
  owner="$(cat "$lock/pid" 2>/dev/null || true)"
  if [[ -n "$owner" ]] && ! kill -0 "$owner" 2>/dev/null; then
    rm -rf "$lock"
    claim_slot "$1"
    return
  fi
  return 1
}

release_slot() {
  if [[ -n "$LOCK" ]]; then
    rm -rf "$LOCK"
    LOCK=""
  fi
}

# True when another live run holds a slot (a lock other than ours whose PID runs).
other_runs() {
  local lock owner
  for lock in "$LOCKS"/slot-*; do
    [[ -d "$lock" && "$lock" != "$LOCK" ]] || continue
    owner="$(cat "$lock/pid" 2>/dev/null || true)"
    if [[ -n "$owner" ]] && kill -0 "$owner" 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

if [[ -n "${E2E_SLOT:-}" ]]; then
  if [[ ! "$E2E_SLOT" =~ ^[0-9]+$ ]] || ((E2E_SLOT > MAX_SLOT)); then
    echo "e2e: E2E_SLOT must be an integer from 0 to $MAX_SLOT (got '$E2E_SLOT')." >&2
    exit 1
  fi
  slot=$E2E_SLOT
  if ! claim_slot "$slot"; then
    echo "e2e: slot $slot is in use by another run (PID $(cat "$LOCKS/slot-$slot/pid" 2>/dev/null))." >&2
    exit 1
  fi
  if slot_busy "$slot"; then
    release_slot
    echo "e2e: slot $slot is busy (port $E2E_API_PORT or $E2E_DB_PORT is taken or project $E2E_PROJECT has containers). Unset E2E_SLOT to pick a free one." >&2
    exit 1
  fi
else
  slot=""
  for candidate in $(seq 0 "$MAX_SLOT"); do
    if claim_slot "$candidate"; then
      if ! slot_busy "$candidate"; then
        slot=$candidate
        break
      fi
      release_slot
    fi
  done
  if [[ -z "$slot" ]]; then
    echo "e2e: no free slot from 0 to $MAX_SLOT." >&2
    exit 1
  fi
fi

slot_env "$slot"
export E2E_SLOT E2E_PROJECT E2E_RESULTS_DIR E2E_REPORT_DIR E2E_API_PORT E2E_DB_PORT
echo "e2e: slot $E2E_SLOT (project $E2E_PROJECT, API :$E2E_API_PORT, Postgres :$E2E_DB_PORT)"

# Absolute path: the cleanup trap must work from any working directory.
COMPOSE=(docker compose -p "$E2E_PROJECT" -f "$ROOT/compose.test.yaml")

cleanup() {
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  release_slot
}
trap cleanup EXIT
# Ctrl-C and kill go through the EXIT trap too, so the stack never outlives the run.
trap 'exit 130' INT
trap 'exit 143' TERM

echo "e2e: starting compose.test.yaml"
"${COMPOSE[@]}" up -d --wait db

echo "e2e: copying the web build into the API build"
rm -rf "$API_BUILD/public"
mkdir -p "$API_BUILD/public"
cp -R "$WEB_DIST/." "$API_BUILD/public/"

set -a
# e2e.env holds plain KEY=value lines (no shell code to follow).
# shellcheck disable=SC1091
source e2e/e2e.env
set +a
# The API's port-dependent settings for this slot (e2e.env holds the rest).
export PORT="$E2E_API_PORT"
export APP_URL="http://127.0.0.1:$E2E_API_PORT"
export DB_PORT="$E2E_DB_PORT"

echo "e2e: migrating ${DB_DATABASE}"
(cd "$API_BUILD" && node ace migration:run --force)

# Nothing is seeded yet: users and the demo trip arrive with WP 0.5.

# Two suites at Playwright's default worker count overload one machine, so a
# run that finds another slot claimed when its tests start uses 3. A set
# E2E_WORKERS wins, and a --workers flag passed to Playwright wins over both.
if [[ -z "${E2E_WORKERS:-}" ]] && other_runs; then
  E2E_WORKERS=3
fi
export E2E_WORKERS="${E2E_WORKERS:-}"

echo "e2e: running Playwright on slot $E2E_SLOT, workers: ${E2E_WORKERS:-default}"
(cd e2e && npx playwright test "$@")

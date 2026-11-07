#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# The strong no-network check: runs the whole test suite (`turbo run test`)
# in a container on a Docker network created with `--internal`, so the kernel
# has no route to the internet at all. The only other container on that
# network is a throwaway postgres:17 on tmpfs. The in-process guard
# (scripts/test/no-network.mjs) still runs and allows only that database.
#
# The suite runs from the host checkout (bind mount) with the host's
# node_modules, so the host must be Linux on the same CPU as the image
# (cloud VM, CI). The node image tag comes from .nvmrc: node:<version>-slim.
#
# Prerequisites: `npm ci` done and apps/api/.env present (scripts/cloud-setup.sh
# does both in a cloud session).
#
# Usage: bash scripts/test-offline.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ "$(uname -s)" != 'Linux' ]]; then
  echo 'test-offline: Linux hosts only (cloud VM, CI): node_modules must hold Linux binaries' >&2
  exit 2
fi
if [[ ! -d node_modules ]]; then
  echo 'test-offline: no node_modules; run npm ci --ignore-scripts and npm rebuild --strict-allow-scripts first' >&2
  exit 2
fi

node_version="$(tr -d 'v[:space:]' <.nvmrc)"
node_image="node:${node_version}-slim"
db_image='postgres:17'
suffix="$$"
network="monkitrips-offline-${suffix}"
db="monkitrips-offline-db-${suffix}"

cleanup() {
  docker rm -f "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create --internal "$network" >/dev/null
echo "test-offline: internal network ${network}, ${db_image} as ${db}, suite in ${node_image}"

# Same contract as compose.dev.yaml: the entrypoint creates `monkitrips` and
# docker/postgres/init.sql adds `monkitrips_test` (POSTGRES_DB=monkitrips_test
# would make init.sql fail on "already exists" and stop the container).
init_args=()
postgres_db=monkitrips_test
if [[ -f docker/postgres/init.sql ]]; then
  init_args=(-v "$PWD/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro")
  postgres_db=monkitrips
fi
docker run -d --name "$db" --network "$network" \
  --tmpfs /var/lib/postgresql/data:rw \
  -e POSTGRES_USER=monkitrips -e POSTGRES_PASSWORD=monkitrips -e POSTGRES_DB="$postgres_db" \
  "${init_args[@]}" "$db_image" >/dev/null

# Ready means the final server answers over TCP with the test database: the
# entrypoint's temporary init server listens on the unix socket only.
ready=''
for _ in $(seq 1 60); do
  if docker exec -e PGPASSWORD=monkitrips "$db" \
    psql -h 127.0.0.1 -U monkitrips -d monkitrips_test -qtAc 'select 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ -z "$ready" ]]; then
  echo 'test-offline: Postgres did not become ready in 60 s' >&2
  docker logs "$db" >&2 || true
  exit 1
fi

# Same uid as the host so files written to the checkout (turbo cache, build
# output) stay owned by the caller. HOME must be writable for npm and turbo.
status=0
docker run --rm --network "$network" \
  --user "$(id -u):$(id -g)" \
  -v "$PWD:/repo" -w /repo \
  -e HOME=/tmp \
  -e CI=true \
  -e TZ=UTC \
  -e TURBO_TELEMETRY_DISABLED=1 \
  -e TURBO_NO_UPDATE_NOTIFIER=1 \
  -e NG_CLI_ANALYTICS=false \
  -e NO_NETWORK_ALLOW_HOSTS="$db" \
  -e DB_HOST="$db" -e DB_PORT=5432 \
  -e DB_USER=monkitrips -e DB_PASSWORD=monkitrips -e DB_DATABASE=monkitrips_test \
  "$node_image" npx --no-install turbo run test --force || status=$?

if [[ $status -ne 0 ]]; then
  echo "test-offline: suite failed without network (exit ${status})" >&2
  exit "$status"
fi
echo 'test-offline: suite green with no route to the internet'

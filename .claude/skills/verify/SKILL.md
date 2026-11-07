---
name: verify
description: Run the monki-trips gate (`npm run verify`: lint, typecheck, unit + functional tests, build, Playwright E2E; or `verify:quick` without E2E), summarize failures by layer, and refuse to open a pull request while anything is red. Use before any PR, when asked to "verify", "run the gate", "is it green?", "check everything", or before reporting a work package as done. Works the same on a laptop and in a cloud session.
---

# verify

The PR gate for this repo. Nothing gets a pull request while it is red.

## 1. Preconditions (fix silently when you can)

- **Node from PATH.** No nvm here. In a cloud session the SessionStart hook
  put `/opt/node24/bin` first on PATH (`.claude/cloud-setup.log` says what it
  did). Check the major matches `.nvmrc`:
  ```bash
  [ "$(node -p 'process.versions.node.split(".")[0]')" = "$(cut -d. -f1 .nvmrc | tr -d v)" ] && echo node ok
  ```
  If it does not, try `export PATH=/opt/node24/bin:$PATH`; on a laptop, switch
  to the `.nvmrc` version with your version manager. Never run the gate on
  another major.
- **Dependencies** installed the CI way:
  `npm ci --ignore-scripts && npm rebuild --strict-allow-scripts`
  (only if `node_modules` is missing or the lockfile changed).
- **Postgres reachable on 127.0.0.1:5432** with the `monkitrips_test`
  database, either Docker or the system Postgres:
  ```bash
  node -e "require('node:net').connect(5432,'127.0.0.1').on('connect',function(){console.log('db ok');this.end()}).on('error',()=>{console.log('db down');process.exit(1)})"
  ```
  Down: `npm run services:up` (Docker, `compose.dev.yaml`). In a cloud
  session where Docker fails, `service postgresql start` and
  `su postgres -c 'psql -q' < docker/postgres/fallback.sql` (Postgres 16; CI
  on 17 is the authority).
- **Generated contract in sync:** `npm run codegen`, then
  `git status --short apps/api/.adonisjs`. Commit any change together with
  the code that caused it.

## 2. Run

```bash
npm run verify          # turbo run lint typecheck test build && npm run e2e
npm run verify:quick    # same without E2E, for the inner loop
```

The final answer before a PR needs the full `verify`. In a cloud session:

- E2E runs Chromium only, from `CHROME_PATH` (Chrome for Testing);
  Playwright never downloads browsers there. WebKit runs in CI only.
- **Only one full `verify` at a time** on the VM (4 vCPU); parallel
  subagents use `verify:quick`.
- Bash calls time out: run long commands with a generous timeout or in the
  background and wait for them.

## 3. Summarize by layer

One line each, in this order, with the failing package and test names and
only the first relevant error per failure:

1. **lint**
2. **typecheck**
3. **unit** (Japa `unit`, Vitest domain, shared `node:test`)
4. **functional** (Japa `functional` on Postgres, Vitest TestBed)
5. **integration** (S3 spec when `S3_ENDPOINT` is set, i18n parity,
   architecture spec, `no_network` spec)
6. **build**
7. **e2e** (spec and Playwright project)

## 4. Verdict

- All green: say so, with durations, and allow the PR.
- Anything red: **do not open or update a pull request** and do not push to
  `main`. Report the failures and the likely cause; fix them when that is in
  scope, then run the gate again.

## Notes

- A test failing with `no-network: blocked <host>` means code under test
  tried to reach the internet. Use the fake provider or a loopback stub;
  never add a public host to `NO_NETWORK_ALLOW_HOSTS`.
- Flaky E2E: check leftovers of your own run first (`scripts/e2e.sh` prints
  its slot and compose project; `docker compose -p <project> -f
compose.test.yaml down -v`). Never tear down another run's project.
- Turbo caches lint, typecheck and build; tests and E2E never cache.
  `--force` reruns everything.
- Never "fix" a red gate by skipping, deleting or loosening a test without
  the owner's explicit approval.

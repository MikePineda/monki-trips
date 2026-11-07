---
name: ship
description: Take a monki-trips branch to production with guardrails - Conventional commit, the `verify` gate, push, pull request through the GitHub REST API, required checks green, rebase merge (= deploy), wait until /api/health reports the new sha, smoke, report. Works in cloud sessions (no `gh pr`, no SSH). Use when asked to "/ship", "ship it", "deploy", "súbelo", "mándalo a producción", "merge and deploy", or to get a finished work package live.
---

# ship: from a branch to production

The contract: nothing reaches `main` without the `verify` gate green and the
required CI checks green, and nothing is called "shipped" until production
reports the merge commit. **Merge = deploy**: the deploy platform builds
`main` (ARM64, Dockerfile stage `runtime`) and rolls it out start-first.

Only the master agent ships. Subagents push their branch and stop.

Everything here works in a cloud session: GitHub calls go through `gh api`
(REST); `gh pr`, `gh issue` and GraphQL answer 403 behind the cloud proxy.
The scripts live next to this file:

```bash
S=.claude/skills/ship/scripts   # repo.sh derives <owner>/<repo> from `origin` (or $GH_REPO)
```

Production is reached only through `SMOKE_BASE_URL` (an environment
variable of the cloud environment, or the owner's local operator settings).
Never write its value into a file, commit, PR or log line.

## 1. What is shipping

```bash
git status --short && git log --oneline origin/main..HEAD && git diff --stat origin/main...HEAD
```

Never ship from `main`. Summarize the change in user terms. Stop and ask the
owner before merging when the diff has any of these:

- A migration that is not additive (drop, rename, type change): during a
  start-first rollout the old version runs on the new schema for seconds.
- A new **required** variable in `apps/api/start/env.ts`: it must exist on
  the deploy platform before the merge or the new task crashes at boot.
- Changes to auth, sessions, CSRF, trip membership scoping or the PWA cache
  headers that the reviewer has not passed.

## 2. Commit

Conventional Commits (commitlint runs in the hook and in CI; types drive
release-please, so `feat`/`fix`/`security` change the version). One logical
change per commit, English, body explaining why. End every message with the
attribution trailers this session's instructions give. Never `--no-verify`.
The pre-push hook runs the privacy check and `check-commits.sh`.

## 3. Sync and gate

```bash
git fetch origin && git rebase origin/main     # linear history: the ruleset only allows rebase merges
npm run verify                                  # see the verify skill; one full run at a time in the cloud
```

Rebase before the first push only. Once a branch is pushed, never rewrite
it (force pushes are denied in `.claude/settings.json`): GitHub's rebase
merge replays the commits onto `main` itself. If the PR then conflicts,
cherry-pick its commits onto a new branch from `origin/main`, resolve, push,
open a new PR and close the old one
(`gh api -X PATCH "repos/$REPO/pulls/<n>" -f state=closed`). No merge
commits: the ruleset requires linear history.
Red = stop: fix (in scope) or report; never skip, delete or loosen a test.

## 4. Push and open the pull request

```bash
git push -u origin <branch>
$S/pr-create.sh <branch> "<conventional title>" <body-file>    # prints "<number> <url>"
```

The body says what changed, why, how it was verified (the `verify` summary)
and anything the owner must do (new platform variables). End it with the PR
attribution line this session's instructions give. No session links: they
point to a private transcript (`attribution.sessionUrl` is off).

## 5. Wait for checks

```bash
$S/pr-checks.sh <number>          # polls check-runs of the head sha; exit 0 when every required check is green
```

Required (ruleset): `ci`, `commitlint`, `gitleaks`, `privacy`, `e2e`,
`cloud-parity`, `image-arm64`. Non-required (`e2e-webkit`, CodeQL,
OSV-Scanner) are listed when red; mention them in the report. A red required
check stops the ship: open its `html_url` from
`gh api "repos/$REPO/commits/<sha>/check-runs"` and fix forward. Never merge
red.

## 6. Merge (= deploy)

Merge autonomously only when the gate, every required check and, for risky
packages, the read-only reviewer are green.

```bash
head_sha="$(gh api "repos/$REPO/pulls/<number>" --jq .head.sha)"
$S/pr-merge.sh <number> "$head_sha"     # merge_method=rebase, pinned to the checked sha; prints the new main sha
```

The branch is deleted by the repo setting. Do not merge the release-please
PR as part of a ship; it is its own deploy.

## 7. Wait for the new build

Rebase merges rewrite the commits, so wait for the **new main sha** printed
by `pr-merge.sh`, not the branch head.

```bash
$S/wait-for-deploy.sh "$SMOKE_BASE_URL" "<main-sha>" 900 15
```

It polls `GET /api/health` with a browser User-Agent (the CDN's browser
check answers 403 to bare clients) until `sha` matches and `status` is `ok`.

## 8. Smoke

```bash
curl -fsS -A 'Mozilla/5.0' "$SMOKE_BASE_URL/api/health"
curl -sI -A 'Mozilla/5.0' "$SMOKE_BASE_URL/ngsw-worker.js" | grep -i 'cache-control\|cf-cache-status'
```

The service worker must answer `cache-control: no-cache` and a CDN cache
status of `DYNAMIC` or `BYPASS`. The Bruno smoke (`npm run smoke:prod`)
needs the smoke user's credentials and runs from the owner's machine only.

## 9. Report

One screen: PR number and title, main sha, minutes from merge to live,
`/api/health` version and sha, smoke result, the service-worker header
check, and anything flagged on the way (non-required red checks, slow build,
platform variables the owner must add). Answer in the language the owner
wrote in.

## Deploy diagnostics (laptop only)

The deploy platform and the server are not reachable from cloud sessions.
When `wait-for-deploy.sh` times out in the cloud, report it and hand over
to the owner's machine, where the operator:

- reads the newest deployment's status and build log on the platform. An
  error within a second of starting usually means the Dockerfile's final
  stage is no longer named `runtime` (the platform builds with `--target`);
- with the build done but production still on the old sha, reads the
  application logs: a missing required variable (`start/env.ts` validates at
  boot), a failing migration (`MIGRATE_ON_START`) or a seeder error; the
  rollout already rolled back, so fix forward with a new PR;
- with no deployment at all, triggers one build of `main` by hand (the push
  webhook did not fire).

Platform ids live only in the owner's private notes, never in the repo.

## Rollback

Migrations are additive, so the previous image runs on the new schema.

1. **Automatic**: if the new task never turns healthy, the rollout already
   rolled back; production keeps the old sha. Fix forward.
2. **Live but broken**: revert and ship the revert (steps 2 to 8):
   `git switch -c revert/<topic> origin/main && git revert <sha>...`.
   The platform's own rollback is a laptop-only option.
3. Confirm with `wait-for-deploy.sh` and the smoke, then tell the owner.

## Guardrails

- Never push to `main`, never `--no-verify`, never merge with a red required
  check, never skip or weaken a test to ship.
- Production is touched only by reads (health, headers, the smoke user's
  read-only collection). Writes to production data are never part of a ship.

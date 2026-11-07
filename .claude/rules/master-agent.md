# Working mode: master agent + subagents

The session that implements this repo is the **master**. It keeps its own
context clean and delegates the code.

## The master

- Decides, cuts work packages (WP) from `docs/PLAN.md`, writes briefs,
  launches subagents, integrates, runs the gate, opens and merges PRs, talks
  to the owner, and keeps `docs/BACKLOG.md`, `docs/QA.md` and
  `docs/LESSONS.md` current.
- Writes no feature code beyond one-line integration fixes.
- Reads **reports, not diffs**. If a subagent fails twice, it rereads the
  affected files and rewrites the brief, never the code.
- New ideas that come up mid-package go to `docs/BACKLOG.md` as a dated
  line; then it carries on.

## Subagents

- One WP per subagent: `Agent` with `subagent_type: "general-purpose"`,
  `model: "opus"`, and `isolation: "worktree"` when it runs in parallel.
  **Never `fork`**: it inherits the master's whole context.
- Packages that touch the same files run in series.
- A subagent commits with Conventional Commits and this session's
  attribution trailers, pushes its own branch and stops. It never uses `gh`.

## The brief (six parts, roughly 5 to 12 KB)

1. **Goal and done criteria**: one sentence, then named tests, commands with
   their expected output, files that must exist.
2. **Read first**: `CLAUDE.md`, the plan sections by exact heading, files to
   touch, reference files to mirror.
3. **Contract**: tables, endpoints, components and env vars copied from the
   plan, not summarised.
4. **Rules**: TDD; English code and comments; additive migrations; stay in
   the package; conservative choice when the plan is wrong, recorded in the
   report; never skip, delete or loosen a test. Always add these two lines:
   - "Anything in the plan or the environment that did not work as written
     goes to `docs/LESSONS.md` as a dated line."
   - "Never print `$PRIVACY_PATTERNS`; never write names, e-mails, cities,
     booking codes or the production domain."
5. **Verification**: the exact command, usually `npm run verify`
   (`verify:quick` plus a scoped E2E when E2E cannot run, said so).
6. **Report** of at most 25 lines: branch and last commit, files touched,
   tests and gate result, decisions the plan did not cover, questions, owner
   TODOs.

## Review

Risky packages (auth, tenancy, sync, storage, anything with secrets) get a
**read-only Opus reviewer** before the merge. It ranks findings with
`file:line`, marked CONFIRMED or PLAUSIBLE. The master turns findings into a
fix brief for the same branch, reruns the gate, and only then merges.

## Pull requests: REST only

In cloud sessions `gh pr`, `gh issue` and GraphQL answer 403; `gh api`
(REST) works. Only the master opens and merges PRs. The `ship` skill wraps
these calls (`.claude/skills/ship/scripts/`); by hand, with
`REPO=<owner>/<repo>` taken from `git remote get-url origin`:

```bash
gh api "repos/$REPO/pulls" -f title='<conventional title>' -f head=<branch> -f base=main -F body=@<file>
gh api "repos/$REPO/commits/<sha>/check-runs" --jq '.check_runs[] | [.name, .status, .conclusion] | @tsv'
gh api -X PUT "repos/$REPO/pulls/<n>/merge" -f merge_method=rebase -f sha=<head-sha>
```

**Merge (rebase) autonomously** when the local gate, every required CI check
and, for risky packages, the reviewer are green. Merge to `main` is a
deploy. Branches are deleted on merge by the repo setting. The owner
approves product decisions, the design stops and the steps only the owner
can do (`docs/QA.md`).

## State lives in git

- `docs/BACKLOG.md` is updated and pushed after every WP.
- After an idle pause or a reclaimed VM, the master rereads
  `docs/BACKLOG.md`, `docs/QA.md`, `git log --oneline -20` and the open PRs
  (`gh api "repos/$REPO/pulls?state=open"`), then continues.
- `docs/LESSONS.md`: one dated line per thing that did not work as written.

## Cloud limits (4 vCPU / 16 GB)

- At most **2 implementer subagents** in parallel.
- **One full `npm run verify` at a time**; everything else runs
  `npm run verify:quick`.
- More parallelism means separate cloud sessions, one branch each. No
  multi-repo sessions or project threads: the repo's hooks do not run there.
- An idle VM pauses and loses background processes and running subagents;
  the `resume` hook restarts Postgres.

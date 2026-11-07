# Privacy rules (public repository)

This repository is public from its first commit. Everything committed, every
commit message, PR body, CI log and test fixture is public forever.

## Never write

- Real people's names, e-mail addresses, phone numbers, home towns or cities
  they live in, booking or confirmation codes, ticket or seat numbers,
  passport or visa data, or real trip details.
- The production domain or any host that identifies the owner. Code reads
  `APP_URL`; docs and examples use `example.com` (`https://trips.example.com`,
  `demo@example.com`).
- Names of backup buckets, deploy-platform ids, SSH aliases or server names.
- The owner's GitHub handle on its own. It may appear only inside the
  canonical repository URL (`github.com/<owner>/monki-trips`) or in
  `.github/CODEOWNERS`; scripts derive it from that URL.

Use roles instead of names: "the owner", "a trip member", "the editor",
"the traveller", "the maintainer".

## Fixtures and tests

- Only synthetic data: invented cities, codes and people
  (`e2e/fixtures/demo-trip.json`, `apps/api/tests/fixtures/`). The `privacy`
  CI gate scans them like any other file.
- Real trip data is imported **only in production, from the owner's
  machine**, through the app's import UI or endpoint. It never enters the
  repo, a cloud VM, a prompt or an agent's context.

## Privacy patterns

- The owner's patterns live outside the repo: the `PRIVACY_PATTERNS` CI
  secret, the `PRIVACY_PATTERNS` variable of the cloud environment and the
  gitignored `docs/internal/privacy-patterns.txt` on the owner's machine.
- **Never print, echo, log, grep for or decode `$PRIVACY_PATTERNS`**, and
  never copy it into a file. Check its presence only:
  `[ -n "${PRIVACY_PATTERNS:-}" ] && echo set`.
- The guards (`scripts/ci/privacy-check.sh`, `scripts/ci/check-commits.sh`)
  print locations and field kinds only. Keep it that way in any new script.
- Commits use the GitHub no-reply identity; `check-commits.sh` enforces it
  on pre-push and in CI.

## LESSONS rule

Anything in the plan, the docs or the environment that did not work as
written becomes a dated line in `docs/LESSONS.md` (English, no names):

```
- 2026-11-07 · <area> · <what was expected> → <what happened> → <what we do now>
```

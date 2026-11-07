# Security

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability
reporting ("Report a vulnerability" on the Security tab) with steps to
reproduce and the affected version (`GET /api/health` reports `version` and
`sha`). Expect an answer within a week.

## Rules the code follows

- Secrets only in environment variables. `apps/api/start/env_schema.ts`
  validates every variable at boot and wraps secrets so they never reach
  logs. Gitleaks runs on every push and pull request.
- No personal data in the repository: fixtures and seeds are synthetic;
  seed accounts come from `SEED_*` environment variables.
- Cookie sessions (encrypted cookie store, httpOnly, `secure` in production,
  `sameSite: lax`) and CSRF protection on every state-changing request. The
  SPA is served from the same origin; CORS is disabled.
- Public health probes expose statuses only, never hosts or error details.
- The container runs as `node` with root-owned, read-only code and no
  volume; Postgres is not published outside the host.
- Dependencies: Dependabot (weekly, grouped) for npm, GitHub Actions and
  Docker images.

## Known gaps (tracked in docs/BACKLOG.md)

- Content-Security-Policy is off until the nonce-based policy lands
  (report-only first).
- Rate limiting arrives with authentication.

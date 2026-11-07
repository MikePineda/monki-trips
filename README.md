# monki trips

An offline-first travel PWA for people travelling together: the itinerary
day by day, where you sleep each night, the documents you need (and the ones
to print), shared tasks and the budget in the trip's currencies. Everything
stays usable without a connection and syncs when you are back online.

- **Stack:** AdonisJS 7 API + Postgres 17, Angular 22 PWA, npm workspaces +
  Turborepo, one Docker image.
- **Start here:** [`CLAUDE.md`](CLAUDE.md) (rules and commands),
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
  [`docs/CONTRACTS.md`](docs/CONTRACTS.md),
  [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

Status: early scaffold (Phase 0). The app shell, health probes, i18n (en/es)
and the delivery pipeline exist; trips, sync and offline storage come next.

## Self-host in 3 commands

Docker with Compose v2 is all you need.

```bash
cp .env.selfhost.example .env     # then set APP_KEY (openssl rand -base64 32) and DB_PASSWORD
docker compose up -d --build --wait
curl -s localhost:3333/api/health # {"status":"ok","version":...,"sha":...}
```

Open http://localhost:3333. Details, upgrades and backups:
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Development quickstart

Node 24 (`nvm use`), Docker.

```bash
npm install                                   # also installs the commit-msg hook
npm run services:up                           # Postgres 17 on 127.0.0.1:5432
cp apps/api/.env.example apps/api/.env && (cd apps/api && node ace generate:key)
(cd apps/api && node ace migration:run)
npm run dev                                   # api :3333 + web :4200 (proxies /api)
npm run verify                                # lint, typecheck, test, build + e2e
```

## License

Copyright (C) 2026 monki-trips contributors.

monki trips is free software under the [GNU AGPL-3.0-only](LICENSE). You may
self-host it and change it; if you run a modified version as a network
service, you must offer its source to its users under the same license.

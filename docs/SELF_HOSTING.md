# Self-hosting

monki trips runs on any machine with Docker and Compose v2: one app
container and one Postgres 17 container, defined in `compose.yaml` at the
repository root. There is no published image yet; Compose builds it from
the source.

## First start

```bash
git clone <this repository> monki-trips && cd monki-trips
cp .env.selfhost.example .env
```

Edit `.env`:

- `APP_KEY`: generate once with `openssl rand -base64 32` and keep it.
  Changing it signs everyone out.
- `DB_PASSWORD`: pick a strong password before the first start; it becomes
  the password of the Postgres volume.
- `APP_URL`: the address people will open, for example
  `https://trips.example.com` behind your reverse proxy, or keep
  `http://localhost:3333` to try it on this machine.

```bash
docker compose up -d --build --wait
curl -s localhost:3333/api/health
```

The health answer shows `status`, `version` and `sha`. Open `APP_URL`.

## The first user

`.env.selfhost.example` ships with `REGISTRATION_OPEN=true` so you can
create the first account. Once everyone who needs an account has one, close
sign-up and restart the app:

```bash
sed -i.bak 's/^REGISTRATION_OPEN=true/REGISTRATION_OPEN=false/' .env
docker compose up -d --wait
```

People you invite to a trip can still sign up while registration is closed.
(Accounts and invitations arrive with the next release of the scaffold.)

## Reaching it from your phone

The app listens on `127.0.0.1:3333` only. Put a reverse proxy with TLS in
front of it (Caddy, nginx, Traefik...) and set `APP_URL` to the public
address. A PWA needs HTTPS to install and to work offline.

## Upgrades

```bash
git pull
docker compose up -d --build --wait
```

`MIGRATE_ON_START=true` applies database migrations before the new version
serves requests. Migrations are additive, so the previous version keeps
working during the switch.

## Backups

All state lives in the `pgdata` volume (and, later, in the object storage
you configure). Back up the database regularly:

```bash
docker compose exec -T db pg_dump -U monkitrips -Fc monkitrips > monkitrips-$(date +%F).dump
```

Restore into a fresh volume with `pg_restore`. Test a restore at least once.

## Stopping and removing

```bash
docker compose down      # keeps the data volume
docker compose down -v   # also deletes all data
```

## Optional settings

Every variable the app understands is documented in
`apps/api/.env.example` (mail, object storage, AI provider, exchange rates).
Anything left out of `.env` keeps its safe default: mail goes to the log and
AI features stay off. Document uploads arrive in a later release and will
need S3-compatible object storage (`DRIVE_DISK=s3` with every `S3_*` value).

### Weather

Today shows the weather of the place the trip is at that day. Set
`WEATHER_PROVIDER=open-meteo` to read it from [Open-Meteo](https://open-meteo.com/)
(no key; `off`, the default, hides the row). The API sends only coordinates
rounded to two decimals and keeps each place's forecast for 30 minutes,
shared by every account, so a small instance stays far below the limits.

Open-Meteo's free API is for **non-commercial use** (fewer than 10 000 calls
a day, 5 000 an hour, 600 a minute); commercial use needs one of their
paid plans. The data is licensed under CC BY 4.0: the app credits it on
Today ("Weather data by Open-Meteo.com"); keep that line if you change the
screen.

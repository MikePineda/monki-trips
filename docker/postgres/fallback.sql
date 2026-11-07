-- For a system Postgres without Docker (run as a superuser, e.g.
-- `sudo -u postgres psql -f docker/postgres/fallback.sql`). Idempotent: safe
-- to run again. Same contract as init.sql: role `monkitrips` (LOGIN,
-- CREATEDB, password `monkitrips`) and the databases `monkitrips` and
-- `monkitrips_test`. Local throwaway credentials only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'monkitrips') THEN
    CREATE ROLE monkitrips LOGIN CREATEDB PASSWORD 'monkitrips';
  ELSE
    ALTER ROLE monkitrips LOGIN CREATEDB PASSWORD 'monkitrips';
  END IF;
END
$$;

-- CREATE DATABASE cannot run inside a DO block: \gexec runs it only when missing.
SELECT 'CREATE DATABASE monkitrips OWNER monkitrips'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'monkitrips')\gexec
SELECT 'CREATE DATABASE monkitrips_test OWNER monkitrips'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'monkitrips_test')\gexec

-- Runs once, when a compose Postgres volume is first initialised (the
-- image's entrypoint already created the `monkitrips` role and database from
-- POSTGRES_USER / POSTGRES_DB). Adds the database of the Japa suite
-- (apps/api/.env.test). Same contract as fallback.sql.
CREATE DATABASE monkitrips_test OWNER monkitrips;

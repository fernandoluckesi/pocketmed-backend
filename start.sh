#!/bin/sh

echo "=== PocketMed API Starting ==="
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "DB_HOST: ${DB_HOST:-not set}"
echo "MYSQLHOST: ${MYSQLHOST:-not set}"
echo "PORT: ${PORT:-3000}"

# Detect DB host from any supported env var name
DB_CONFIGURED=""
if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ]; then
  DB_CONFIGURED="yes"
fi
if [ -n "$MYSQL_HOST" ]; then
  DB_CONFIGURED="yes"
fi
if [ -n "$MYSQLHOST" ]; then
  DB_CONFIGURED="yes"
fi

if [ -n "$DB_CONFIGURED" ]; then
  echo "Running database migrations..."
  # Abort the boot if migrations fail, instead of starting anyway.
  #
  # This used to be `|| echo "WARNING: ... continuing..."`, which is how a
  # half-applied migration went unnoticed on 2026-10-19: the schema change
  # failed midway, the container started regardless, and the failure only
  # surfaced later as unrelated runtime errors. A container that refuses to
  # start is a visible, recoverable failure; one serving traffic against a
  # schema it doesn't match is neither.
  if ! node dist/database/run-migrations.js; then
    echo "FATAL: migrations failed — refusing to start the application."
    echo "The database may be in a partially migrated state. Inspect the error above before redeploying."
    exit 1
  fi
else
  echo "WARNING: No remote DB configured, skipping migrations"
fi

echo "Starting application..."
exec node dist/main

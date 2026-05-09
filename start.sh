#!/bin/sh
set -e

echo "=== PocketMed API Starting ==="
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "DB_HOST: ${DB_HOST:-not set}"
echo "PORT: ${PORT:-3000}"

# Run migrations only if DB is configured
if [ -n "$DB_HOST" ] || [ -n "$MYSQL_HOST" ]; then
  echo "Running database migrations..."
  node dist/database/run-migrations.js || {
    echo "WARNING: Migrations failed, continuing anyway..."
  }
else
  echo "WARNING: No DB_HOST configured, skipping migrations"
fi

echo "Starting application..."
exec node dist/main

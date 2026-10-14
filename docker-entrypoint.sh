#!/bin/sh
set -e

echo "Applying database migrations..."
node_modules/.bin/tsx scripts/migrate.ts

echo "Starting server..."
exec node build/index.js

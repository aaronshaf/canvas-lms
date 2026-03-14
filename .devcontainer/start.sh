#!/bin/bash
# start.sh — run by the web container on every start.
# Handles first-boot setup before Rails server starts.

set -e

cd /usr/src/app

# Install gems (fast on subsequent starts — bundle volume is cached)
BUNDLE_LOCKFILE=Gemfile.lock bundle install --jobs 4 --retry 3

# Copy config files from examples if not present
for f in amazon_s3 database delayed_jobs domain dynamic_settings external_migration file_store outgoing_mail security; do
  [ -f "config/${f}.yml" ] || cp "config/${f}.yml.example" "config/${f}.yml" 2>/dev/null || true
done

# Patch database.yml — write a minimal devcontainer override
# (simpler than patching the example file in place)
cat > config/database.yml <<YAML
development:
  adapter: postgresql
  encoding: utf8
  database: canvas_development
  host: ${CANVAS_DATABASE_HOST:-postgres}
  username: ${CANVAS_DATABASE_USERNAME:-postgres}
  password: ${POSTGRES_PASSWORD:-sekret}
  timeout: 5000

test:
  adapter: postgresql
  encoding: utf8
  database: canvas_test
  host: ${CANVAS_DATABASE_HOST:-postgres}
  username: ${CANVAS_DATABASE_USERNAME:-postgres}
  password: ${POSTGRES_PASSWORD:-sekret}
  timeout: 5000
YAML

# Use localhost as Canvas domain
if [ -f config/domain.yml ]; then
  sed -i 's/domain:.*/domain: localhost/' config/domain.yml
else
  printf 'development:\n  domain: localhost\n  ssl: false\n' > config/domain.yml
fi

# Remove stale PID file from previous run
rm -f tmp/pids/server.pid

exec bundle exec rails server -b 0.0.0.0 -p 3000

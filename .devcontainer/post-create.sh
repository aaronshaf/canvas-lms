#!/bin/bash
# post-create.sh — runs once after devcontainer is created
# Designed for a clean clone of the public instructure/canvas-lms repo.

set -euo pipefail

cd /usr/src/app

echo "==> Installing Ruby gems..."
# BUNDLE_LOCKFILE=Gemfile.lock skips bundler-multilock secondary lockfile sync,
# which fails before git-sourced gems are fetched on first boot.
BUNDLE_LOCKFILE=Gemfile.lock bundle install --jobs 4 --retry 3

echo "==> Installing JS packages..."
yarn install --frozen-lockfile

echo "==> Building JS packages..."
yarn run build:packages

echo "==> Building CSS assets..."
yarn run build:css

echo "==> Building webpack assets (one-time, no watcher)..."
RAILS_ENV=development yarn run webpack --bail

echo "==> Setting up config files (if not present)..."
for f in amazon_s3 delayed_jobs dynamic_settings external_migration file_store outgoing_mail security; do
  [ -f "config/${f}.yml" ] || cp "config/${f}.yml.example" "config/${f}.yml" 2>/dev/null || true
done

# Write database.yml pointing at the postgres container
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

# Write domain.yml to use localhost for devcontainer
cat > config/domain.yml <<YAML
development:
  domain: localhost
  ssl: false
YAML

echo "==> Waiting for postgres..."
until pg_isready -h postgres -U postgres; do sleep 1; done

echo "==> Creating and migrating database..."
BUNDLE_LOCKFILE=Gemfile.lock bundle exec rake db:create db:initial_setup \
  CANVAS_LMS_ADMIN_EMAIL=admin@example.com \
  CANVAS_LMS_ADMIN_PASSWORD=password \
  CANVAS_LMS_ACCOUNT_NAME=Canvas \
  CANVAS_LMS_STATS_COLLECTION=opt_out

echo "==> Generating default brand config files..."
BUNDLE_LOCKFILE=Gemfile.lock bundle exec rails runner "BrandableCSS.save_default_files!"

echo "==> Done! Canvas is available on port 3000."
echo "    Admin login: admin@example.com / password"

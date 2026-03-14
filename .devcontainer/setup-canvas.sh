#!/bin/bash
# setup-canvas.sh — full Canvas first-boot setup.
# Runs in the background after devcontainer creation (via post-create.sh).

set -euo pipefail

cd /usr/src/app

echo "==> [$(date)] Canvas setup started"

echo "==> Installing JS packages..."
yarn install --frozen-lockfile

echo "==> Building JS packages..."
yarn run build:packages

echo "==> Building CSS assets..."
yarn run build:css

echo "==> Building webpack assets (this takes a while)..."
RAILS_ENV=development yarn run webpack --bail

echo "==> Waiting for postgres..."
until pg_isready -h postgres -U postgres; do sleep 1; done

echo "==> Setting up database..."
BUNDLE_LOCKFILE=Gemfile.lock bundle exec rake db:create \
  CANVAS_LMS_ADMIN_EMAIL=admin@example.com \
  CANVAS_LMS_ADMIN_PASSWORD=password \
  CANVAS_LMS_ACCOUNT_NAME=Canvas \
  CANVAS_LMS_STATS_COLLECTION=opt_out

BUNDLE_LOCKFILE=Gemfile.lock bundle exec rake db:initial_setup \
  CANVAS_LMS_ADMIN_EMAIL=admin@example.com \
  CANVAS_LMS_ADMIN_PASSWORD=password \
  CANVAS_LMS_ACCOUNT_NAME=Canvas \
  CANVAS_LMS_STATS_COLLECTION=opt_out

echo "==> Generating brand config files..."
BUNDLE_LOCKFILE=Gemfile.lock bundle exec rails runner "BrandableCSS.save_default_files!"

echo ""
echo "==> [$(date)] Canvas setup complete!"
echo "    Admin login: admin@example.com / password"
echo ""

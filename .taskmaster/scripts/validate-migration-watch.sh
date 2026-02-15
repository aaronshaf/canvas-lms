#!/bin/bash

# Watch mode validation for TypeScript migrations
# Re-runs validation when files change

echo "🔍 Starting validation watch mode..."
echo "   Watching: ui/features/"
echo "   Press Ctrl+C to stop"
echo ""

# Check if fswatch is available
if ! command -v fswatch &> /dev/null; then
  echo "⚠️  fswatch not found. Install with: brew install fswatch"
  echo ""
  echo "Falling back to manual watch mode..."
  echo "Press Enter to run validation, Ctrl+C to quit"
  while true; do
    read -r
    echo ""
    ./taskmaster/scripts/validate-migration.sh
    echo ""
    echo "Press Enter to run again..."
  done
  exit 0
fi

# Use fswatch for automatic watching
fswatch -o ui/features/ | while read -r; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📝 File change detected, running validation..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ./taskmaster/scripts/validate-migration.sh || true
  echo ""
  echo "👀 Watching for changes..."
  echo ""
done

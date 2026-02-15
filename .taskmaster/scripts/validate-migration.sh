#!/bin/bash

# Validation Pipeline for TypeScript Migrations
# Runs all required checks: eslint, biome, tsc

set -e

echo "════════════════════════════════════════════════════════"
echo "  TypeScript Migration Validation Pipeline"
echo "════════════════════════════════════════════════════════"
echo ""

# Track overall success
OVERALL_SUCCESS=true

# Function to run a check
run_check() {
  local name="$1"
  local command="$2"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Running: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if eval "$command"; then
    echo "✅ $name passed"
    echo ""
    return 0
  else
    echo "❌ $name failed"
    echo ""
    OVERALL_SUCCESS=false
    return 1
  fi
}

# 1. ESLint
run_check "ESLint" "yarn lint" || true

# 2. Biome
if ! run_check "Biome Check" "yarn check:biome"; then
  echo "Attempting biome:fix..."
  yarn biome:fix
  if run_check "Biome Check (after fix)" "yarn check:biome"; then
    echo "✅ Biome fixed issues automatically"
    OVERALL_SUCCESS=true
  fi
fi

# 3. TypeScript
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Running: TypeScript Check (entire codebase)"
echo "This may take a minute..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if npx tsc --noEmit; then
  echo "✅ TypeScript passed"
  echo ""
else
  echo "❌ TypeScript check failed"
  echo ""
  OVERALL_SUCCESS=false
fi

# Summary
echo "════════════════════════════════════════════════════════"
if [ "$OVERALL_SUCCESS" = true ]; then
  echo "✅ All validations passed!"
  echo "════════════════════════════════════════════════════════"
  echo ""
  echo "Next steps:"
  echo "  1. Create PR in canvas-lms-readonly"
  echo "  2. Wait for CI to pass"
  echo "  3. Port to Gerrit worktree"
  exit 0
else
  echo "❌ Some validations failed"
  echo "════════════════════════════════════════════════════════"
  echo ""
  echo "Please fix the errors above and run again."
  exit 1
fi

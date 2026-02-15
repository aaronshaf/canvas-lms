#!/bin/bash

# Wait for ALL GitHub Actions CI checks to complete and pass
# Usage: wait-for-ci-complete.sh <pr-number> [timeout-minutes]

set -e

PR_NUMBER="$1"
TIMEOUT_MINUTES="${2:-30}"
REPO="instructure-internal/canvas-lms-readonly"

if [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 <pr-number> [timeout-minutes]"
  exit 1
fi

echo "🔍 Waiting for ALL CI checks to complete on PR #${PR_NUMBER}..."
echo "   Timeout: ${TIMEOUT_MINUTES} minutes"
echo ""

START_TIME=$(date +%s)
TIMEOUT_SECONDS=$((TIMEOUT_MINUTES * 60))

while true; do
  # Get all check statuses
  CHECKS=$(gh pr checks "$PR_NUMBER" --repo "$REPO" --json name,state,completedAt 2>&1)

  if echo "$CHECKS" | grep -q "no checks"; then
    echo "❌ No CI checks found for PR #${PR_NUMBER}"
    exit 1
  fi

  # Count total checks, pending, and failures
  TOTAL=$(echo "$CHECKS" | jq '. | length')
  PENDING=$(echo "$CHECKS" | jq '[.[] | select(.state == "IN_PROGRESS")] | length')
  FAILED=$(echo "$CHECKS" | jq '[.[] | select(.state == "FAILURE")] | length')
  SUCCESS=$(echo "$CHECKS" | jq '[.[] | select(.state == "SUCCESS")] | length')

  ELAPSED=$(($(date +%s) - START_TIME))
  ELAPSED_MIN=$((ELAPSED / 60))

  echo "⏱️  ${ELAPSED_MIN}m elapsed | Total: ${TOTAL} | ✅ Success: ${SUCCESS} | ⏳ Pending: ${PENDING} | ❌ Failed: ${FAILED}"

  # Check if all complete
  if [ "$PENDING" -eq 0 ]; then
    echo ""
    if [ "$FAILED" -eq 0 ]; then
      echo "✅ ALL CI CHECKS PASSED!"
      echo "   ${SUCCESS}/${TOTAL} checks successful"
      exit 0
    else
      echo "❌ CI CHECKS FAILED!"
      echo "   ${FAILED}/${TOTAL} checks failed"
      echo ""
      echo "Failed checks:"
      echo "$CHECKS" | jq -r '.[] | select(.state == "FAILURE") | "  - \(.name)"'
      exit 1
    fi
  fi

  # Check timeout
  if [ $ELAPSED -ge $TIMEOUT_SECONDS ]; then
    echo ""
    echo "⏱️  TIMEOUT after ${TIMEOUT_MINUTES} minutes"
    echo "   ${PENDING} checks still pending"
    exit 1
  fi

  # Wait before next check
  sleep 30
done

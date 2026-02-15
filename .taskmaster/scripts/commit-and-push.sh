#!/bin/bash
set -e

# Commit and push changes to Gerrit
# Usage: commit-and-push.sh <feature-name> <description>

if [ $# -lt 2 ]; then
  echo "Usage: commit-and-push.sh <feature-name> <description>"
  echo "Example: commit-and-push.sh canvas-career 'migrate to TypeScript'"
  exit 1
fi

FEATURE=$1
shift
DESC="$*"
BRANCH="ts-instui-${FEATURE}"
WORKTREE_BASE="${WORKTREE_BASE:-$HOME/inst/canvas-lms-worktrees}"
WORKTREE="$WORKTREE_BASE/$BRANCH"

echo "📝 Committing and pushing: $FEATURE"
echo "   Description: $DESC"
echo "   Worktree: $WORKTREE"

# Check if worktree exists
if [ ! -d "$WORKTREE" ]; then
  echo "❌ Error: Worktree not found at $WORKTREE"
  exit 1
fi

cd "$WORKTREE"

# Check for changes
if [ -z "$(git status --porcelain)" ]; then
  echo "❌ Error: No changes to commit"
  exit 1
fi

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Show what will be committed
echo ""
echo "📊 Changes to commit:"
git status --short

echo ""
read -p "Proceed with commit? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Create commit message
COMMIT_MSG="chore: ${DESC}

refs CFA-436
flag=none"

echo "📝 Creating commit..."
git commit -m "$COMMIT_MSG"

echo ""
echo "✅ Commit created!"
echo ""
git log -1 --oneline

echo ""
read -p "Push to Gerrit? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Skipped push. You can push later with: cd $WORKTREE && ger push"
  exit 0
fi

# Push to Gerrit
echo "🚀 Pushing to Gerrit..."
if ger push; then
  echo ""
  echo "✅ Successfully pushed to Gerrit!"
  echo ""
  echo "Next steps:"
  echo "  1. Find reviewers: cd ~/inst/canvas-lms && /find-reviewers"
  echo "  2. Update tracking: ./update-migration-status.mjs ui/features/$FEATURE in_progress_gerrit \\"
  echo "       --gerrit-id=<Change-Id> --gerrit-url=<URL>"
else
  echo ""
  echo "❌ Push failed. Check output above for errors."
  exit 1
fi

#!/bin/bash
set -e

# Clean up worktree after merge
# Usage: cleanup-worktree.sh <feature-name>

if [ $# -eq 0 ]; then
  echo "Usage: cleanup-worktree.sh <feature-name>"
  echo "Example: cleanup-worktree.sh canvas-career"
  exit 1
fi

FEATURE=$1
BRANCH="ts-instui-${FEATURE}"
WORKTREE_BASE="${WORKTREE_BASE:-$HOME/inst/canvas-lms-worktrees}"
CANVAS_LMS="${CANVAS_LMS:-$HOME/inst/canvas-lms}"
WORKTREE="$WORKTREE_BASE/$BRANCH"

echo "🧹 Cleaning up worktree for: $FEATURE"
echo "   Branch: $BRANCH"
echo "   Worktree: $WORKTREE"

# Check if worktree exists
if [ ! -d "$WORKTREE" ]; then
  echo "⚠️  Worktree not found at $WORKTREE"
  echo "   Nothing to clean up."
  exit 0
fi

cd "$CANVAS_LMS"

# Check if there are uncommitted changes
cd "$WORKTREE"
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Warning: Worktree has uncommitted changes!"
  echo ""
  git status --short
  echo ""
  read -p "Delete anyway? This will lose uncommitted changes! (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Return to main repo
cd "$CANVAS_LMS"

# Remove worktree
echo "🗑️  Removing worktree..."
git worktree remove "$WORKTREE" --force

# Delete branch
echo "🗑️  Deleting branch..."
if git branch -D "$BRANCH" 2>/dev/null; then
  echo "✅ Branch deleted: $BRANCH"
else
  echo "⚠️  Branch not found or already deleted"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next step:"
echo "  Update tracking: ./update-migration-status.mjs ui/features/$FEATURE completed"

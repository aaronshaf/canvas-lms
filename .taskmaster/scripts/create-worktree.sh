#!/bin/bash
set -e

# Create worktree for Gerrit migration
# Usage: create-worktree.sh <feature-name>

if [ $# -eq 0 ]; then
  echo "Usage: create-worktree.sh <feature-name>"
  echo "Example: create-worktree.sh canvas-career"
  exit 1
fi

FEATURE=$1
BRANCH="ts-instui-${FEATURE}"
WORKTREE_BASE="${WORKTREE_BASE:-$HOME/inst/canvas-lms-worktrees}"
CANVAS_LMS="${CANVAS_LMS:-$HOME/inst/canvas-lms}"

echo "🌳 Creating worktree for: $FEATURE"
echo "   Branch: $BRANCH"
echo "   Location: $WORKTREE_BASE/$BRANCH"

# Ensure base directory exists
mkdir -p "$WORKTREE_BASE"

# Navigate to canvas-lms repo
cd "$CANVAS_LMS"

# Create worktree using wt CLI
echo "📦 Creating worktree with wt..."
wt switch --create "$BRANCH" -y

# Copy .tool-versions for asdf
echo "📋 Copying .tool-versions..."
if [ -f "$CANVAS_LMS/.tool-versions" ]; then
  cp "$CANVAS_LMS/.tool-versions" "$WORKTREE_BASE/$BRANCH/"
  echo "✅ .tool-versions copied"
else
  echo "⚠️  Warning: .tool-versions not found in $CANVAS_LMS"
fi

echo ""
echo "✅ Worktree created successfully!"
echo "   Path: $WORKTREE_BASE/$BRANCH"
echo "   Branch: $BRANCH"
echo ""
echo "Next steps:"
echo "  1. Apply patch: ./apply-patch.sh $FEATURE"
echo "  2. Commit and push: ./commit-and-push.sh $FEATURE 'description'"

#!/bin/bash
set -e

# Apply patch from canvas-lms-readonly to Gerrit worktree
# Usage: apply-patch.sh <feature-name> [commit-ref]

if [ $# -eq 0 ]; then
  echo "Usage: apply-patch.sh <feature-name> [commit-ref]"
  echo "Example: apply-patch.sh canvas-career"
  echo "Example: apply-patch.sh canvas-career HEAD~1"
  exit 1
fi

FEATURE=$1
COMMIT_REF="${2:-HEAD}"
BRANCH="ts-instui-${FEATURE}"
WORKTREE_BASE="${WORKTREE_BASE:-$HOME/inst/canvas-lms-worktrees}"
READONLY_REPO="${READONLY_REPO:-$HOME/inst/canvas-lms-readonly}"
WORKTREE="$WORKTREE_BASE/$BRANCH"

echo "🔧 Applying patch for: $FEATURE"
echo "   From: $READONLY_REPO"
echo "   To: $WORKTREE"
echo "   Commit: $COMMIT_REF"

# Check if worktree exists
if [ ! -d "$WORKTREE" ]; then
  echo "❌ Error: Worktree not found at $WORKTREE"
  echo "   Run: ./create-worktree.sh $FEATURE"
  exit 1
fi

# Generate patch from canvas-lms-readonly
echo "📝 Generating patch..."
cd "$READONLY_REPO"
PATCH_FILE="/tmp/${FEATURE}-migration.patch"
git diff "${COMMIT_REF}^" "$COMMIT_REF" > "$PATCH_FILE"

echo "📦 Patch generated: $PATCH_FILE"
PATCH_SIZE=$(wc -l < "$PATCH_FILE")
echo "   Lines: $PATCH_SIZE"

if [ "$PATCH_SIZE" -eq 0 ]; then
  echo "❌ Error: Patch is empty!"
  echo "   No changes found in commit $COMMIT_REF"
  exit 1
fi

# Apply to worktree using 3-way merge
echo "🔀 Applying patch to worktree..."
cd "$WORKTREE"
if git apply -3 "$PATCH_FILE"; then
  echo "✅ Patch applied successfully!"
else
  echo ""
  echo "⚠️  Patch application had conflicts. Please resolve manually:"
  echo "   cd $WORKTREE"
  echo "   git status"
  echo "   # Fix conflicts, then:"
  echo "   git add -A"
  exit 1
fi

# Show status
echo ""
echo "📊 Status:"
git status --short

echo ""
echo "✅ Patch applied successfully!"
echo "   Worktree: $WORKTREE"
echo ""
echo "Next step:"
echo "  ./commit-and-push.sh $FEATURE 'description of changes'"

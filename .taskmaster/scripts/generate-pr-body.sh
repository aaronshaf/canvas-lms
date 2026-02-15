#!/bin/bash

# Generate PR body from template for TypeScript migration
# Usage: generate-pr-body.sh <feature-name> <file1> [file2] [file3] ...

if [ $# -lt 2 ]; then
  echo "Usage: generate-pr-body.sh <feature-name> <file1> [file2] [file3] ..."
  echo "Example: generate-pr-body.sh canvas_career index.jsx"
  echo "Example: generate-pr-body.sh dashboard DashboardHeader.jsx DashboardOptionsMenu.jsx"
  exit 1
fi

FEATURE=$1
shift
FILES=("$@")

# Count files and @ts-expect-error suppressions
FILE_COUNT=${#FILES[@]}
SUPPRESSION_COUNT=0

# Count suppressions in readonly repo
READONLY_REPO="${READONLY_REPO:-$HOME/inst/canvas-lms-readonly}"
FEATURE_PATH="$READONLY_REPO/ui/features/$FEATURE"

if [ -d "$FEATURE_PATH" ]; then
  for file in "${FILES[@]}"; do
    # Convert .jsx to .tsx, .js to .ts for counting
    TS_FILE="${file%.jsx}.tsx"
    TS_FILE="${TS_FILE%.js}.ts"
    FILE_PATH=$(find "$FEATURE_PATH" -name "$TS_FILE" 2>/dev/null | head -1)
    if [ -f "$FILE_PATH" ]; then
      COUNT=$(grep -c "@ts-expect-error" "$FILE_PATH" 2>/dev/null || echo 0)
      SUPPRESSION_COUNT=$((SUPPRESSION_COUNT + COUNT))
    fi
  done
fi

# Generate file list with checkboxes
FILE_LIST=""
for file in "${FILES[@]}"; do
  BASE="${file%.*}"
  EXT="${file##*.}"
  if [ "$EXT" = "jsx" ]; then
    NEW_EXT="tsx"
  elif [ "$EXT" = "js" ]; then
    NEW_EXT="ts"
  else
    NEW_EXT="$EXT"
  fi
  FILE_LIST="${FILE_LIST}- [x] \`${file}\` → \`${BASE}.${NEW_EXT}\`\n"
done

# Generate PR body
cat <<EOF
## TypeScript Migration: ${FEATURE}

### Summary
Migrate InstUI-importing files in \`ui/features/${FEATURE}\` from JavaScript to TypeScript.

### Files Changed
${FILE_LIST}
### Migration Details
- **Feature folder**: \`ui/features/${FEATURE}\`
- **Files migrated**: ${FILE_COUNT}
- **Type suppressions added**: ${SUPPRESSION_COUNT} \`@ts-expect-error\` comments

### Validation Checklist
- [x] \`yarn lint\` passes
- [x] \`yarn check:biome\` passes
- [x] \`npx tsc --noEmit\` passes (entire codebase)
- [x] No \`as\` type casts used (except \`as const\`)
- [x] No \`any\` types used
- [x] All \`@ts-expect-error\` comments include explanations

### Code Review
- [x] Codex implementation completed
- [x] Opus code review passed
- [ ] Refactoring based on Opus feedback (if any)

### Gerrit Tracking
- **Jira**: CFA-436
- **Gerrit Change-Id**: (to be added after push)
- **Gerrit URL**: (to be added after push)

### Notes
<!-- Any special considerations, known issues, or discussion points -->

---
*This PR will be closed automatically when pushed to Gerrit.*
EOF

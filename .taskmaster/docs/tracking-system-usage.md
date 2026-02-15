# Migration Tracking System Usage

## Overview

The tracking system monitors each feature folder migration through the complete workflow:
**GitHub PR → CI → Gerrit → Review → Merge**

## Status Values

- `pending` - Not started
- `in_progress_migration` - Converting files to TypeScript
- `in_progress_validation` - Running eslint/biome/tsc locally
- `in_progress_ci` - GitHub PR open, awaiting CI
- `in_progress_gerrit` - Pushed to Gerrit, in review
- `blocked` - CI failing or review feedback needed
- `completed` - Merged to Gerrit master

## Update Migration Status

```bash
# Mark folder as in progress (migration started)
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_migration

# Update with GitHub PR info
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_ci \
  --pr=123 \
  --pr-status=open \
  --ci-status=pending

# Update when CI passes
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_ci \
  --ci-status=passing

# Update with Gerrit info after push
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_gerrit \
  --gerrit-id=Iabc123def \
  --gerrit-url=https://gerrit.instructure.com/c/canvas-lms/+/567890 \
  --gerrit-status=pushed \
  --reviewers=alice@instructure.com,bob@instructure.com \
  --worktree=~/inst/canvas-lms-worktrees/canvas-career-ts \
  --branch=ts-instui-canvas-career

# Mark as blocked (with reason in separate notes)
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career blocked \
  --ci-status=failing

# Mark as completed
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career completed
```

## View Progress Report

```bash
# Text format (console output)
node .taskmaster/scripts/migration-progress-report.mjs

# Markdown format (for status updates)
node .taskmaster/scripts/migration-progress-report.mjs --markdown
```

## Typical Workflow

```bash
# 1. Start migration
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_migration

# 2. After local validation passes
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_validation

# 3. Create PR and mark as waiting for CI
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_ci \
  --pr=123

# 4. When CI passes and you push to Gerrit
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career in_progress_gerrit \
  --gerrit-id=Iabc123 \
  --gerrit-url=https://gerrit.instructure.com/c/canvas-lms/+/567890 \
  --worktree=~/inst/canvas-lms-worktrees/canvas-career-ts \
  --branch=ts-instui-canvas-career

# 5. When merged to master
./taskmaster/scripts/update-migration-status.mjs ui/features/canvas_career completed
```

## Tracked Fields

Each folder in the manifest tracks:

```json
{
  "path": "ui/features/canvas_career",
  "fileCount": 1,
  "files": ["index.jsx"],
  "status": "in_progress_gerrit",
  "githubPr": {
    "number": 123,
    "url": "https://github.com/instructure-internal/canvas-lms-readonly/pull/123",
    "status": "open",
    "ciStatus": "passing"
  },
  "gerrit": {
    "changeId": "Iabc123def",
    "url": "https://gerrit.instructure.com/c/canvas-lms/+/567890",
    "status": "in_review",
    "reviewers": ["alice@instructure.com", "bob@instructure.com"]
  },
  "worktree": {
    "path": "~/inst/canvas-lms-worktrees/canvas-career-ts",
    "branch": "ts-instui-canvas-career"
  },
  "migratedAt": "2026-02-15T04:30:00.000Z",
  "mergedAt": null
}
```

## Progress Report Output

The progress report shows:
- Overall completion percentage (folders and files)
- Status breakdown (how many in each status)
- Velocity metrics (avg days per folder, estimated completion)
- Blocked items with details
- In-progress items with current status
- Recent activity (last 5 merged folders)

Example output:

```
============================================
InstUI TypeScript Migration Progress
============================================

Overall: 12/57 folders (21.05%)
Files:   45/324 files (13.89%)

Status Breakdown:
├── Pending         40 folders
├── In Review        3 folders
├── CI Running       2 folders
└── Completed       12 folders

Velocity:
├── Avg time per folder: 2.3 days
└── Est. completion:     103 days

Blocked Items:
└── ui/features/foo (CI: failing)

In Progress:
├── ui/features/bar (CI Running)
└── ui/features/baz (In Review)

Recent Activity:
├── ui/features/canvas_career - Merged 2h ago
└── ui/features/dashboard - Merged 1d ago
```

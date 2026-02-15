#!/usr/bin/env node

/**
 * Migration Status Updater
 *
 * Updates the status and tracking information for a specific feature folder migration
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.resolve(__dirname, '../../')
const MANIFEST_FILE = path.join(PROJECT_ROOT, '.taskmaster/docs/instui-migration-manifest.json')

const VALID_STATUSES = [
  'pending',
  'in_progress_migration',
  'in_progress_validation',
  'in_progress_ci',
  'in_progress_gerrit',
  'blocked',
  'completed',
]

/**
 * Update migration status for a folder
 */
async function updateMigrationStatus(folderPath, updates) {
  // Read current manifest
  const manifestData = await fs.readFile(MANIFEST_FILE, 'utf-8')
  const manifest = JSON.parse(manifestData)

  // Find folder
  const folder = manifest.folders.find(f => f.path === folderPath)
  if (!folder) {
    throw new Error(`Folder not found: ${folderPath}`)
  }

  // Validate status if provided
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    throw new Error(`Invalid status: ${updates.status}. Valid: ${VALID_STATUSES.join(', ')}`)
  }

  // Initialize tracking fields if not present
  if (!folder.githubPr) {
    folder.githubPr = {
      number: null,
      url: null,
      status: null,
      ciStatus: null,
    }
  }
  if (!folder.gerrit) {
    folder.gerrit = {
      changeId: null,
      url: null,
      status: null,
      reviewers: [],
    }
  }
  if (!folder.worktree) {
    folder.worktree = {
      path: null,
      branch: null,
    }
  }

  // Apply updates
  if (updates.status) {
    folder.status = updates.status
  }

  // GitHub PR updates
  if (updates.githubPrNumber !== undefined) {
    folder.githubPr.number = updates.githubPrNumber
    if (updates.githubPrNumber) {
      folder.githubPr.url = `https://github.com/instructure-internal/canvas-lms-readonly/pull/${updates.githubPrNumber}`
    }
  }
  if (updates.githubPrStatus) folder.githubPr.status = updates.githubPrStatus
  if (updates.ciStatus) folder.githubPr.ciStatus = updates.ciStatus

  // Gerrit updates
  if (updates.gerritChangeId) folder.gerrit.changeId = updates.gerritChangeId
  if (updates.gerritUrl) folder.gerrit.url = updates.gerritUrl
  if (updates.gerritStatus) folder.gerrit.status = updates.gerritStatus
  if (updates.reviewers) folder.gerrit.reviewers = updates.reviewers

  // Worktree updates
  if (updates.worktreePath) folder.worktree.path = updates.worktreePath
  if (updates.worktreeBranch) folder.worktree.branch = updates.worktreeBranch

  // Timestamps
  if (updates.status === 'in_progress_migration' && !folder.migratedAt) {
    folder.migratedAt = new Date().toISOString()
  }
  if (updates.status === 'completed' && !folder.mergedAt) {
    folder.mergedAt = new Date().toISOString()
  }

  // Write back
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2))

  return folder
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error(`
Usage: update-migration-status.mjs <folder-path> <status> [options]

Arguments:
  folder-path     Path like ui/features/canvas_career
  status          One of: ${VALID_STATUSES.join(', ')}

Options:
  --pr=<number>              GitHub PR number
  --pr-status=<status>       GitHub PR status (open, ci_passing, ci_failed, closed)
  --ci-status=<status>       CI status (pending, passing, failing)
  --gerrit-id=<id>           Gerrit Change-Id
  --gerrit-url=<url>         Gerrit change URL
  --gerrit-status=<status>   Gerrit status (pushed, in_review, merged)
  --reviewers=<emails>       Comma-separated reviewer emails
  --worktree=<path>          Worktree path
  --branch=<name>            Branch name

Examples:
  # Mark as in progress
  ./update-migration-status.mjs ui/features/canvas_career in_progress_migration

  # Update with PR info
  ./update-migration-status.mjs ui/features/canvas_career in_progress_ci --pr=123

  # Update with Gerrit info
  ./update-migration-status.mjs ui/features/canvas_career in_progress_gerrit \\
    --gerrit-id=Iabc123 \\
    --gerrit-url=https://gerrit.instructure.com/c/canvas-lms/+/567890 \\
    --reviewers=alice@instructure.com,bob@instructure.com

  # Mark as complete
  ./update-migration-status.mjs ui/features/canvas_career completed
`)
    process.exit(1)
  }

  const folderPath = args[0]
  const status = args[1]
  const updates = {status}

  // Parse options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--pr=')) {
      updates.githubPrNumber = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--pr-status=')) {
      updates.githubPrStatus = arg.split('=')[1]
    } else if (arg.startsWith('--ci-status=')) {
      updates.ciStatus = arg.split('=')[1]
    } else if (arg.startsWith('--gerrit-id=')) {
      updates.gerritChangeId = arg.split('=')[1]
    } else if (arg.startsWith('--gerrit-url=')) {
      updates.gerritUrl = arg.split('=')[1]
    } else if (arg.startsWith('--gerrit-status=')) {
      updates.gerritStatus = arg.split('=')[1]
    } else if (arg.startsWith('--reviewers=')) {
      updates.reviewers = arg.split('=')[1].split(',')
    } else if (arg.startsWith('--worktree=')) {
      updates.worktreePath = arg.split('=')[1]
    } else if (arg.startsWith('--branch=')) {
      updates.worktreeBranch = arg.split('=')[1]
    }
  }

  try {
    const folder = await updateMigrationStatus(folderPath, updates)
    console.log(`✅ Updated ${folderPath}`)
    console.log(JSON.stringify(folder, null, 2))
  } catch (err) {
    console.error(`❌ Error: ${err.message}`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {updateMigrationStatus}

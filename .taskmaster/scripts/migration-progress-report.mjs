#!/usr/bin/env node

/**
 * Migration Progress Report Generator
 *
 * Generates a detailed progress report for the InstUI TypeScript migration
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PROJECT_ROOT = path.resolve(__dirname, '../../')
const MANIFEST_FILE = path.join(PROJECT_ROOT, '.taskmaster/docs/instui-migration-manifest.json')

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress_migration: 'Migrating',
  in_progress_validation: 'Validating',
  in_progress_ci: 'CI Running',
  in_progress_gerrit: 'In Review',
  blocked: 'Blocked',
  completed: 'Completed',
}

/**
 * Generate progress report
 */
async function generateProgressReport(options = {}) {
  const manifestData = await fs.readFile(MANIFEST_FILE, 'utf-8')
  const manifest = JSON.parse(manifestData)

  // Count by status
  const statusCounts = {}
  manifest.folders.forEach(folder => {
    const status = folder.status || 'pending'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  // Count files
  const completedFolders = manifest.folders.filter(f => f.status === 'completed')
  const completedFiles = completedFolders.reduce((sum, f) => sum + f.fileCount, 0)

  // Blocked items
  const blockedItems = manifest.folders.filter(f => f.status === 'blocked')

  // In progress items
  const inProgressItems = manifest.folders.filter(f =>
    f.status && f.status.startsWith('in_progress_')
  )

  // Calculate completion percentage
  const completedCount = statusCounts.completed || 0
  const completionPct = ((completedCount / manifest.totalFolders) * 100).toFixed(2)
  const fileCompletionPct = ((completedFiles / manifest.totalFiles) * 100).toFixed(2)

  // Calculate velocity (if we have timestamps)
  let velocity = null
  const completedWithTimestamps = completedFolders.filter(f => f.migratedAt && f.mergedAt)
  if (completedWithTimestamps.length > 0) {
    const totalDays = completedWithTimestamps.reduce((sum, f) => {
      const start = new Date(f.migratedAt)
      const end = new Date(f.mergedAt)
      const days = (end - start) / (1000 * 60 * 60 * 24)
      return sum + days
    }, 0)
    const avgDaysPerFolder = totalDays / completedWithTimestamps.length
    const remainingFolders = manifest.totalFolders - completedCount
    const estimatedDays = Math.ceil(remainingFolders * avgDaysPerFolder)
    velocity = {
      avgDaysPerFolder: avgDaysPerFolder.toFixed(2),
      estimatedDaysRemaining: estimatedDays,
    }
  }

  // Recent activity (last 5 completed)
  const recentActivity = completedFolders
    .filter(f => f.mergedAt)
    .sort((a, b) => new Date(b.mergedAt) - new Date(a.mergedAt))
    .slice(0, 5)
    .map(f => ({
      path: f.path,
      mergedAt: f.mergedAt,
      gerritUrl: f.gerrit?.url,
    }))

  const report = {
    manifest,
    summary: {
      totalFolders: manifest.totalFolders,
      totalFiles: manifest.totalFiles,
      completedFolders: completedCount,
      completedFiles,
      completionPct,
      fileCompletionPct,
    },
    statusBreakdown: statusCounts,
    blockedItems: blockedItems.map(f => ({
      path: f.path,
      fileCount: f.fileCount,
      githubPr: f.githubPr,
      gerrit: f.gerrit,
    })),
    inProgressItems: inProgressItems.map(f => ({
      path: f.path,
      fileCount: f.fileCount,
      status: f.status,
      githubPr: f.githubPr,
      gerrit: f.gerrit,
    })),
    velocity,
    recentActivity,
  }

  return report
}

/**
 * Format report as text
 */
function formatReportText(report) {
  const lines = []

  lines.push('============================================')
  lines.push('InstUI TypeScript Migration Progress')
  lines.push('============================================')
  lines.push('')

  lines.push(
    `Overall: ${report.summary.completedFolders}/${report.summary.totalFolders} folders (${report.summary.completionPct}%)`
  )
  lines.push(
    `Files:   ${report.summary.completedFiles}/${report.summary.totalFiles} files (${report.summary.fileCompletionPct}%)`
  )
  lines.push('')

  lines.push('Status Breakdown:')
  Object.entries(report.statusBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const label = STATUS_LABELS[status] || status
      const isLast =
        Object.keys(report.statusBreakdown).indexOf(status) ===
        Object.keys(report.statusBreakdown).length - 1
      const prefix = isLast ? '└──' : '├──'
      lines.push(`${prefix} ${label.padEnd(15)} ${count} folders`)
    })
  lines.push('')

  if (report.velocity) {
    lines.push('Velocity:')
    lines.push(`├── Avg time per folder: ${report.velocity.avgDaysPerFolder} days`)
    lines.push(`└── Est. completion:     ${report.velocity.estimatedDaysRemaining} days`)
    lines.push('')
  }

  if (report.blockedItems.length > 0) {
    lines.push('Blocked Items:')
    report.blockedItems.forEach((item, idx) => {
      const isLast = idx === report.blockedItems.length - 1
      const prefix = isLast ? '└──' : '├──'
      const prStatus = item.githubPr?.ciStatus
        ? `(CI: ${item.githubPr.ciStatus})`
        : '(No CI info)'
      lines.push(`${prefix} ${item.path} ${prStatus}`)
    })
    lines.push('')
  }

  if (report.inProgressItems.length > 0) {
    lines.push('In Progress:')
    report.inProgressItems.forEach((item, idx) => {
      const isLast = idx === report.inProgressItems.length - 1
      const prefix = isLast ? '└──' : '├──'
      const statusLabel = STATUS_LABELS[item.status] || item.status
      lines.push(`${prefix} ${item.path} (${statusLabel})`)
    })
    lines.push('')
  }

  if (report.recentActivity.length > 0) {
    lines.push('Recent Activity:')
    report.recentActivity.forEach((item, idx) => {
      const isLast = idx === report.recentActivity.length - 1
      const prefix = isLast ? '└──' : '├──'
      const timeAgo = getTimeAgo(new Date(item.mergedAt))
      lines.push(`${prefix} ${item.path} - Merged ${timeAgo}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format report as markdown
 */
function formatReportMarkdown(report) {
  const lines = []

  lines.push('# InstUI TypeScript Migration Progress')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(
    `- **Folders:** ${report.summary.completedFolders}/${report.summary.totalFolders} (${report.summary.completionPct}%)`
  )
  lines.push(
    `- **Files:** ${report.summary.completedFiles}/${report.summary.totalFiles} (${report.summary.fileCompletionPct}%)`
  )
  lines.push('')

  if (report.velocity) {
    lines.push('## Velocity')
    lines.push('')
    lines.push(`- **Avg time per folder:** ${report.velocity.avgDaysPerFolder} days`)
    lines.push(`- **Est. completion:** ${report.velocity.estimatedDaysRemaining} days`)
    lines.push('')
  }

  lines.push('## Status Breakdown')
  lines.push('')
  lines.push('| Status | Count |')
  lines.push('|--------|-------|')
  Object.entries(report.statusBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const label = STATUS_LABELS[status] || status
      lines.push(`| ${label} | ${count} |`)
    })
  lines.push('')

  if (report.blockedItems.length > 0) {
    lines.push('## Blocked Items')
    lines.push('')
    report.blockedItems.forEach(item => {
      const prLink = item.githubPr?.url ? `[PR #${item.githubPr.number}](${item.githubPr.url})` : 'No PR'
      lines.push(`- **${item.path}** - ${prLink}`)
    })
    lines.push('')
  }

  if (report.inProgressItems.length > 0) {
    lines.push('## In Progress')
    lines.push('')
    report.inProgressItems.forEach(item => {
      const statusLabel = STATUS_LABELS[item.status] || item.status
      const prLink = item.githubPr?.url ? `[PR #${item.githubPr.number}](${item.githubPr.url})` : ''
      const gerritLink = item.gerrit?.url ? `[Gerrit](${item.gerrit.url})` : ''
      const links = [prLink, gerritLink].filter(Boolean).join(' | ')
      lines.push(`- **${item.path}** - ${statusLabel} ${links ? `(${links})` : ''}`)
    })
    lines.push('')
  }

  if (report.recentActivity.length > 0) {
    lines.push('## Recent Activity')
    lines.push('')
    report.recentActivity.forEach(item => {
      const timeAgo = getTimeAgo(new Date(item.mergedAt))
      const gerritLink = item.gerritUrl ? `[Gerrit](${item.gerritUrl})` : ''
      lines.push(`- **${item.path}** - Merged ${timeAgo} ${gerritLink}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(date) {
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toISOString().split('T')[0]
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2)
  const format = args.includes('--markdown') ? 'markdown' : 'text'

  try {
    const report = await generateProgressReport()

    if (format === 'markdown') {
      console.log(formatReportMarkdown(report))
    } else {
      console.log(formatReportText(report))
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {generateProgressReport, formatReportText, formatReportMarkdown}

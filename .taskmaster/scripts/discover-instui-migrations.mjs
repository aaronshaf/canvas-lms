#!/usr/bin/env node

/**
 * InstUI Migration Discovery Script
 *
 * Scans ui/features/* for JS/JSX files that import @instructure/ui-* packages
 * Excludes test files and outputs a sorted manifest (smallest folders first)
 */

import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Project root (2 levels up from .taskmaster/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '../../')
const FEATURES_DIR = path.join(PROJECT_ROOT, 'ui/features')
const OUTPUT_FILE = path.join(PROJECT_ROOT, '.taskmaster/docs/instui-migration-manifest.json')

// InstUI packages to detect
const INSTUI_PACKAGES = [
  '@instructure/ui-a11y-content',
  '@instructure/ui-alerts',
  '@instructure/ui-buttons',
  '@instructure/ui-color-utils',
  '@instructure/ui-dom-utils',
  '@instructure/ui-drilldown',
  '@instructure/ui-grid',
  '@instructure/ui-icons',
  '@instructure/ui-menu',
  '@instructure/ui-responsive',
  '@instructure/ui-simple-select',
  '@instructure/ui-spinner',
  '@instructure/ui-text',
  '@instructure/ui-text-input',
  '@instructure/ui-truncate-text',
  '@instructure/ui-view',
]

// Test file patterns to exclude
const TEST_PATTERNS = [
  /__tests__/,
  /\.test\.(js|jsx)$/,
  /\.spec\.(js|jsx)$/,
  /-test\.(js|jsx)$/,
  /-spec\.(js|jsx)$/,
]

/**
 * Check if a file path is a test file
 */
function isTestFile(filePath) {
  return TEST_PATTERNS.some(pattern => pattern.test(filePath))
}

/**
 * Check if file content imports any InstUI packages
 */
function hasInstUIImports(content) {
  return INSTUI_PACKAGES.some(pkg => {
    // Match import statements
    const importRegex = new RegExp(`from\\s+['"]${pkg.replace('/', '\\/')}`, 'g')
    const requireRegex = new RegExp(`require\\(['"]${pkg.replace('/', '\\/')}`, 'g')
    return importRegex.test(content) || requireRegex.test(content)
  })
}

/**
 * Recursively find all JS/JSX files in a directory
 */
async function findJSFiles(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, {withFileTypes: true})
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }
      const subFiles = await findJSFiles(fullPath, baseDir)
      files.push(...subFiles)
    } else if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
      const relativePath = path.relative(baseDir, fullPath)

      // Skip test files
      if (!isTestFile(relativePath)) {
        files.push(relativePath)
      }
    }
  }

  return files
}

/**
 * Scan a feature folder for InstUI imports
 */
async function scanFeatureFolder(featureName) {
  const featurePath = path.join(FEATURES_DIR, featureName)
  const files = await findJSFiles(featurePath, featurePath)

  const instUIFiles = []

  for (const file of files) {
    const fullPath = path.join(featurePath, file)
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      if (hasInstUIImports(content)) {
        instUIFiles.push(file)
      }
    } catch (err) {
      console.error(`Error reading ${fullPath}:`, err.message)
    }
  }

  return instUIFiles
}

/**
 * Main discovery function
 */
async function discoverMigrations() {
  console.log('🔍 Scanning ui/features/ for InstUI imports...\n')

  // Get all feature directories
  const featureDirs = await fs.readdir(FEATURES_DIR, {withFileTypes: true})
  const folders = []

  for (const dir of featureDirs) {
    if (!dir.isDirectory() || dir.name.startsWith('.')) {
      continue
    }

    console.log(`  Scanning ui/features/${dir.name}...`)
    const files = await scanFeatureFolder(dir.name)

    if (files.length > 0) {
      folders.push({
        path: `ui/features/${dir.name}`,
        fileCount: files.length,
        files: files.sort(), // Alphabetical sort
        status: 'pending',
      })
    }
  }

  // Sort by file count (smallest first)
  folders.sort((a, b) => a.fileCount - b.fileCount)

  const totalFiles = folders.reduce((sum, f) => sum + f.fileCount, 0)

  const manifest = {
    generated: new Date().toISOString().split('T')[0],
    totalFolders: folders.length,
    totalFiles,
    folders,
  }

  // Write to output file
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2))

  console.log('\n✅ Discovery complete!')
  console.log(`   Total folders with InstUI imports: ${folders.length}`)
  console.log(`   Total files to migrate: ${totalFiles}`)
  console.log(`\n📄 Manifest saved to: ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`)

  // Show first 10 smallest folders
  console.log('\n📊 Smallest folders (top 10):')
  folders.slice(0, 10).forEach((folder, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2)}. ${folder.path.padEnd(50)} (${folder.fileCount} file${folder.fileCount > 1 ? 's' : ''})`)
  })

  return manifest
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  discoverMigrations().catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
}

export {discoverMigrations}

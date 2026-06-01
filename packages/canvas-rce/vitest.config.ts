/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference types="vitest" />

import {defineConfig} from 'vitest/config'
import {transformWithEsbuild} from 'vite'
import {resolve, dirname, join} from 'path'
import {existsSync, statSync} from 'fs'

const root = resolve(__dirname)

// Plugin to handle JSX in .js test files (some canvas-rce tests use .js with JSX)
const jsxInJsPlugin = {
  name: 'jsx-in-js',
  async transform(code: string, id: string) {
    if (!id.endsWith('.js')) return null
    if (!id.includes('__tests__') && !id.includes('__mocks__')) return null
    return transformWithEsbuild(code, id, {loader: 'jsx', jsx: 'automatic'})
  },
}

// Plugin to resolve bare directory imports (e.g. './ClosedCaptionCreator' -> './ClosedCaptionCreator/index.js')
// canvas-media uses directory imports which aren't valid in strict ESM
const directoryIndexPlugin = {
  name: 'directory-index-resolver',
  enforce: 'pre' as const,
  resolveId(source: string, importer: string | undefined) {
    if (!importer) return null
    if (!source.startsWith('.')) return null
    const dir = resolve(dirname(importer), source)
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      const indexJs = join(dir, 'index.js')
      if (existsSync(indexJs)) return indexJs
    }
    return null
  },
}

// Plugin to handle CSS/Less imports as empty modules
const cssPlugin = {
  name: 'css-loader',
  transform(_code: string, id: string) {
    if (id.endsWith('.css') || id.endsWith('.less')) {
      return {code: 'export default {}', map: null}
    }
  },
}

// Plugin to hoist jest.mock() calls as vi.mock() for Vitest hoisting compatibility.
// Vitest only hoists vi.mock() calls; jest.mock() calls in test files are left as-is.
// This plugin adds a corresponding vi.mock() for each jest.mock() found.
const jestMockHoistPlugin = {
  name: 'jest-mock-hoist',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('__tests__') || !id.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
      return null
    }

    const jestMockRegex = /jest\.mock\(\s*(['"`])([^'"`]+)\1/g
    const mocks: string[] = []
    let match

    while ((match = jestMockRegex.exec(code)) !== null) {
      mocks.push(`vi.mock(${match[1]}${match[2]}${match[1]})`)
    }

    if (mocks.length === 0) return null

    const existingViMocks = new Set<string>()
    const viMockRegex = /vi\.mock\(\s*(['"`])([^'"`]+)\1/g
    while ((match = viMockRegex.exec(code)) !== null) {
      existingViMocks.add(match[2])
    }

    const newMocks = mocks.filter(m => {
      const path = m.match(/vi\.mock\(\s*(['"`])([^'"`]+)\1/)?.[2]
      return path && !existingViMocks.has(path)
    })

    if (newMocks.length === 0) return null

    const viMockBlock = `// Auto-generated vi.mock() calls for Vitest hoisting\n${newMocks.join('\n')}\n\n`
    let insertIndex = 0
    const leadingCommentMatch = code.match(/^(\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*\s*)/)
    if (leadingCommentMatch) insertIndex = leadingCommentMatch[0].length

    return {code: code.slice(0, insertIndex) + viMockBlock + code.slice(insertIndex), map: null}
  },
}

// Vitest 4.x surfaces module loads that resolve *after* a test file's jsdom
// environment has been torn down (EnvironmentTeardownError). In this package they
// arrive as Uncaught Exceptions via React's synchronous lazy/Suspense render path,
// NOT as unhandled rejections — so the old `dangerouslyIgnoreUnhandledErrors: true`
// did not actually suppress them (it only clears the exit code for *rejections*,
// while still printing every error). That printed noise reads like a real failure
// and makes on-call debugging harder when a genuine error lands on the same node.
//
// Instead we drop the error from the run's error set at the source: this hook is
// invoked for both uncaught exceptions and unhandled rejections, and returning
// false removes the error so it is neither counted nor printed. The companion
// `/The above error occurred in/` filter in vitest/vitest-setup-framework.ts stops
// the strict console.error handler from re-raising React's teardown wrapper.
// Everything that is NOT a teardown error still fails the run as before.
let environmentTeardownErrorCount = 0
function onUnhandledError(error: (Error & {type?: string}) | undefined): boolean | void {
  const name = error?.name
  const message = error?.message ?? String(error)
  const isTeardown = name === 'EnvironmentTeardownError' || /EnvironmentTeardownError/.test(message)
  if (isTeardown) {
    environmentTeardownErrorCount++
    // eslint-disable-next-line no-console
    console.warn(
      `[vitest] ignoring EnvironmentTeardownError #${environmentTeardownErrorCount} ` +
        `(module load resolved after env teardown): ${message.split('\n')[0]}`,
    )
    return false
  }
}

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    testTimeout: 15000,
    environment: 'jsdom',
    globals: true,
    onUnhandledError,
    setupFiles: [
      resolve(root, 'vitest/vitest-jest-compat.ts'),
      resolve(root, 'vitest/vitest-setup.ts'),
      resolve(root, 'vitest/vitest-setup-framework.ts'),
    ],
    include: ['src/**/__tests__/**/?(*.)+(spec|test).[jt]s?(x)'],
    exclude: ['**/node_modules/**', 'es/**', 'canvas/**'],
    reporters: [
      'default',
      [
        'junit',
        {
          suiteName: 'Canvas RCE Vitest Tests',
          outputFile: process.env.TEST_RESULT_OUTPUT_DIR
            ? `${process.env.TEST_RESULT_OUTPUT_DIR}/canvas-rce-vitest.xml`
            : './coverage/canvas-rce-vitest.xml',
        },
      ],
    ],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
        customExportConditions: [''],
        pretendToBeVisual: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: ['**/__tests__/**', '**/__mocks__/**'],
    },
    pool: 'forks',
    isolate: true,
    server: {
      deps: {
        inline: ['@instructure/canvas-media'],
      },
    },
  },
  resolve: {
    alias: [
      {
        find: '@instructure/platform-sanitize',
        replacement: resolve(
          root,
          '../../node_modules/@instructure/platform-sanitize/dist/index.js',
        ),
      },
      {
        find: '@tinymce/tinymce-react',
        replacement: resolve(root, 'src/rce/__mocks__/tinymceReact.jsx'),
      },
      {
        find: 'crypto-es',
        replacement: resolve(root, 'src/rce/__mocks__/_mockCryptoEs.ts'),
      },
      {
        find: '@instructure/studio-player',
        replacement: resolve(root, '__mocks__/@instructure/studio-player/_mockStudioPlayer.js'),
      },
      {
        find: '@instructure/ui-media-player',
        replacement: resolve(root, '__mocks__/@instructure/ui-media-player/_mockUiMediaPlayer.js'),
      },
    ],
  },
  plugins: [directoryIndexPlugin, jsxInJsPlugin, jestMockHoistPlugin, cssPlugin],
})

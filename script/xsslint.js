/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

const XSSLint = require('xsslint')
const Linter = require('xsslint/linter')
const globby = require('gglobby')
const fs = require('fs')
const path = require('path')
const glob = require('glob')
const babylon = require('@babel/parser')
const traverse = require('@babel/traverse').default

XSSLint.configure({
  // `searchParams` is whitelisted globally because it is exclusively the URL
  // Web API property — `urlObj.searchParams.append(name, value)` builds a
  // query string, never injects HTML, and the name does not collide with any
  // jQuery-receiver convention in this repo.
  'xssable.receiver.whitelist': ['formData', 'searchParams'],
  'jqueryObject.identifier': [/^\$/],
  'jqueryObject.property': [/^\$/],
  'safeString.identifier': [/(_html|Html|View|Template)$/, 'html', 'id'],
  'safeString.function': [
    'h',
    'raw',
    'htmlEscape',
    'sanitizeHTML',
    'template',
    /(Template|View|Dialog)$/,
  ],
  'safeString.property': ['template', 'id', 'height', 'width', /_id$/],
  'safeString.method': [
    'escapeContent',
    'sanitizeHTML',
    'template',
    /(Template|Html)$/,
    'toISOString',
    'friendlyDatetime',
    /^(date|(date)?time)String$/,
  ],
})

// `I18n.t(..., {wrapper|wrappers: ...})` returns an html-safe string — the
// wrapped content gets auto-escaped, only the wrapper template stays raw.
const isI18nTWithWrappers = node => {
  if (node.type !== 'CallExpression') return false
  const c = node.callee
  if (c.type !== 'MemberExpression') return false
  if (c.object.type !== 'Identifier' || c.object.name !== 'I18n') return false
  if (c.property.type !== 'Identifier') return false
  if (c.property.name !== 't' && c.property.name !== 'translate') return false
  const last = node.arguments[node.arguments.length - 1]
  return (
    last &&
    last.type === 'ObjectExpression' &&
    last.properties.some(p => p.key.name === 'wrapper' || p.key.name === 'wrappers')
  )
}

const origIsSafeString = Linter.prototype.isSafeString
Linter.prototype.isSafeString = function (node) {
  if (!node) return false
  switch (node.type) {
    // Unwrap TypeScript type-cast nodes (`expr as T`, `<T>expr`, `expr satisfies T`,
    // `expr!`). These are erased at runtime, so safety is determined by the
    // inner expression.
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return this.isSafeString(node.expression)
    // Optional chaining (`a?.b`, `a?.()`) — re-check as the non-optional
    // equivalent so our safeString.property / safeString.method directives
    // still apply.
    case 'OptionalMemberExpression':
      return this.isSafeString({...node, type: 'MemberExpression'})
    case 'OptionalCallExpression':
      return this.isSafeString({...node, type: 'CallExpression'})
    // Computed member access (`map[key]`) where the receiver is declared safe
    // via `safeString.identifier`. Lets lookup tables silence template-literal
    // warnings without per-callsite identifier extraction.
    case 'MemberExpression':
      if (node.computed && this.identifierMatches(node.object, 'safeString')) return true
      break
  }
  return origIsSafeString.call(this, node) || isI18nTWithWrappers(node)
}

function getFilesAndDirs(root, files = [], dirs = []) {
  root = root === '.' ? '' : `${root}/`

  const entries = fs.readdirSync(root || '.')
  entries.forEach(entry => {
    const stats = fs.lstatSync(root + entry)
    if (stats.isSymbolicLink()) {
      // do nothing
    } else if (stats.isDirectory()) {
      dirs.push(`${root + entry}/`)
      getFilesAndDirs(root + entry, files, dirs)
    } else {
      files.push(root + entry)
    }
  })

  return [files, dirs]
}

function methodDescription(method) {
  switch (method) {
    case '+':
      return 'HTML string concatenation'
    case '`':
      return 'HTML template literal'
    case 'dangerouslySetInnerHTML':
      return '`dangerouslySetInnerHTML` without sanitizeHTML'
    default:
      return `argument to \`${method}\``
  }
}

// Babylon plugin selection. JSX and TypeScript generics share the `<...>`
// syntax space, so .ts files cannot have the jsx plugin enabled (arrow
// generics like `<T>(x: T) => x` would fail to parse), and .js / .jsx files
// cannot have the typescript plugin enabled (TS-only syntax doesn't occur
// there and enabling it changes some parse decisions).
const COMMON_PLUGINS = [
  'classProperties',
  'objectRestSpread',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
  'numericSeparator',
  'exportDefaultFrom',
]

const pluginsFor = file => {
  const ext = path.extname(file)
  return [
    ...(ext !== '.ts' ? ['jsx'] : []),
    ...(ext === '.ts' || ext === '.tsx' ? ['typescript'] : []),
    ...COMMON_PLUGINS,
  ]
}

// Adds local variables initialized from `new URLSearchParams|URL|FormData(...)`
// to the linter's `xssable.receiver.whitelist`. These are Web APIs whose
// `.append()` / `.set()` / etc. build query strings, never HTML — auto-
// recognizing them avoids ~25 redundant per-callsite directives in URL-API
// helper code. Limited to constructor-form initialization (no flow analysis,
// no aliasing) so the rule is auditable: an identifier is safe iff its
// declaration site uses one of these constructors.
function whitelistUrlApiReceivers(ast, linter) {
  const SAFE_NEW_CTORS = new Set(['URLSearchParams', 'URL', 'FormData'])
  const idents = new Set()
  traverse(ast, {
    VariableDeclarator(p) {
      const {id, init} = p.node
      if (!id || id.type !== 'Identifier' || !init) return
      if (
        init.type === 'NewExpression' &&
        init.callee &&
        init.callee.type === 'Identifier' &&
        SAFE_NEW_CTORS.has(init.callee.name)
      ) {
        idents.add(id.name)
      }
    },
  })
  if (idents.size) {
    linter.config.set('xssable.receiver.whitelist', [...idents].join(' '))
  }
}

// Walks JSX attributes to flag `dangerouslySetInnerHTML={{__html: x}}` where
// `x` isn't a registered safe wrapper (e.g. sanitizeHTML, htmlEscape, raw,
// I18n.t with wrappers). Pairs with CFA-855's lint rule on the source side.
function findDangerouslySetInnerHTMLWarnings(ast, linter) {
  const warnings = []
  traverse(ast, {
    JSXAttribute(path) {
      const {node} = path
      const name = node.name
      if (!name) return
      const attrName = name.type === 'JSXNamespacedName' ? name.name.name : name.name
      if (attrName !== 'dangerouslySetInnerHTML') return
      if (!node.value || node.value.type !== 'JSXExpressionContainer') return

      const expr = node.value.expression
      if (!expr || expr.type !== 'ObjectExpression') return

      const htmlProp = expr.properties.find(
        p =>
          (p.type === 'ObjectProperty' || p.type === 'Property') &&
          p.key &&
          ((p.key.type === 'Identifier' && p.key.name === '__html') ||
            (p.key.type === 'StringLiteral' && p.key.value === '__html')),
      )
      if (!htmlProp) return
      // `isSafeExpression` understands conditionals/logicals/arrays in addition
      // to the safe-string set, matching how `processCall` evaluates arguments.
      if (linter.isSafeExpression('dangerouslySetInnerHTML', htmlProp.value)) return

      warnings.push({
        line: (node.loc || expr.loc).start.line,
        method: 'dangerouslySetInnerHTML',
      })
    },
  })
  return warnings
}

// Pre-existing sinks pending cleanup. Findings in these files are reported
// as `[BASELINED]` and don't fail CI; new findings in other files do.
// When a baselined file becomes clean, the script fails so the entry can be
// removed — keeps the baseline shrinking, never growing.
const BASELINE_PATH = path.join(__dirname, 'xsslint-baseline.json')
const baseline = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
  : {exemptFiles: []}
const exemptFiles = new Set(baseline.exemptFiles || [])
const exemptHits = new Set()

const cwd = process.cwd()
let warningCount = 0
let baselinedCount = 0
let parsedFileCount = 0
let parseErrorCount = 0

const FRONTEND_EXTS = ['js', 'jsx', 'ts', 'tsx']
const FRONTEND_GLOBS = FRONTEND_EXTS.map(ext => `*.${ext}`)
const TEST_IGNORES = FRONTEND_EXTS.map(ext => `**/__tests__/**/*.${ext}`)

const allPaths = [
  {
    paths: ['ui'].concat(glob.sync('gems/plugins/*/app/jsx')),
    globs: FRONTEND_GLOBS,
  },
  {
    paths: glob.sync('gems/plugins/*/public/javascripts'),
    defaultIgnores: TEST_IGNORES.concat(['/compiled', '/jst', '/vendor']),
    globs: FRONTEND_GLOBS,
  },
]

allPaths.forEach(({paths, globs, defaultIgnores = TEST_IGNORES, transform}) => {
  paths.forEach(p => {
    process.chdir(p)
    const ignores = defaultIgnores.concat(
      fs.existsSync('.xssignore')
        ? fs
            .readFileSync('.xssignore')
            .toString()
            .trim()
            .split(/\r?\n|\r/)
        : [],
    )
    let candidates = getFilesAndDirs('.')
    candidates = {files: candidates[0], dirs: candidates[1]}

    let files = globby.select(globs, candidates).reject(ignores).files
    // .d.ts files are type-only declarations with no runtime sinks; skip them.
    files = files.filter(f => !f.endsWith('.d.ts'))

    parsedFileCount += files.length

    files.forEach(file => {
      let source = fs.readFileSync(file).toString()
      if (transform) source = transform(source)
      let ast
      try {
        ast = babylon.parse(source, {
          plugins: pluginsFor(file),
          sourceType: 'module',
          allowReturnOutsideFunction: true,
        })
      } catch (e) {
        // Don't let a syntax error silently skip a file — the linter never
        // inspected it, so a real finding could hide behind the parse failure.
        // Track it, exclude it from the parsed-file total, and fail CI below.
        parseErrorCount += 1
        parsedFileCount -= 1
        console.error(`${p}/${file}: parse error (file not linted): ${e.message}`)
        return
      }

      const linter = new Linter(ast, XSSLint.config)
      whitelistUrlApiReceivers(ast, linter)
      const warnings = linter.run()
      const jsxWarnings = findDangerouslySetInnerHTMLWarnings(ast, linter)

      const fullPath = `${p}/${file}`
      const isBaselined = exemptFiles.has(fullPath)
      warnings.concat(jsxWarnings).forEach(({line, method}) => {
        if (isBaselined) {
          exemptHits.add(fullPath)
          baselinedCount += 1
          console.warn(`[BASELINED] ${fullPath}:${line}: ${methodDescription(method)}`)
        } else {
          warningCount += 1
          console.error(`${fullPath}:${line}: possibly XSS-able ${methodDescription(method)}`)
        }
      })
    })

    process.chdir(cwd)
  })
})

console.log(`Parsed ${parsedFileCount} files`)
if (baselinedCount) {
  console.log(`${baselinedCount} pre-existing finding(s) suppressed via xsslint-baseline.json`)
}

// Only flag baseline entries as stale when the file is actually present in
// this run. Private plugins listed in baseline may be absent locally; skip
// them to avoid false-failing developer machines without a full plugin
// checkout.
const staleExempt = [...exemptFiles].filter(f => fs.existsSync(f) && !exemptHits.has(f))
if (staleExempt.length) {
  console.error(
    `\u{1b}[31m${staleExempt.length} baselined file(s) have no findings — remove from script/xsslint-baseline.json:\u{1b}[0m`,
  )
  staleExempt.forEach(f => console.error(`  ${f}`))
  process.exit(1)
}

if (parseErrorCount) {
  console.error(
    `\u{1b}[31m${parseErrorCount} file(s) failed to parse — fix the syntax error or extend pluginsFor()\u{1b}[0m`,
  )
  process.exit(1)
}

if (warningCount) {
  console.error(`\u{1b}[31mFound ${warningCount} potential vulnerabilities\u{1b}[0m`)
  process.exit(1)
} else {
  console.log('No problems found!')
}

/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

'use strict'

const fs = require('fs')
const path = require('path')
const babylon = require('@babel/parser')
const traverse = require('@babel/traverse').default
const XSSLint = require('xsslint')
const Linter = require('xsslint/linter')

XSSLint.configure({
  // `searchParams` is whitelisted globally because it is exclusively the URL
  // Web API property: `urlObj.searchParams.append(name, value)` builds a query
  // string, never injects HTML.
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
    // DOM constructors produce safe nodes, never raw HTML strings.
    'createElement',
    'createTextNode',
  ],
})

function isI18nTWithWrappers(node) {
  if (node.type !== 'CallExpression') return false
  const c = node.callee
  if (c.type !== 'MemberExpression') return false
  if (c.object.type !== 'Identifier' || c.object.name !== 'I18n') return false
  if (c.property.type !== 'Identifier') return false
  if (c.property.name !== 't' && c.property.name !== 'translate') return false
  const last = node.arguments[node.arguments.length - 1]
  if (!last || last.type !== 'ObjectExpression') return false
  return last.properties.some(p => {
    if (!p || (p.type !== 'ObjectProperty' && p.type !== 'Property') || !p.key) return false
    if (p.key.type === 'Identifier') return p.key.name === 'wrapper' || p.key.name === 'wrappers'
    if (p.key.type === 'StringLiteral')
      return p.key.value === 'wrapper' || p.key.value === 'wrappers'
    return false
  })
}

const PATCHED = Symbol.for('canvas.xsslint.isSafeString.patch')

function patchLinter() {
  if (Linter.prototype[PATCHED]) return
  const origIsSafeString = Linter.prototype.isSafeString
  Linter.prototype.isSafeString = function (node) {
    if (!node) return false
    switch (node.type) {
      // TypeScript type syntax is erased at runtime, so safety belongs to the
      // wrapped expression.
      case 'TSAsExpression':
      case 'TSTypeAssertion':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
        return this.isSafeString(node.expression)
      case 'OptionalMemberExpression':
        return this.isSafeString({...node, type: 'MemberExpression'})
      case 'OptionalCallExpression':
        return this.isSafeString({...node, type: 'CallExpression'})
      case 'MemberExpression':
        if (node.computed && this.identifierMatches(node.object, 'safeString')) return true
        break
    }
    return origIsSafeString.call(this, node) || isI18nTWithWrappers(node)
  }
  Linter.prototype[PATCHED] = true
}

patchLinter()

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

const COMMON_PLUGINS = [
  'classProperties',
  'objectRestSpread',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
  'numericSeparator',
  'exportDefaultFrom',
]

function pluginsFor(file) {
  const ext = path.extname(file)
  return [
    ...(ext !== '.ts' ? ['jsx'] : []),
    ...(ext === '.ts' || ext === '.tsx' ? ['typescript'] : []),
    ...COMMON_PLUGINS,
  ]
}

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
      if (linter.isSafeExpression('dangerouslySetInnerHTML', htmlProp.value)) return

      warnings.push({
        line: (node.loc || expr.loc).start.line,
        method: 'dangerouslySetInnerHTML',
      })
    },
  })
  return warnings
}

// Anchor all path resolution to the repo root so the plugin works correctly
// regardless of the working directory when oxlint is invoked.
const REPO_ROOT = path.resolve(__dirname, '../..')
const BASELINE_PATH = path.join(REPO_ROOT, 'script', 'xsslint-baseline.json')
const baseline = (() => {
  try {
    return new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).exemptFiles || [])
  } catch {
    return new Set()
  }
})()

function relativeFilename(filename) {
  if (!filename) return null
  if (filename.startsWith(REPO_ROOT + path.sep)) return filename.slice(REPO_ROOT.length + 1)
  return filename
}

function readIgnoreFile(root) {
  // Note: .xssignore is only supported under repo-root-relative paths (e.g. 'ui').
  // Plugin roots (gems/plugins/*/app/jsx) don't have .xssignore files; use
  // oxlint.json ignorePatterns for those exclusions instead.
  const file = path.join(REPO_ROOT, root, '.xssignore')
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n|\r/)
      .map(line => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const UI_IGNORES = readIgnoreFile('ui')
const FRONTEND_TEST_RE = /(^|\/)__tests__\//
const PLUGIN_PUBLIC_IGNORES = /\/public\/javascripts\/(compiled|jst|vendor)(\/|$)/

function isIgnored(rel) {
  if (!rel || rel.endsWith('.d.ts')) return true
  if (FRONTEND_TEST_RE.test(rel)) return true
  if (PLUGIN_PUBLIC_IGNORES.test(rel)) return true
  if (rel.startsWith('ui/')) {
    const uiRel = rel.slice('ui/'.length)
    return UI_IGNORES.some(ignore => uiRel === ignore || uiRel.startsWith(`${ignore}/`))
  }
  return false
}

function parseSource(filename) {
  const source = fs.readFileSync(filename, 'utf8')
  return babylon.parse(source, {
    plugins: pluginsFor(filename),
    sourceType: 'module',
    allowReturnOutsideFunction: true,
  })
}

function analyze(filename) {
  const ast = parseSource(filename)
  const linter = new Linter(ast, XSSLint.config)
  whitelistUrlApiReceivers(ast, linter)
  return linter.run().concat(findDangerouslySetInnerHTMLWarnings(ast, linter))
}

function walk(node, callback) {
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'string') callback(node)
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    if (Array.isArray(value)) {
      for (const item of value) walk(item, callback)
    } else if (value && typeof value.type === 'string') {
      walk(value, callback)
    }
  }
}

function nodeSize(node) {
  if (!node.loc || !node.loc.start || !node.loc.end) return Number.MAX_SAFE_INTEGER
  return node.loc.end.line - node.loc.start.line
}

function lineNodeFinder(programNode) {
  const exact = new Map()
  const containing = []
  walk(programNode, node => {
    if (!node.loc || !node.loc.start) return
    const line = node.loc.start.line
    const current = exact.get(line)
    if (!current || nodeSize(node) < nodeSize(current)) exact.set(line, node)
    if (node.loc.end) containing.push(node)
  })

  return line => {
    if (exact.has(line)) return exact.get(line)
    return (
      containing.find(
        node => node.loc.start.line <= line && node.loc.end && node.loc.end.line >= line,
      ) || programNode
    )
  }
}

const noUnsafeHtmlRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Detect possibly unsafe HTML construction and dangerouslySetInnerHTML without sanitizeHTML.',
    },
    schema: [],
    messages: {
      possiblyXss:
        'Possibly XSS-able {{description}}. Use sanitizeHTML/htmlEscape/raw only when safe, or add `// oxlint-disable-next-line canvas-xss/no-unsafe-html` with a justification comment.',
      parseError: 'canvas-xss could not parse this file: {{error}}',
    },
  },
  create(context) {
    const filename = context.filename
    const rel = relativeFilename(filename)
    if (!filename || baseline.has(rel) || isIgnored(rel)) return {}

    return {
      Program(node) {
        let warnings
        try {
          warnings = analyze(filename)
        } catch (error) {
          context.report({
            node,
            messageId: 'parseError',
            data: {error: error.message},
          })
          return
        }

        const warningKeys = new Set()
        const findNodeForLine = lineNodeFinder(node)
        for (const warning of warnings) {
          const key = `${warning.line}:${warning.method}`
          if (warningKeys.has(key)) continue
          warningKeys.add(key)
          context.report({
            node: findNodeForLine(warning.line),
            messageId: 'possiblyXss',
            data: {description: methodDescription(warning.method)},
          })
        }
      },
    }
  },
}

module.exports = {
  meta: {name: 'canvas-xss'},
  rules: {
    'no-unsafe-html': noUnsafeHtmlRule,
  },
}

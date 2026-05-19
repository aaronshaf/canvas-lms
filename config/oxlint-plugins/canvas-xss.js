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
    case 'innerHTML':
      return '`innerHTML` assignment without sanitizeHTML'
    case 'outerHTML':
      return '`outerHTML` assignment without sanitizeHTML'
    case 'insertAdjacentHTML':
      return '`insertAdjacentHTML` without sanitizeHTML'
    case 'document.write':
      return '`document.write` with unsafe value'
    case 'srcdoc':
      return '`srcdoc` assignment without sanitizeHTML'
    case 'href=':
      return '`href` assignment without sanitizeUrl'
    case 'location.assign':
      return '`location.assign` without sanitizeUrl'
    case 'location.replace':
      return '`location.replace` without sanitizeUrl'
    case 'src=':
      return '`src` assignment without sanitizeUrl'
    case 'action=':
      return '`action` assignment without sanitizeUrl'
    case 'formAction=':
      return '`formAction` assignment without sanitizeUrl'
    case 'location=':
      return '`location` assignment without sanitizeUrl'
    case 'window.open':
      return '`window.open` without sanitizeUrl'
    default:
      if (method.startsWith("setAttribute('")) {
        const attr = method.slice("setAttribute('".length, -"')".length)
        if (/^on/i.test(attr)) return `\`setAttribute\` with event handler attribute \`${attr}\``
        return `\`setAttribute('${attr}', ...)\` without sanitizeUrl`
      }
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

// One-level variable lookup: if expr is an identifier bound to a single-init
// const-like declaration with no subsequent writes, return the initializer.
// This allows `const safe = sanitizeHTML(x); el.innerHTML = safe` to pass.
function resolveBinding(expr, traversePath) {
  if (!expr || expr.type !== 'Identifier') return expr
  const binding = traversePath.scope.getBinding(expr.name)
  if (
    binding?.path.isVariableDeclarator() &&
    binding.path.node.init &&
    binding.constantViolations.length === 0
  ) {
    return binding.path.node.init
  }
  return expr
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
      // Check original first — preserves xsslint's safeString.identifier name
      // matching (e.g. identifiers ending in Html/View/Template).
      if (linter.isSafeExpression('dangerouslySetInnerHTML', htmlProp.value)) return
      // Supplemental: resolve one const binding to allow
      // `const safe = sanitizeHTML(x); dangerouslySetInnerHTML={{__html: safe}}`.
      const resolvedValue = resolveBinding(htmlProp.value, path)
      if (
        resolvedValue !== htmlProp.value &&
        linter.isSafeExpression('dangerouslySetInnerHTML', resolvedValue)
      )
        return

      warnings.push({
        line: (node.loc || expr.loc).start.line,
        method: 'dangerouslySetInnerHTML',
      })
    },
  })
  return warnings
}

const DOM_HTML_SINK_PROPS = new Set(['innerHTML', 'outerHTML', 'srcdoc'])
const MEMBER_LIKE = new Set(['MemberExpression', 'OptionalMemberExpression'])
const CALL_LIKE = new Set(['CallExpression', 'OptionalCallExpression'])

function findDomSinkWarnings(ast, linter) {
  const warnings = []

  function handleAssign(p) {
    const {left, right} = p.node
    if (!MEMBER_LIKE.has(left.type)) return
    const prop = left.property
    if (prop.type !== 'Identifier' || !DOM_HTML_SINK_PROPS.has(prop.name)) return
    if (linter.isSafeString(right)) return
    const resolvedRight = resolveBinding(right, p)
    if (resolvedRight !== right && linter.isSafeString(resolvedRight)) return
    warnings.push({line: p.node.loc.start.line, method: prop.name})
  }

  function handleCall(p) {
    const {callee, arguments: args} = p.node
    if (!MEMBER_LIKE.has(callee.type)) return
    const prop = callee.property
    if (prop.type !== 'Identifier') return

    if (prop.name === 'insertAdjacentHTML') {
      const raw = args[1]
      if (!raw || linter.isSafeString(raw)) return
      const resolved = resolveBinding(raw, p)
      if (resolved !== raw && linter.isSafeString(resolved)) return
      warnings.push({line: p.node.loc.start.line, method: 'insertAdjacentHTML'})
      return
    }

    if (
      (prop.name === 'write' || prop.name === 'writeln') &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'document'
    ) {
      const raw = args[0]
      if (!raw || linter.isSafeString(raw)) return
      const resolved = resolveBinding(raw, p)
      if (resolved !== raw && linter.isSafeString(resolved)) return
      warnings.push({line: p.node.loc.start.line, method: 'document.write'})
    }
  }

  traverse(ast, {
    AssignmentExpression: handleAssign,
    CallExpression: handleCall,
    OptionalCallExpression: handleCall,
  })
  return warnings
}

const URL_SAFE_FNS = new Set(['sanitizeUrl', 'safeUrl', 'validateReturnToURL'])
// Leading / must not be followed by / (which would make it protocol-relative)
const SAFE_URL_PREFIX_RE = /^(\/(?!\/)|https?:\/\/|#|mailto:|tel:)/i

function isSafeUrl(node) {
  if (!node) return false
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return isSafeUrl(node.expression)
  }
  if (node.type === 'StringLiteral') return true
  if (node.type === 'TemplateLiteral') {
    if (node.expressions.length === 0) return true
    const firstQuasi = node.quasis[0]
    if (firstQuasi) {
      const raw = (firstQuasi.value && (firstQuasi.value.raw || firstQuasi.value.cooked)) || ''
      if (SAFE_URL_PREFIX_RE.test(raw)) return true
    }
  }
  if (node.type === 'CallExpression') {
    const c = node.callee
    const name =
      c.type === 'Identifier'
        ? c.name
        : MEMBER_LIKE.has(c.type) && c.property.type === 'Identifier'
          ? c.property.name
          : null
    if (name && URL_SAFE_FNS.has(name)) return true
  }
  return false
}

function isLocationObject(node) {
  if (node.type === 'Identifier' && node.name === 'location') return true
  if (
    node.type === 'MemberExpression' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'location'
  )
    return true
  return false
}

const URL_SINK_PROPS = new Set(['href', 'src', 'action', 'formAction'])

function findUrlSinkWarnings(ast) {
  const warnings = []

  function handleAssign(p) {
    const {left, right} = p.node
    if (!MEMBER_LIKE.has(left.type)) return
    const prop = left.property
    if (prop.type !== 'Identifier') return
    if (isSafeUrl(resolveBinding(right, p))) return

    if (URL_SINK_PROPS.has(prop.name)) {
      warnings.push({line: p.node.loc.start.line, method: `${prop.name}=`})
      return
    }
    if (prop.name === 'location') {
      warnings.push({line: p.node.loc.start.line, method: 'location='})
    }
  }

  function handleCall(p) {
    const {callee, arguments: args} = p.node
    if (!MEMBER_LIKE.has(callee.type)) return
    const prop = callee.property
    if (prop.type !== 'Identifier') return

    if (prop.name === 'assign' || prop.name === 'replace') {
      if (!isLocationObject(callee.object)) return
      const value = resolveBinding(args[0], p)
      if (!value || isSafeUrl(value)) return
      warnings.push({line: p.node.loc.start.line, method: `location.${prop.name}`})
      return
    }

    if (
      prop.name === 'open' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'window'
    ) {
      const url = resolveBinding(args[0], p)
      if (!url || isSafeUrl(url)) return
      warnings.push({line: p.node.loc.start.line, method: 'window.open'})
    }
  }

  traverse(ast, {
    AssignmentExpression: handleAssign,
    CallExpression: handleCall,
    OptionalCallExpression: handleCall,
  })
  return warnings
}

const DANGEROUS_ATTRS_URL = new Set(['href', 'src', 'action', 'formaction', 'srcdoc'])
const DANGEROUS_ATTR_CODE_RE = /^on/i

function findSetAttributeWarnings(ast) {
  const warnings = []

  function handleCall(p) {
    const {callee, arguments: args} = p.node
    if (!MEMBER_LIKE.has(callee.type)) return
    const prop = callee.property
    if (prop.type !== 'Identifier' || prop.name !== 'setAttribute') return
    const attrArg = args[0]
    const valueArg = args[1]
    if (!attrArg || !valueArg) return
    let attrName
    if (attrArg.type === 'StringLiteral') {
      attrName = attrArg.value.toLowerCase()
    } else if (attrArg.type === 'TemplateLiteral' && attrArg.expressions.length === 0) {
      attrName = (attrArg.quasis[0].value.cooked || attrArg.quasis[0].value.raw).toLowerCase()
    } else {
      return
    }
    if (DANGEROUS_ATTR_CODE_RE.test(attrName)) {
      warnings.push({line: p.node.loc.start.line, method: `setAttribute('${attrName}')`})
      return
    }
    if (DANGEROUS_ATTRS_URL.has(attrName)) {
      if (isSafeUrl(resolveBinding(valueArg, p))) return
      warnings.push({line: p.node.loc.start.line, method: `setAttribute('${attrName}')`})
    }
  }

  traverse(ast, {
    CallExpression: handleCall,
    OptionalCallExpression: handleCall,
  })
  return warnings
}

function walkNode(node, fn) {
  if (!node || typeof node !== 'object') return
  fn(node)
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const child = node[key]
    if (Array.isArray(child)) child.forEach(c => walkNode(c, fn))
    else if (child && typeof child.type === 'string') walkNode(child, fn)
  }
}

function handlerHasOriginCheck(handlerArg) {
  const params = handlerArg.params || []

  // Function reference (Identifier) or zero params — can't verify, flag it
  if (!params.length) return false

  const param = params[0]

  if (param.type === 'Identifier') {
    const paramName = param.name
    let found = false
    walkNode(handlerArg.body || handlerArg, node => {
      if (found) return
      if (
        MEMBER_LIKE.has(node.type) &&
        node.object.type === 'Identifier' &&
        node.object.name === paramName &&
        node.property.type === 'Identifier' &&
        (node.property.name === 'origin' || node.property.name === 'source')
      ) {
        found = true
      }
    })
    return found
  }

  if (param.type === 'ObjectPattern') {
    // Destructured: {data, origin} — check origin/source is in the pattern and used in body
    const originProp = param.properties.find(p => {
      if (p.type !== 'ObjectProperty' && p.type !== 'Property') return false
      return (
        p.key && p.key.type === 'Identifier' && (p.key.name === 'origin' || p.key.name === 'source')
      )
    })
    if (!originProp) return false
    const localName =
      originProp.value && originProp.value.type === 'Identifier'
        ? originProp.value.name
        : originProp.key && originProp.key.name
    if (!localName) return false
    let found = false
    walkNode(handlerArg.body || handlerArg, node => {
      if (found) return
      if (node.type === 'Identifier' && node.name === localName) found = true
    })
    return found
  }

  return false
}

function findPostMessageWarnings(ast) {
  const warnings = []
  traverse(ast, {
    CallExpression(p) {
      const {callee, arguments: args} = p.node
      if (!MEMBER_LIKE.has(callee.type)) return
      const prop = callee.property
      if (prop.type !== 'Identifier' || prop.name !== 'addEventListener') return
      const eventArg = args[0]
      if (!eventArg || eventArg.type !== 'StringLiteral' || eventArg.value !== 'message') return
      const handlerArg = args[1]
      if (!handlerArg) return

      // Non-inline handler (Identifier reference) — can't analyze, always flag
      const isInline =
        handlerArg.type === 'ArrowFunctionExpression' || handlerArg.type === 'FunctionExpression'
      if (!isInline || !handlerHasOriginCheck(handlerArg)) {
        warnings.push({line: p.node.loc.start.line})
      }
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
  return linter
    .run()
    .concat(findDangerouslySetInnerHTMLWarnings(ast, linter))
    .concat(findDomSinkWarnings(ast, linter))
    .concat(findUrlSinkWarnings(ast))
    .concat(findSetAttributeWarnings(ast))
}

function nodeSize(node) {
  if (!node.loc || !node.loc.start || !node.loc.end) return Number.MAX_SAFE_INTEGER
  return node.loc.end.line - node.loc.start.line
}

function lineNodeFinder(programNode) {
  const exact = new Map()
  const containing = []
  walkNode(programNode, node => {
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

const postmessageOriginRule = {
  meta: {
    type: 'problem',
    docs: {description: 'postMessage listeners must check event.origin or event.source'},
    schema: [],
    messages: {
      missingOriginCheck:
        'message listener does not check `event.origin` or `event.source`. Verify the sender before using `event.data`, or add `// oxlint-disable-next-line canvas-xss/postmessage-origin-required` with a justification comment.',
    },
  },
  create(context) {
    const filename = context.filename
    const rel = relativeFilename(filename)
    if (!filename || isIgnored(rel)) return {}

    return {
      Program(programNode) {
        const findNodeForLine = lineNodeFinder(programNode)
        for (const warning of findPostMessageWarnings(programNode)) {
          context.report({
            node: findNodeForLine(warning.line),
            messageId: 'missingOriginCheck',
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
    'postmessage-origin-required': postmessageOriginRule,
  },
}

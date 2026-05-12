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

// Element name -> set of attribute names that flow into a URL sink.
// InstUI `<Link>` and react-router `<Link>` are not yet covered while their
// in-tree usages are audited and wrapped; tracked as a follow-up.
const SINKS = {
  a: new Set(['href']),
  iframe: new Set(['src']),
  form: new Set(['action']),
  button: new Set(['formAction', 'formaction']),
}

function getElementName(name) {
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXMemberExpression') return name.property.name
  return null
}

function getAttrName(attr) {
  if (attr.name && attr.name.type === 'JSXIdentifier') return attr.name.name
  return null
}

function isSanitizeUrlCallee(callee) {
  if (callee.type === 'Identifier') return callee.name === 'sanitizeUrl'
  if (callee.type === 'MemberExpression') {
    return (
      !callee.computed &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'sanitizeUrl'
    )
  }
  return false
}

function isAllowedExpression(expr) {
  if (!expr || expr.type === 'JSXEmptyExpression') return true

  // Null / undefined: produces no href in React, harmless.
  if (expr.type === 'Literal' && expr.value === null) return true
  if (expr.type === 'Identifier' && expr.name === 'undefined') return true

  // String literal: <a href={"/foo"} />
  if (expr.type === 'Literal' && typeof expr.value === 'string') return true

  // Template literal with no interpolation: <a href={`/foo`} />
  if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) return true

  // sanitizeUrl(...) or x.sanitizeUrl(...)
  if (expr.type === 'CallExpression' && isSanitizeUrlCallee(expr.callee)) return true

  // Conditional with safe branches on both sides: cond ? sanitizeUrl(x) : undefined.
  if (expr.type === 'ConditionalExpression') {
    return isAllowedExpression(expr.consequent) && isAllowedExpression(expr.alternate)
  }

  return false
}

function isAllowedValue(value) {
  // <a href />  - boolean attribute, no URL flowing.
  if (value == null) return true

  // <a href="/foo" />  - direct string literal attribute value.
  if (value.type === 'Literal') return true

  if (value.type === 'JSXExpressionContainer') {
    return isAllowedExpression(value.expression)
  }

  return false
}

const atHrefRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require sanitizeUrl() at JSX URL sinks (a href, iframe src, form action, button formAction).',
    },
    schema: [],
    messages: {
      requireSanitize:
        'URL sink `<{{element}} {{attribute}}={...}>` must be a string literal or wrapped in sanitizeUrl(). Use sanitizeUrl(value), or add `// oxlint-disable-next-line canvas-sanitize-url/at-href` with a justification comment.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const elementName = getElementName(node.name)
        if (!elementName) return
        const sinkAttrs = SINKS[elementName]
        if (!sinkAttrs) return

        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue
          const attrName = getAttrName(attr)
          if (!attrName || !sinkAttrs.has(attrName)) continue

          if (!isAllowedValue(attr.value)) {
            context.report({
              node: attr,
              messageId: 'requireSanitize',
              data: {element: elementName, attribute: attrName},
            })
          }
        }
      },
    }
  },
}

// Pre-existing imperative sinks pending cleanup. Files listed here have the
// `imperative` rule silenced; new sinks added elsewhere fail CI. Matches the
// xsslint-baseline.json mechanic so the rule can land without blocking on the
// audit/wrap sweep tracked as follow-up.
const BASELINE_PATH = path.join(__dirname, 'canvas-sanitize-url-baseline.json')
const baseline = (() => {
  try {
    return new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).exemptFiles || [])
  } catch {
    return new Set()
  }
})()

function relativeFilename(filename) {
  if (!filename) return null
  const cwd = process.cwd()
  if (filename.startsWith(cwd + path.sep)) return filename.slice(cwd.length + 1)
  return filename
}

const IMPERATIVE_SET_ATTRIBUTE_NAMES = new Set(['href', 'src', 'action', 'formaction'])

function isSetAttributeCallee(callee) {
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'setAttribute'
  )
}

function isWindowOpenCallee(callee) {
  if (callee.type !== 'MemberExpression' || callee.computed) return false
  if (callee.property.type !== 'Identifier' || callee.property.name !== 'open') return false
  return callee.object.type === 'Identifier' && callee.object.name === 'window'
}

function lhsKind(left) {
  if (left.type !== 'MemberExpression' || left.computed) return null
  if (left.property.type !== 'Identifier') return null
  const name = left.property.name
  if (name === 'href' || name === 'src') return name
  // window.location = url
  if (name === 'location' && left.object.type === 'Identifier' && left.object.name === 'window') {
    return 'window.location'
  }
  return null
}

const imperativeRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require sanitizeUrl() at imperative URL sinks (window.location, .href, .src, setAttribute, window.open).',
    },
    schema: [],
    messages: {
      requireSanitize:
        'Imperative URL sink `{{sink}}` must be a string literal or wrapped in sanitizeUrl(). Use sanitizeUrl(value), or add `// oxlint-disable-next-line canvas-sanitize-url/imperative` with a justification comment.',
    },
  },
  create(context) {
    const rel = relativeFilename(context.filename)
    if (rel && baseline.has(rel)) return {}

    return {
      AssignmentExpression(node) {
        if (node.operator !== '=') return
        const kind = lhsKind(node.left)
        if (!kind) return
        if (isAllowedExpression(node.right)) return
        context.report({
          node,
          messageId: 'requireSanitize',
          data: {sink: kind === 'window.location' ? 'window.location' : `.${kind}`},
        })
      },
      CallExpression(node) {
        if (isWindowOpenCallee(node.callee)) {
          const arg = node.arguments[0]
          if (arg && arg.type !== 'SpreadElement' && !isAllowedExpression(arg)) {
            context.report({node, messageId: 'requireSanitize', data: {sink: 'window.open'}})
          }
          return
        }
        if (isSetAttributeCallee(node.callee)) {
          const [nameArg, valueArg] = node.arguments
          if (
            nameArg &&
            nameArg.type === 'Literal' &&
            typeof nameArg.value === 'string' &&
            IMPERATIVE_SET_ATTRIBUTE_NAMES.has(nameArg.value.toLowerCase()) &&
            valueArg &&
            valueArg.type !== 'SpreadElement' &&
            !isAllowedExpression(valueArg)
          ) {
            context.report({
              node,
              messageId: 'requireSanitize',
              data: {sink: `setAttribute('${nameArg.value}', ...)`},
            })
          }
        }
      },
    }
  },
}

module.exports = {
  meta: {name: 'canvas-sanitize-url'},
  rules: {
    'at-href': atHrefRule,
    imperative: imperativeRule,
  },
}

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

module.exports = {
  meta: {name: 'canvas-sanitize-url'},
  rules: {
    'at-href': atHrefRule,
  },
}

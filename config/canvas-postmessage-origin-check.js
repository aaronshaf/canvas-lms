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

// Returns true if the call is *.addEventListener('message', handler[, options]).
function isMessageListener(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'addEventListener' &&
    node.arguments.length >= 2 &&
    node.arguments[0].type === 'Literal' &&
    node.arguments[0].value === 'message'
  )
}

// Attempts to resolve the handler argument to a concrete function node.
// Handles:
//   - Inline ArrowFunctionExpression / FunctionExpression
//   - Identifier pointing to `const fn = (e) => { ... }` (one-level var lookup)
//   - Identifier pointing to `const fn = useCallback((e) => { ... }, deps)` (React hook unwrap)
//   - Identifier pointing to a FunctionDeclaration
// Returns null when the handler cannot be resolved (imported fn, method ref, etc.).
function resolveFunction(arg, scope) {
  if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
    return arg
  }

  if (arg.type === 'Identifier' && scope) {
    let s = scope
    while (s) {
      const v = s.set?.get(arg.name)
      if (v) {
        const def = v.defs[0]
        if (!def) return null

        // FunctionDeclaration: `function handler(e) { ... }`
        if (def.type === 'FunctionName' && v.defs.length === 1) {
          return def.node
        }

        // Variable binding: `const handler = ...`
        if (
          def.type === 'Variable' &&
          v.defs.length === 1 &&
          def.node.init &&
          v.references.filter(r => r.isWrite()).length <= 1
        ) {
          const init = def.node.init

          if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
            return init
          }

          // React useCallback(fn, deps) — unwrap first argument
          if (
            init.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            init.callee.name === 'useCallback' &&
            init.arguments.length >= 1
          ) {
            const fn = init.arguments[0]
            if (fn.type === 'ArrowFunctionExpression' || fn.type === 'FunctionExpression') {
              return fn
            }
          }
        }

        return null
      }
      s = s.upper
    }
  }

  return null
}

// Returns the name of the first parameter, or null if it can't be determined.
function getFirstParamName(fn) {
  const params = fn.params
  if (!params || params.length === 0) return null
  const p = params[0]
  // Plain identifier (JS and TypeScript after stripping type annotation)
  if (p.type === 'Identifier') return p.name
  return null
}

// Properties that hold source-location metadata rather than child AST nodes.
const META_KEYS = new Set(['type', 'loc', 'range', 'start', 'end', 'parent'])

// Returns true if `node` (or any non-function descendant) contains a member
// access `<paramName>.origin` or `<paramName>?.origin`. Stops traversal at
// nested function boundaries to avoid false negatives from closures.
function containsOriginAccess(node, paramName) {
  if (!node || typeof node !== 'object') return false

  // Stop at nested function bodies — origin used inside a closure does not
  // count as an origin check at the handler's top level.
  if (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration'
  ) {
    return false
  }

  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'origin' &&
    node.object.type === 'Identifier' &&
    node.object.name === paramName
  ) {
    return true
  }

  for (const key of Object.keys(node)) {
    if (META_KEYS.has(key)) continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && item.type && containsOriginAccess(item, paramName))
          return true
      }
    } else if (child && typeof child === 'object' && child.type) {
      if (containsOriginAccess(child, paramName)) return true
    }
  }

  return false
}

// Returns true when the first statement of the handler body references
// `<paramName>.origin`. An empty body is treated as safe (returns true) to
// avoid false positives on trivial stubs.
function firstStatementHasOriginCheck(fn, paramName) {
  if (!fn.body || fn.body.type !== 'BlockStatement') return false
  const stmts = fn.body.body
  if (!stmts || stmts.length === 0) return true
  return containsOriginAccess(stmts[0], paramName)
}

const requireOriginCheckRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Warn when addEventListener('message', handler) does not begin with an event.origin check (CWE-345).",
    },
    schema: [],
    messages: {
      missingOriginCheck:
        "addEventListener('message', handler) should begin with an event.origin check to reject cross-origin messages. " +
        'Add `if (event.origin !== trustedOrigin) return` as the first statement, or suppress with ' +
        '`// oxlint-disable-next-line canvas-postmessage-origin-check/require-origin-check` plus a justification.',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.()
    // Skip test files — test helpers and mocks legitimately register handlers
    // without origin checks and would otherwise generate noisy false positives.
    if (filename && /[/\\]__tests__[/\\]|\.(?:test|spec)\.[jt]sx?$/.test(filename)) return {}

    return {
      CallExpression(node) {
        if (!isMessageListener(node)) return

        const handlerArg = node.arguments[1]
        const scope = context.sourceCode?.getScope?.(node) ?? null
        const fn = resolveFunction(handlerArg, scope)

        // If we can't resolve the handler to a concrete function (e.g. imported
        // symbol, method reference), skip rather than producing a false positive.
        if (!fn) return

        const paramName = getFirstParamName(fn)
        // Destructured or rest params are not analyzed (known gap).
        if (!paramName) return

        if (!firstStatementHasOriginCheck(fn, paramName)) {
          context.report({node, messageId: 'missingOriginCheck'})
        }
      },
    }
  },
}

module.exports = {
  meta: {name: 'canvas-postmessage-origin-check'},
  rules: {
    'require-origin-check': requireOriginCheckRule,
  },
}

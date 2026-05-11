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

// Flag writes to `window.ENV` properties in new code.
//
// `window.ENV` mixes server-rendered config with page-mutable state and is
// reachable through a mutable global. Security checks that read it dynamically
// trust whatever happens to be there at check time. New code should not write
// to `window.ENV`; feature state belongs in a proper container (component
// state, Zustand store, React context, query cache). For security-sensitive
// reads of server-rendered values, use `@canvas/env` so the captured value is
// pinned against later mutation.
//
// Existing production sites that mutate ENV are grandfathered as technical
// debt — this rule warns rather than errors so CI does not block on them.
// New code that introduces an ENV write should be addressed at review time.

function isEnvIdentifier(node) {
  return node && node.type === 'Identifier' && node.name === 'ENV'
}

// `window.ENV` / `globalThis.ENV` / `self.ENV`. Accepts the non-computed
// dotted form and the computed `window['ENV']` literal form.
function isWindowEnv(node) {
  if (!node || node.type !== 'MemberExpression') return false
  if (node.object.type !== 'Identifier') return false
  const receiver = node.object.name
  if (receiver !== 'window' && receiver !== 'globalThis' && receiver !== 'self') return false
  if (!node.computed && node.property.type === 'Identifier' && node.property.name === 'ENV') {
    return true
  }
  if (node.computed && node.property.type === 'Literal' && node.property.value === 'ENV') {
    return true
  }
  return false
}

// True if `node` is a member-expression whose root receiver is `ENV` or
// `window.ENV` / `globalThis.ENV` / `self.ENV`.
function isEnvMember(node) {
  if (!node || node.type !== 'MemberExpression') return false
  if (isEnvIdentifier(node.object) || isWindowEnv(node.object)) return true
  // Chained nested writes like `ENV.PERMISSIONS.foo = ...` still flag the
  // top-level ENV identifier; walk the receiver chain.
  return isEnvMember(node.object)
}

// True if `node` references the ENV global itself (not a member of it).
// Catches `Object.assign(ENV, ...)` and `Object.defineProperty(ENV, ...)`.
function isEnvTarget(node) {
  return isEnvIdentifier(node) || isWindowEnv(node) || isEnvMember(node)
}

function isObjectMethodCall(node, methodName) {
  const callee = node.callee
  return (
    callee &&
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Object' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === methodName
  )
}

const noEnvWriteRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Avoid writing to window.ENV. Use proper state containers; read security-relevant values from @canvas/env.',
    },
    schema: [],
    messages: {
      noEnvWrite:
        'Avoid writing to `window.ENV`. New code should keep feature state in a proper container (component state, Zustand, React context, query cache). For security-sensitive reads of server-rendered values, use `@canvas/env`. See ui/shared/env/README.md.',
    },
  },
  create(context) {
    function report(node) {
      context.report({node, messageId: 'noEnvWrite'})
    }

    return {
      // `ENV.X = ...`, `window.ENV.X = ...`, `ENV['X'] = ...`
      AssignmentExpression(node) {
        if (isEnvMember(node.left)) report(node)
      },
      // `ENV.X++`, `--ENV.X`, etc.
      UpdateExpression(node) {
        if (isEnvMember(node.argument)) report(node)
      },
      // `delete ENV.X`, `delete window.ENV.X`
      UnaryExpression(node) {
        if (node.operator === 'delete' && isEnvMember(node.argument)) report(node)
      },
      // `Object.assign(ENV, ...)`, `Object.assign(window.ENV, ...)`,
      // `Object.defineProperty(ENV, 'X', ...)`, etc. Flag when ENV (or a
      // nested ENV property) is the target argument.
      CallExpression(node) {
        const firstArg = node.arguments[0]
        if (!firstArg) return
        if (
          (isObjectMethodCall(node, 'assign') ||
            isObjectMethodCall(node, 'defineProperty') ||
            isObjectMethodCall(node, 'defineProperties')) &&
          isEnvTarget(firstArg)
        ) {
          report(node)
        }
      },
    }
  },
}

module.exports = {
  meta: {name: 'canvas-no-env-write'},
  rules: {
    'no-env-write': noEnvWriteRule,
  },
}

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

// Flag reads from `window.ENV` properties inside packages/.
//
// packages/ are meant to be host-agnostic — they should never reach into the
// Canvas global config blob. Configuration must be passed in as function
// arguments or component props so the package works in any host environment
// (Canvas, tests, embedded consumers).
//
// Catches: window.ENV.X, ENV.X, and bare window.ENV used as a value.
// Does not flag writes (those are caught by canvas-no-env-write in ui/).
//
// To suppress a deliberate exception, use the standard oxlint disable comment:
//   // oxlint-disable-next-line canvas-no-env-read/no-env-read

'use strict'

const DISABLE_COMMENT = 'oxlint-disable-next-line canvas-no-env-read/no-env-read'

function isEnvIdentifier(node) {
  return node != null && node.type === 'Identifier' && node.name === 'ENV'
}

// window.ENV / globalThis.ENV / self.ENV — dotted or computed-string form.
function isWindowEnv(node) {
  if (!node || node.type !== 'MemberExpression') return false
  if (node.object.type !== 'Identifier') return false
  const recv = node.object.name
  if (recv !== 'window' && recv !== 'globalThis' && recv !== 'self') return false
  if (!node.computed && node.property.type === 'Identifier' && node.property.name === 'ENV')
    return true
  if (node.computed && node.property.type === 'Literal' && node.property.value === 'ENV')
    return true
  return false
}

const noEnvReadRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Avoid reading window.ENV in packages. Pass configuration as props or module arguments instead.',
    },
    schema: [],
    messages: {
      noEnvRead:
        'Avoid reading from `window.ENV` in packages. Pass configuration as props or module arguments. ' +
        'Use `// oxlint-disable-next-line canvas-no-env-read/no-env-read` to suppress if intentional.',
    },
  },

  create(context) {
    const disabledLines = new Set()

    function getAllComments(src) {
      // ESLint v9: context.sourceCode; ESLint v8: context.getSourceCode()
      try {
        return (
          context.sourceCode?.getAllComments?.() ||
          context.getSourceCode?.()?.getAllComments?.() ||
          []
        )
      } catch {
        return []
      }
    }

    return {
      Program() {
        for (const comment of getAllComments()) {
          if (comment.value.trim() === DISABLE_COMMENT) {
            disabledLines.add(comment.loc.end.line + 1)
          }
        }
      },

      MemberExpression(node) {
        const line = node.loc?.start.line
        if (line && disabledLines.has(line)) return

        // Flag window.ENV.X or ENV.X — first property access on the ENV global.
        // Flagging the outermost first-level access (not window.ENV itself) keeps
        // reports at the most informative location and avoids double-reporting for
        // deeper chains like window.ENV.LOCALE.trim().
        if (isWindowEnv(node.object) || isEnvIdentifier(node.object)) {
          context.report({node, messageId: 'noEnvRead'})
          return
        }

        // Flag window.ENV used as a standalone value, e.g. `const env = window.ENV`.
        // Skip when this node is the object of a parent MemberExpression — that
        // case is already covered by the block above when the parent is visited.
        if (isWindowEnv(node)) {
          const parent = node.parent
          const isObjectOfParent = parent?.type === 'MemberExpression' && parent.object === node
          if (!isObjectOfParent) {
            context.report({node, messageId: 'noEnvRead'})
          }
        }
      },
    }
  },
}

module.exports = {
  meta: {name: 'canvas-no-env-read'},
  rules: {
    'no-env-read': noEnvReadRule,
  },
}

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

// Run with: node --test config/__tests__/canvas-postmessage-origin-check.test.js

const {test, describe} = require('node:test')
const {RuleTester} = require('eslint')

const plugin = require('../canvas-postmessage-origin-check')

RuleTester.it = test
RuleTester.itOnly = test.only
RuleTester.describe = describe

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
})

tester.run('require-origin-check', plugin.rules['require-origin-check'], {
  valid: [
    // --- present check: inline handler begins with origin guard ---
    {
      code: `window.addEventListener('message', (e) => {
        if (e.origin !== allowed) return
        doSomething(e.data)
      })`,
    },

    // Origin guard inside a compound condition.
    {
      code: `window.addEventListener('message', (e) => {
        if (!trustedOrigin || e.origin !== trustedOrigin) return
        handle(e.data)
      })`,
    },

    // Optional-chaining origin access counts as an origin check.
    {
      code: `window.addEventListener('message', (e) => {
        if (e?.origin !== allowed) return
        handle(e.data)
      })`,
    },

    // Origin check via function call whose argument is event.origin.
    {
      code: `window.addEventListener('message', (e) => {
        if (!isAllowed(e.origin)) return
        handle(e.data)
      })`,
    },

    // --- named-function handler: arrow function variable with origin check ---
    {
      code: `const handler = (event) => {
        if (event.origin !== ENV.TRUSTED) return
        doSomething()
      }
      window.addEventListener('message', handler)`,
    },

    // Named function declaration with origin check.
    {
      code: `function handler(event) {
        if (event.origin !== ENV.TRUSTED) return
        doSomething()
      }
      window.addEventListener('message', handler)`,
    },

    // --- TypeScript handler: useCallback-wrapped handler (reference fixture from ticket) ---
    // Mirrors ui/features/speed_grader/react/SpeedGraderDiscussionsNavigation2.tsx
    {
      code: `const onMessage = useCallback(
        (e) => {
          if (e.origin !== window.location.origin) return
          const msg = e.data
          doSomething(msg)
        },
        []
      )
      window.addEventListener('message', onMessage)`,
    },

    // useCallback with FunctionExpression (not ArrowFunctionExpression).
    {
      code: `const onMessage = useCallback(
        function handler(e) {
          if (e.origin !== allowed) return
          handle(e.data)
        },
        []
      )
      window.addEventListener('message', onMessage)`,
    },

    // --- unresolvable handler: identifier with no local definition → skip ---
    // Simulates an imported or externally-defined handler.
    {
      code: `window.addEventListener('message', handleMessage)`,
    },

    // Method reference — MemberExpression, not resolvable → skip.
    {
      code: `window.addEventListener('message', this.handleMessage)`,
    },

    // --- non-message event: not subject to this rule ---
    {
      code: `window.addEventListener('click', (e) => { doSomething(e) })`,
    },
    {
      code: `el.addEventListener('load', (e) => { init(e) })`,
    },

    // Empty handler body — treated as safe (trivial stub).
    {
      code: `window.addEventListener('message', (e) => {})`,
    },
  ],

  invalid: [
    // --- missing check: the Snyk finding (submissions/jquery/index.tsx) ---
    {
      code: `window.addEventListener(
        'message',
        event => {
          if (event.data === 'refreshGrades') {
            refreshGrades()
          }
        },
        false
      )`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // Inline handler with no check at all.
    {
      code: `window.addEventListener('message', (e) => {
        doSomething(e.data)
      })`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // First statement checks data subject, not origin.
    {
      code: `window.addEventListener('message', (e) => {
        if (e.data?.subject !== 'expected') return
        doSomething()
      })`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // Origin check present but NOT as the first statement.
    {
      code: `window.addEventListener('message', (e) => {
        doSomethingFirst()
        if (e.origin !== allowed) return
        doSomething()
      })`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // --- named-function handler: resolved arrow function without origin check ---
    {
      code: `const handler = (event) => {
        doSomething(event.data)
      }
      window.addEventListener('message', handler)`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // Named function declaration without origin check.
    {
      code: `function handler(event) {
        doSomething(event.data)
      }
      window.addEventListener('message', handler)`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // --- TypeScript handler: useCallback-wrapped handler without origin check ---
    {
      code: `const onMessage = useCallback(
        (e) => {
          doSomething(e.data)
        },
        []
      )
      window.addEventListener('message', onMessage)`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // Origin check inside a nested closure does NOT count (closure boundary stops traversal).
    {
      code: `window.addEventListener('message', (e) => {
        const guard = () => { if (e.origin !== allowed) return }
        doSomething(e.data)
      })`,
      errors: [{messageId: 'missingOriginCheck'}],
    },

    // Non-window target but still a 'message' listener.
    {
      code: `someWindow.addEventListener('message', (e) => {
        handle(e.data)
      })`,
      errors: [{messageId: 'missingOriginCheck'}],
    },
  ],
})

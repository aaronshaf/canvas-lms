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

// Run with: node --test config/__tests__/canvas-no-env-read.test.js

const {test, describe} = require('node:test')
const assert = require('node:assert/strict')
const {RuleTester} = require('eslint')

const plugin = require('../canvas-no-env-read')

RuleTester.it = test
RuleTester.itOnly = test.only
RuleTester.describe = describe

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
})

tester.run('no-env-read', plugin.rules['no-env-read'], {
  valid: [
    // Unrelated property access — not window.ENV
    {code: 'const x = config.LOCALE'},
    {code: 'const x = myObj.property'},

    // Method on a non-ENV object
    {code: 'const lang = navigator.language'},

    // window.ENV appears only as an assignment target (write, not read)
    // The rule does not flag the LHS of plain assignment... actually it does
    // flag window.ENV standalone. Test the common case people hit:
    // accessing a nested object that happens to be named similarly but isn't global ENV
    {code: 'const x = someModule.ENV.LOCALE'},

    // Disable comment suppresses the next line
    {
      code: [
        '// oxlint-disable-next-line canvas-no-env-read/no-env-read',
        'const locale = window.ENV.LOCALE',
      ].join('\n'),
    },

    // Disable comment also works for ENV.X bare access
    {
      code: [
        '// oxlint-disable-next-line canvas-no-env-read/no-env-read',
        'const x = ENV.SOMETHING',
      ].join('\n'),
    },

    // Disable comment works for standalone window.ENV
    {
      code: [
        '// oxlint-disable-next-line canvas-no-env-read/no-env-read',
        'const env = window.ENV',
      ].join('\n'),
    },
  ],

  invalid: [
    // window.ENV.X — standard property read
    {
      code: 'const locale = window.ENV.LOCALE',
      errors: [{messageId: 'noEnvRead'}],
    },

    // ENV.X — bare identifier (global ENV)
    {
      code: 'const x = ENV.SOMETHING',
      errors: [{messageId: 'noEnvRead'}],
    },

    // Standalone window.ENV used as a value
    {
      code: 'const env = window.ENV',
      errors: [{messageId: 'noEnvRead'}],
    },

    // globalThis.ENV.X
    {
      code: 'const x = globalThis.ENV.LOCALE',
      errors: [{messageId: 'noEnvRead'}],
    },

    // self.ENV.X
    {
      code: 'const x = self.ENV.LOCALE',
      errors: [{messageId: 'noEnvRead'}],
    },

    // Computed string property access: window['ENV'].X
    {
      code: "const x = window['ENV'].LOCALE",
      errors: [{messageId: 'noEnvRead'}],
    },

    // Deep chain window.ENV.LOCALE.trim() — reports exactly once (on window.ENV.LOCALE)
    {
      code: 'const lang = window.ENV.LOCALE.trim()',
      errors: [{messageId: 'noEnvRead'}],
    },

    // Conditional using window.ENV
    {
      code: 'const locale = window.ENV.LOCALE || navigator.language',
      errors: [{messageId: 'noEnvRead'}],
    },

    // Destructuring from ENV
    {
      code: 'const {LOCALE} = window.ENV',
      errors: [{messageId: 'noEnvRead'}],
    },
  ],
})

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

// Run with: node --test config/__tests__/canvas-sanitize-url.test.js

const {test, describe} = require('node:test')
const assert = require('node:assert/strict')
const {RuleTester} = require('eslint')

const plugin = require('../canvas-sanitize-url')

RuleTester.it = test
RuleTester.itOnly = test.only
RuleTester.describe = describe

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
})

tester.run('at-href', plugin.rules['at-href'], {
  valid: [
    // No URL attribute at all.
    {code: '<a>x</a>'},
    {code: '<a href />'},

    // String-literal attributes.
    {code: '<a href="/foo">x</a>'},
    {code: '<iframe src="https://example.com" />'},
    {code: '<form action="/submit" />'},
    {code: '<button formAction="/submit" />'},
    {code: '<button formaction="/submit" />'},
    // String literal in JSX expression.
    {code: '<a href={"/foo"} />'},

    // Template literal with no interpolation.
    {code: '<a href={`/foo`} />'},

    // Wrapped values.
    {code: '<a href={sanitizeUrl(url)} />'},
    {code: '<a href={obj.sanitizeUrl(url)} />'},
    {code: '<iframe src={sanitizeUrl(`/x/${id}`)} />'},
    {code: '<form action={sanitizeUrl(buildUrl())} />'},
    {code: '<button formAction={sanitizeUrl(x)} />'},

    // Conditional with both branches safe.
    {code: '<iframe src={cond ? sanitizeUrl(x) : undefined} />'},
    {code: '<a href={cond ? "/foo" : sanitizeUrl(x)} />'},

    // null / undefined produce no href; harmless.
    {code: '<a href={null} />'},
    {code: '<a href={undefined} />'},

    // Non-sink elements pass through untouched.
    {code: '<div href={url} />'},
    {code: '<img src={url} />'},
    {code: '<MyComponent href={url} />'},
    // `<Link>` (InstUI / react-router) is intentionally out of scope
    // until its in-tree usages are wrapped (see follow-up).
    {code: '<Link href={url} />'},
    {code: '<Link to={url} />'},

    // Spread props are not visible to the rule (known gap).
    {code: '<a {...props} />'},
  ],

  invalid: [
    {
      code: '<a href={url} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<a href={obj.url} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<a href={buildUrl()} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<a href={`/x/${id}`} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<a href={cond ? a : b} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      // One safe branch is not enough: the unsafe branch still fires.
      code: '<a href={cond ? sanitizeUrl(x) : raw} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: "<a href={url || '/x'} />",
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<iframe src={url} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<form action={url} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<button formAction={url} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<button formaction={url} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    // Imposter `sanitizeUrl`-like callees do NOT pass.
    {
      code: '<a href={NotSanitizeUrl(url)} />',
      errors: [{messageId: 'requireSanitize'}],
    },
    {
      code: '<a href={sanitize(url)} />',
      errors: [{messageId: 'requireSanitize'}],
    },
  ],
})

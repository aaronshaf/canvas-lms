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

// Run with: node --test config/__tests__/canvas-xss.test.js

const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const babylon = require('@babel/parser')

const plugin = require('../canvas-xss')

const COMMON_PLUGINS = [
  'jsx',
  'typescript',
  'classProperties',
  'objectRestSpread',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
  'numericSeparator',
  'exportDefaultFrom',
]

function lint(code, ext = '.tsx') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-xss-test-'))
  const filename = path.join(dir, `fixture${ext}`)
  fs.writeFileSync(filename, code)
  const ast = babylon.parse(code, {
    plugins: COMMON_PLUGINS,
    sourceType: 'module',
    allowReturnOutsideFunction: true,
  })
  const reports = []
  const rule = plugin.rules['no-unsafe-html'].create({
    filename,
    report(report) {
      reports.push(report)
    },
  })
  rule.Program(ast)
  return reports
}

test('flags unsafe dangerouslySetInnerHTML values', () => {
  const reports = lint(`
    export function Example({content}: {content: string}) {
      return <div dangerouslySetInnerHTML={{__html: content}} />
    }
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].messageId, 'possiblyXss')
  assert.equal(reports[0].data.description, '`dangerouslySetInnerHTML` without sanitizeHTML')
})

test('allows dangerouslySetInnerHTML values wrapped with sanitizeHTML', () => {
  const reports = lint(`
    import {sanitizeHTML} from '@canvas/sanitize-html'
    export function Example({content}: {content: string}) {
      return <div dangerouslySetInnerHTML={{__html: sanitizeHTML(content)}} />
    }
  `)

  assert.equal(reports.length, 0)
})

test('flags htmly string concatenation', () => {
  const reports = lint(`
    const value = userInput
    const html = '<span>' + value + '</span>'
    $('#target').html(html)
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, 'HTML string concatenation')
})

test('flags htmly template literals', () => {
  const reports = lint(`
    const html = \`<span>\${userInput}</span>\`
    $('#target').html(html)
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, 'HTML template literal')
})

test('allows URL API receiver methods', () => {
  const reports = lint(`
    const params = new URLSearchParams()
    params.append('name', userInput)
  `)

  assert.equal(reports.length, 0)
})

test('allows I18n.t wrappers as safe HTML', () => {
  const reports = lint(`
    const html = I18n.t('hello', {wrapper: '<span>$1</span>'})
    $('#target').html(html)
  `)

  assert.equal(reports.length, 0)
})

test('allows I18n.t with quoted wrappers key', () => {
  const reports = lint(`
    const html = I18n.t('hello', {'wrappers': {'*': '<b>$1</b>'}})
    $('#target').html(html)
  `)

  assert.equal(reports.length, 0)
})

test('does not crash on spread in I18n.t options and still flags the sink', () => {
  const reports = lint(`
    const html = '<i>' + I18n.t('hello %{name}', {...defaults, name: user.name}) + '</i>'
    $('#target').html(html)
  `)

  // The spread makes I18n.t unsafe (no wrapper), so the concatenation is flagged.
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, 'HTML string concatenation')
})

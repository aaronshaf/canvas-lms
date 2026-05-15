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

// DOM sink tests

test('flags innerHTML assignment with unsafe value', () => {
  const reports = lint(`
    element.innerHTML = userInput
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`innerHTML` assignment without sanitizeHTML')
})

test('flags outerHTML assignment with unsafe value', () => {
  const reports = lint(`
    element.outerHTML = userInput
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`outerHTML` assignment without sanitizeHTML')
})

test('allows innerHTML assignment wrapped with sanitizeHTML', () => {
  const reports = lint(`
    import {sanitizeHTML} from '@canvas/sanitize-html'
    element.innerHTML = sanitizeHTML(userInput)
  `)

  assert.equal(reports.length, 0)
})

test('flags insertAdjacentHTML with unsafe value', () => {
  const reports = lint(`
    element.insertAdjacentHTML('beforeend', userInput)
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`insertAdjacentHTML` without sanitizeHTML')
})

test('allows insertAdjacentHTML with sanitizeHTML', () => {
  const reports = lint(`
    import {sanitizeHTML} from '@canvas/sanitize-html'
    element.insertAdjacentHTML('beforeend', sanitizeHTML(userInput))
  `)

  assert.equal(reports.length, 0)
})

test('flags document.write with unsafe value', () => {
  const reports = lint(`
    document.write(userInput)
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`document.write` with unsafe value')
})

// URL sink tests

test('flags href assignment with unsafe value', () => {
  const reports = lint(`
    element.href = userInput
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`href` assignment without sanitizeUrl')
})

test('allows href assignment with string literal', () => {
  const reports = lint(`
    element.href = '/safe/path'
  `)

  assert.equal(reports.length, 0)
})

test('allows href assignment wrapped with sanitizeUrl', () => {
  const reports = lint(`
    import {sanitizeUrl} from '@canvas/sanitize-url'
    element.href = sanitizeUrl(userInput)
  `)

  assert.equal(reports.length, 0)
})

test('flags location.assign with unsafe value', () => {
  const reports = lint(`
    location.assign(userInput)
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`location.assign` without sanitizeUrl')
})

test('flags location.replace with unsafe value', () => {
  const reports = lint(`
    location.replace(userInput)
  `)

  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`location.replace` without sanitizeUrl')
})

test('allows location.assign with sanitizeUrl', () => {
  const reports = lint(`
    import {sanitizeUrl} from '@canvas/sanitize-url'
    location.assign(sanitizeUrl(userInput))
  `)

  assert.equal(reports.length, 0)
})

test('does not flag unrelated assign() calls', () => {
  const reports = lint(`
    someArray.assign(userInput)
  `)

  assert.equal(reports.length, 0)
})

// Navigation sink tests

test('flags window.location.href assignment', () => {
  const reports = lint(`window.location.href = userInput`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`href` assignment without sanitizeUrl')
})

test('flags window.location assignment', () => {
  const reports = lint(`window.location = userInput`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`location` assignment without sanitizeUrl')
})

test('flags window.open with dynamic url', () => {
  const reports = lint(`window.open(userInput, '_blank')`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`window.open` without sanitizeUrl')
})

test('flags element.src assignment', () => {
  const reports = lint(`iframe.src = userInput`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`src` assignment without sanitizeUrl')
})

test('flags form.action assignment', () => {
  const reports = lint(`form.action = userInput`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`action` assignment without sanitizeUrl')
})

test('allows window.location.href with string literal', () => {
  const reports = lint(`window.location.href = '/courses/123'`)
  assert.equal(reports.length, 0)
})

test('allows window.location.href with template literal starting with /', () => {
  const reports = lint('window.location.href = `/courses/${id}/assignments`')
  assert.equal(reports.length, 0)
})

test('allows window.open with sanitizeUrl', () => {
  const reports = lint(`
    import {sanitizeUrl} from '@canvas/sanitize-url'
    window.open(sanitizeUrl(userInput), '_blank')
  `)
  assert.equal(reports.length, 0)
})

test('allows window.location.href with safeUrl', () => {
  const reports = lint(`
    window.location.href = safeUrl(returnTo)
  `)
  assert.equal(reports.length, 0)
})

// setAttribute tests

test('flags setAttribute with href and unsafe value', () => {
  const reports = lint(`el.setAttribute('href', userInput)`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, "`setAttribute('href', ...)` without sanitizeUrl")
})

test('flags setAttribute with src and unsafe value', () => {
  const reports = lint(`el.setAttribute('src', userInput)`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, "`setAttribute('src', ...)` without sanitizeUrl")
})

test('flags setAttribute with onclick handler', () => {
  const reports = lint(`el.setAttribute('onclick', handler)`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`setAttribute` with event handler attribute `onclick`')
})

test('allows setAttribute with href and sanitizeUrl', () => {
  const reports = lint(`
    import {sanitizeUrl} from '@canvas/sanitize-url'
    el.setAttribute('href', sanitizeUrl(userInput))
  `)
  assert.equal(reports.length, 0)
})

test('allows setAttribute with href and string literal', () => {
  const reports = lint(`el.setAttribute('href', '/safe/path')`)
  assert.equal(reports.length, 0)
})

test('does not flag setAttribute with safe attribute', () => {
  const reports = lint(`el.setAttribute('class', userInput)`)
  assert.equal(reports.length, 0)
})

test('flags setAttribute with template-literal attribute name', () => {
  const reports = lint('el.setAttribute(`href`, userInput)')
  assert.equal(reports.length, 1)
})

// postMessage origin tests

function lintPostMessage(code, ext = '.tsx') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canvas-xss-test-'))
  const filename = path.join(dir, `fixture${ext}`)
  fs.writeFileSync(filename, code)
  const ast = babylon.parse(code, {
    plugins: COMMON_PLUGINS,
    sourceType: 'module',
    allowReturnOutsideFunction: true,
  })
  const reports = []
  const rule = plugin.rules['postmessage-origin-required'].create({
    filename,
    report(report) {
      reports.push(report)
    },
  })
  rule.Program(ast)
  return reports
}

test('flags message listener without origin check', () => {
  const reports = lintPostMessage(`
    window.addEventListener('message', (event) => {
      doSomething(event.data)
    })
  `)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].messageId, 'missingOriginCheck')
})

test('allows message listener that checks event.origin', () => {
  const reports = lintPostMessage(`
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://trusted.example.com') return
      doSomething(event.data)
    })
  `)
  assert.equal(reports.length, 0)
})

test('allows message listener that checks event.source', () => {
  const reports = lintPostMessage(`
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent) return
      doSomething(event.data)
    })
  `)
  assert.equal(reports.length, 0)
})

test('does not flag non-message event listeners', () => {
  const reports = lintPostMessage(`
    window.addEventListener('click', (event) => {
      doSomething(event.target)
    })
  `)
  assert.equal(reports.length, 0)
})

// must-fix: srcdoc direct assignment
test('flags iframe.srcdoc assignment', () => {
  const reports = lint(`iframe.srcdoc = userInput`)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].data.description, '`srcdoc` assignment without sanitizeHTML')
})

test('allows iframe.srcdoc with sanitizeHTML', () => {
  const reports = lint(`
    import {sanitizeHTML} from '@canvas/sanitize-html'
    iframe.srcdoc = sanitizeHTML(userInput)
  `)
  assert.equal(reports.length, 0)
})

// must-fix: protocol-relative URL bypass
test('flags template literal with protocol-relative prefix', () => {
  const reports = lint('element.href = `//${userInput}`')
  assert.equal(reports.length, 1)
})

test('still allows template literal with absolute path prefix', () => {
  const reports = lint('element.href = `/courses/${id}`')
  assert.equal(reports.length, 0)
})

// must-fix: optional chaining bypasses
test('flags el?.setAttribute with dangerous attribute', () => {
  const reports = lint(`el?.setAttribute('href', userInput)`)
  assert.equal(reports.length, 1)
})

test('flags window?.open with unsafe url', () => {
  const reports = lint(`window?.open(userInput, '_blank')`)
  assert.equal(reports.length, 1)
})

// must-fix: TypeScript cast bypasses isSafeUrl
test('allows href assignment where sanitizeUrl result is cast', () => {
  const reports = lint(`
    import {sanitizeUrl} from '@canvas/sanitize-url'
    element.href = sanitizeUrl(userInput) as string
  `)
  assert.equal(reports.length, 0)
})

// must-fix: postMessage destructured param with no origin check
test('flags message listener with destructured param and no origin check', () => {
  const reports = lintPostMessage(`
    window.addEventListener('message', ({data}) => {
      doSomething(data)
    })
  `)
  assert.equal(reports.length, 1)
})

test('allows message listener with destructured param that includes origin', () => {
  const reports = lintPostMessage(`
    window.addEventListener('message', ({data, origin}) => {
      if (origin !== 'https://trusted.example.com') return
      doSomething(data)
    })
  `)
  assert.equal(reports.length, 0)
})

// must-fix: postMessage function-reference handler
test('flags message listener with function reference handler', () => {
  const reports = lintPostMessage(`
    function onMsg(event) { doSomething(event.data) }
    window.addEventListener('message', onMsg)
  `)
  assert.equal(reports.length, 1)
})

// must-fix: postMessage zero-param handler
test('flags message listener with zero-param handler', () => {
  const reports = lintPostMessage(`
    window.addEventListener('message', () => { doSomething() })
  `)
  assert.equal(reports.length, 1)
})

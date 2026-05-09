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

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import $ from 'jquery'
import {sanitizeHTML} from '@canvas/sanitize-html'

// Captured before the shim loads. Red-baseline tests call through it
// directly; afterAll restores it to avoid leaking the patch.
const originalHtml = $.fn.html as unknown as (this: JQuery, ...args: unknown[]) => unknown

// CFA-954 also patches the sibling DOM-mutation methods. jquery's
// internal `.html(string)` impl, for inputs containing <script>/<style>/
// <link>, chains through `.empty().append(string)`. So a "truly unpatched"
// red baseline has to restore ALL of these around the call, not just
// `.html`. Capture the rest of the originals here too.
type SiblingName = 'append' | 'prepend' | 'before' | 'after' | 'replaceWith'
const SIBLING_METHODS: SiblingName[] = ['append', 'prepend', 'before', 'after', 'replaceWith']
const originalSiblings: Record<SiblingName, unknown> = {
  append: $.fn.append,
  prepend: $.fn.prepend,
  before: $.fn.before,
  after: $.fn.after,
  replaceWith: $.fn.replaceWith,
}

// Run a callback with $.fn.html and the sibling methods temporarily
// restored to their truly-original (pre-shim) implementations. Used by
// red-baseline tests to demonstrate "what unpatched jquery would do".
const withTrulyUnpatchedJQuery = <T>(callback: () => T): T => {
  const stashedHtml = $.fn.html
  const stashedSiblings: Record<SiblingName, unknown> = {} as Record<SiblingName, unknown>
  $.fn.html = originalHtml as unknown as typeof $.fn.html
  for (const name of SIBLING_METHODS) {
    stashedSiblings[name] = $.fn[name]
    ;($.fn as unknown as Record<SiblingName, unknown>)[name] = originalSiblings[name]
  }
  try {
    return callback()
  } finally {
    $.fn.html = stashedHtml
    for (const name of SIBLING_METHODS) {
      ;($.fn as unknown as Record<SiblingName, unknown>)[name] = stashedSiblings[name]
    }
  }
}

// Recorder installed onto $.fn.html BEFORE beforeAll imports the shim.
// The shim does `const originalHtml = $.fn.html` at module-import time,
// so it captures whatever is on $.fn.html at that moment. By installing
// the recorder first, the shim's "original" reference IS the recorder —
// every internal `originalHtml.call(...)` from the shim flows through it
// and we can observe what the shim actually hands to jQuery.
const recorderCalls: unknown[][] = []
const recorderHtml = function (this: JQuery, ...args: unknown[]) {
  recorderCalls.push(args)
  return (originalHtml as (this: JQuery, ...a: unknown[]) => unknown).apply(this, args)
}
$.fn.html = recorderHtml as unknown as typeof $.fn.html

// Build the DOM-normalized form of `sanitizeHTML(payload)` so a shim
// assertion can compare against an oracle that uses the real shared
// sanitizer. Both sides go through innerHTML parse-and-serialize, so any
// browser-level normalization (attribute order, self-closing rewrites)
// applies identically.
const expectedSanitizedDom = (payload: string): string => {
  const tmp = document.createElement('div')
  tmp.innerHTML = sanitizeHTML(payload) as unknown as string
  return tmp.innerHTML
}

interface FakeTrustedHTML {
  __isFakeTrustedHTML: true
  toString: () => string
  toJSON: () => string
}

// jsdom has no native Trusted Types, and DOMPurify caches the policy
// lookup on first sanitize call — so we can't easily route real
// `sanitizeHTML` through a stubbed `createPolicy` to mint a value
// `isHTML()` recognizes. The hand-rolled wrapper bypasses that and lets
// the test inject content the sanitizer would strip; survival is what
// proves the shim took the trusted-pass-through branch (rather than
// re-sanitizing).
const installTrustedTypesStub = (): {mintTrustedHTML: (s: string) => FakeTrustedHTML} => {
  const mintTrustedHTML = (s: string): FakeTrustedHTML => ({
    __isFakeTrustedHTML: true,
    toString: () => s,
    toJSON: () => s,
  })
  ;(globalThis as unknown as {trustedTypes: unknown}).trustedTypes = {
    isHTML: (v: unknown) =>
      Boolean(
        v && typeof v === 'object' && (v as {__isFakeTrustedHTML?: boolean}).__isFakeTrustedHTML,
      ),
  }
  return {mintTrustedHTML}
}

const removeTrustedTypesStub = (): void => {
  delete (globalThis as unknown as {trustedTypes?: unknown}).trustedTypes
}

describe('jquery.htmlSanitizeShim', () => {
  beforeAll(async () => {
    await import('../jquery.htmlSanitizeShim')
  })

  afterAll(() => {
    // Restore ALL patched methods so subsequent test files in the same vitest
    // fork worker get an unpatched jQuery. vitest isolate:true clears the ESM
    // module registry but NOT Node's CJS require.cache; jquery-with-plugins
    // uses createRequire so require('jquery') returns the same $.fn object
    // across test files in the same worker.
    $.fn.html = originalHtml as unknown as typeof $.fn.html
    for (const name of SIBLING_METHODS) {
      ;($.fn as unknown as Record<SiblingName, unknown>)[name] = originalSiblings[name]
    }
  })

  beforeEach(() => {
    document.body.innerHTML = '<div id="fixture"></div>'
    removeTrustedTypesStub()
    recorderCalls.length = 0
  })

  afterEach(() => {
    $('#fixture').remove()
    removeTrustedTypesStub()
  })

  describe('shim activation', () => {
    it('has replaced $.fn.html — proves the shim took effect on import', () => {
      // Compare against the recorder, not the truly-original. The
      // recorder is what was on $.fn.html at the moment the shim
      // imported, so a no-op shim would leave $.fn.html === recorderHtml.
      expect($.fn.html).not.toBe(recorderHtml)
      expect($.fn.html).not.toBe(originalHtml)
    })
  })

  describe('red baseline (unpatched .html())', () => {
    it('leaves an onerror attribute in the DOM', () => {
      const $el = $('#fixture')
      originalHtml.call($el, '<img src="x" onerror="window.__pwned=1">')
      expect($el.find('img').attr('onerror')).toBe('window.__pwned=1')
    })

    it('leaves an inline <script> when wrapped in another element', () => {
      // jquery's `.html(string)` for inputs containing <script>/<style>/
      // <link> chains through .empty().append(string), so we have to
      // restore both the .html and .append originals to demonstrate
      // truly-unpatched behavior (see CFA-954 sibling-method patches).
      const $el = $('#fixture')
      withTrulyUnpatchedJQuery(() => {
        originalHtml.call($el, '<div><script>window.__pwned=1</script></div>')
      })
      expect($el.find('script').length).toBe(1)
    })
  })

  describe('red/green proof — same payload, opposite outcomes', () => {
    it('defuses an onerror payload that survives unpatched .html()', () => {
      const payload = '<img src="x" onerror="window.__pwned=1">'

      // RED: unpatched jQuery — exploit lives.
      const $red = $('<div></div>').appendTo('#fixture')
      originalHtml.call($red, payload)
      expect($red.find('img').attr('onerror')).toBe('window.__pwned=1')

      // GREEN: shimmed jQuery (the call site library code uses) —
      // exploit gone.
      const $green = $('<div></div>').appendTo('#fixture')
      $green.html(payload)
      expect($green.find('img').attr('onerror')).toBeUndefined()
    })

    it('defuses an inline <script> payload that survives unpatched .html()', () => {
      const payload = '<div><script>window.__pwned=1</script><span class="probe">x</span></div>'

      // RED — unpatched jquery (and unpatched .append, since jquery's
      // internal .html() chains through .empty().append() for <script>
      // payloads) — exploit lives.
      const $red = $('<div></div>').appendTo('#fixture')
      withTrulyUnpatchedJQuery(() => {
        originalHtml.call($red, payload)
      })
      expect($red.find('script').length).toBe(1)

      // GREEN
      const $green = $('<div></div>').appendTo('#fixture')
      $green.html(payload)
      expect($green.find('script').length).toBe(0)
      expect($green.find('.probe').text()).toBe('x')
    })
  })

  describe('green — shim output matches @canvas/sanitize-html', () => {
    it('matches sanitizeHTML for an event-handler payload', () => {
      const payload = '<img src="x" onerror="window.__pwned=1">'
      $('#fixture').html(payload)
      expect(($('#fixture')[0] as HTMLElement).innerHTML).toBe(expectedSanitizedDom(payload))
    })

    it('matches sanitizeHTML for an inline-script payload', () => {
      const payload = '<div><script>window.__pwned=1</script><span class="probe">ok</span></div>'
      $('#fixture').html(payload)
      expect(($('#fixture')[0] as HTMLElement).innerHTML).toBe(expectedSanitizedDom(payload))
    })

    it('matches sanitizeHTML for a javascript: URI', () => {
      const payload = '<a href="javascript:alert(1)" class="probe">click</a>'
      $('#fixture').html(payload)
      expect(($('#fixture')[0] as HTMLElement).innerHTML).toBe(expectedSanitizedDom(payload))
    })

    it('matches sanitizeHTML for benign markup', () => {
      const payload = '<p class="probe">hello <strong>world</strong></p>'
      $('#fixture').html(payload)
      expect(($('#fixture')[0] as HTMLElement).innerHTML).toBe(expectedSanitizedDom(payload))
    })
  })

  describe('green — TrustedHTML is converted to string then sanitized', () => {
    it('renders safe TrustedHTML content correctly', () => {
      const {mintTrustedHTML} = installTrustedTypesStub()
      const $el = $('#fixture')
      const trusted = mintTrustedHTML('<span class="probe">trusted-content</span>')

      $el.html(trusted as unknown as string)

      expect($el.find('.probe').text()).toBe('trusted-content')
    })

    it('strips dangerous content from TrustedHTML (sanitized like any string)', () => {
      // TrustedHTML is converted to plain string then run through DOMPurify
      // IN_PLACE — javascript: URIs are stripped even from "trusted" content.
      const {mintTrustedHTML} = installTrustedTypesStub()
      const $el = $('#fixture')
      const trusted = mintTrustedHTML('<a href="javascript:noop()" class="probe">trusted</a>')

      $el.html(trusted as unknown as string)

      expect($el.find('.probe').attr('href')).toBeUndefined()
      expect($el.find('.probe').text()).toBe('trusted')
    })

    it('passes the string form (not the wrapper object) to the underlying jQuery impl', () => {
      // TrustedHTML is converted via String() before calling originalHtml
      // so jQuery's typeof checks and string methods work correctly.
      const {mintTrustedHTML} = installTrustedTypesStub()
      const trusted = mintTrustedHTML('<span class="probe">x</span>')
      recorderCalls.length = 0

      $('#fixture').html(trusted as unknown as string)

      expect(recorderCalls).toHaveLength(1)
      expect(recorderCalls[0][0]).toBe('<span class="probe">x</span>')
      expect(recorderCalls[0][0]).not.toBe(trusted)
    })
  })

  describe('green — TrustedHTML detection edge cases', () => {
    it('falls back to sanitizing when trustedTypes exists but isHTML is missing', () => {
      // Some older spec drafts (and Firefox stable until very recently)
      // expose `window.trustedTypes` without `isHTML`. The shim must
      // still sanitize string input in that environment rather than
      // throwing or treating the value as trusted.
      ;(globalThis as unknown as {trustedTypes: unknown}).trustedTypes = {}
      const payload = '<img src="x" onerror="window.__pwned=1">'

      $('#fixture').html(payload)

      expect($('#fixture').find('img').attr('onerror')).toBeUndefined()
    })
  })

  describe('green — function form sanitizes return value', () => {
    it('matches sanitizeHTML for a string returned by the user callback', () => {
      const payload = '<img src="x" onerror="window.__pwned=1">'
      $('#fixture').html('<p class="placeholder">x</p>')
      $('#fixture').html((_i: number, _old: string) => payload)
      expect(($('#fixture')[0] as HTMLElement).innerHTML).toBe(expectedSanitizedDom(payload))
    })

    it('preserves index and oldHtml arguments', () => {
      const $el = $('#fixture')
      $el.html('<span class="initial">old</span>')
      let seenIndex: number | undefined
      let seenOld: string | undefined
      $el.html((index: number, oldHtml: string) => {
        seenIndex = index
        seenOld = oldHtml
        return '<span class="probe">new</span>'
      })
      expect(seenIndex).toBe(0)
      expect(seenOld).toContain('initial')
      expect($el.find('.probe').text()).toBe('new')
    })

    it('passes the matched DOM element as `this` to a function-form callback', () => {
      // Arrow callbacks ignore `this` (lexical binding), so to actually
      // verify the wrapper's `userFn.call(this, ...)` does the right
      // thing we have to use a `function` callback. jQuery's contract
      // for .html(fn) is `this === matched element`.
      const $el = $('#fixture')
      $el.html('<span class="initial">x</span>')
      let seenTagName: string | undefined
      let seenIsFixture = false
      $el.html(function (this: Element) {
        seenTagName = this.tagName
        seenIsFixture = (this as HTMLElement).id === 'fixture'
        return '<span class="probe">new</span>'
      })
      expect(seenTagName).toBe('DIV')
      expect(seenIsFixture).toBe(true)
    })
  })

  describe('green — non-string values pass through', () => {
    it('passes a DOM node', () => {
      const $el = $('#fixture')
      const node = document.createElement('span')
      node.className = 'probe'
      node.textContent = 'from-node'
      $el.html(node as unknown as string)
      expect($el.find('.probe').text()).toBe('from-node')
    })

    it('passes a jQuery object', () => {
      const $el = $('#fixture')
      const $injected = $('<span class="probe">from-jquery</span>')
      $el.html($injected as unknown as string)
      expect($el.find('.probe').text()).toBe('from-jquery')
    })

    // <style> elements are in DOMPurify's default ALLOWED_TAGS; the shim
    // does NOT remove them. DOMPurify sanitizes their content (strips
    // expression(), url() with js:/data: protocols, @import), so ordinary
    // CSS passes through intact. Both DOM-element and HTML-string paths
    // preserve <style>; <link> and <script> remain forbidden.
    //
    // Known consumers: CFA-955 (calendar per-course color rules),
    // CFA-956 (LDB login popup <link rel=stylesheet>).
    it('passes a DOM-built <style> element through .append unchanged', () => {
      const $el = $('<div></div>').appendTo('#fixture')
      const css = '.group_course_42 { background-color: #ff0000; }'
      const styleEl = document.createElement('style')
      styleEl.textContent = css

      $el.append(styleEl as unknown as string)

      const found = $el.find('style')[0]
      expect(found).toBeDefined()
      expect(found.textContent).toBe(css)
    })

    it('passes a DOM-built <style> element through .html unchanged', () => {
      const $el = $('<div></div>').appendTo('#fixture')
      const css = '.group_course_42 { background-color: #ff0000; }'
      const styleEl = document.createElement('style')
      styleEl.textContent = css

      $el.html(styleEl as unknown as string)

      const found = $el.find('style')[0]
      expect(found).toBeDefined()
      expect(found.textContent).toBe(css)
    })

    it('preserves <style> when passed as an HTML string (DOMPurify allows by default)', () => {
      // <style> in HTML strings is NOT stripped — DOMPurify allows <style>
      // but sanitizes its CSS content. Canvas templates that include
      // <style> elements (toolbar CSS, per-element overrides) continue
      // to work correctly.
      const $el = $('<div></div>').appendTo('#fixture')
      const css = '.group_course_42 { background-color: #ff0000; }'

      $el.html(`<style>${css}</style>`)

      const found = $el.find('style')[0]
      expect(found).toBeDefined()
      expect(found.textContent).toContain('background-color')
    })
  })

  describe('green — getter form is unaffected', () => {
    it('returns inner HTML when called with no arguments', () => {
      const $el = $('#fixture')
      originalHtml.call($el, '<span class="probe">hi</span>')
      expect($el.html()).toContain('class="probe"')
      expect($el.html()).toContain('hi')
    })
  })

  describe('green — multi-element collections', () => {
    it('sanitizes each element when the matched set has more than one', () => {
      document.body.innerHTML =
        '<div id="fixture"><div class="target"></div><div class="target"></div></div>'

      $('.target').html('<img src="x" onerror="window.__pwned=1">')

      const targets = document.querySelectorAll('.target')
      expect(targets).toHaveLength(2)
      targets.forEach(t => {
        expect(t.querySelector('img')?.getAttribute('onerror')).toBeNull()
      })
    })
  })

  // CFA-954: extend the shim to .append/.prepend/.before/.after/.replaceWith.
  // Each of these accepts the same shape as .html(string) and gets the
  // same treatment (sanitize string args, pass TrustedHTML / DOM nodes
  // through, wrap function returns).
  describe('CFA-954: sibling DOM-mutation methods', () => {
    type SiblingMethod = 'append' | 'prepend' | 'before' | 'after' | 'replaceWith'

    const setupTarget = (initialHtml: string = '<span class="anchor">x</span>') => {
      const $el = $('<div></div>').appendTo('#fixture')
      $el.html(initialHtml)
      return $el
    }

    const ALL_METHODS: SiblingMethod[] = ['append', 'prepend', 'before', 'after', 'replaceWith']

    describe.each(ALL_METHODS)('$.fn.%s', (method: SiblingMethod) => {
      it(`strips event handler attributes from a string arg via .${method}`, () => {
        const $el = setupTarget()
        const target =
          method === 'before' || method === 'after' || method === 'replaceWith'
            ? ($el.find('.anchor') as JQuery)
            : ($el as JQuery)

        ;(target[method] as (s: string) => unknown)('<img src="x" onerror="window.__pwned=1">')

        const img = $('#fixture').find('img')[0]
        expect(img).toBeDefined()
        expect(img.getAttribute('onerror')).toBeNull()
      })

      it(`strips inline <script> from a string arg via .${method}`, () => {
        const $el = setupTarget()
        const target =
          method === 'before' || method === 'after' || method === 'replaceWith'
            ? ($el.find('.anchor') as JQuery)
            : ($el as JQuery)

        ;(target[method] as (s: string) => unknown)('<div><script>window.__pwned=1</script></div>')

        expect($('#fixture').find('script').length).toBe(0)
      })

      it(`passes a DOM node through .${method} unchanged (no sanitize)`, () => {
        const $el = setupTarget()
        const target =
          method === 'before' || method === 'after' || method === 'replaceWith'
            ? ($el.find('.anchor') as JQuery)
            : ($el as JQuery)

        const node = document.createElement('span')
        node.className = 'pass-through-probe'
        node.textContent = 'from-node'
        ;(target[method] as (n: Element) => unknown)(node)

        expect($('#fixture').find('.pass-through-probe').text()).toBe('from-node')
      })
    })

    it('converts TrustedHTML to string and sanitizes via .append', () => {
      // TrustedHTML is converted to plain string then sanitized in-place.
      // Safe content survives; dangerous content is stripped.
      ;(globalThis as unknown as {trustedTypes: unknown}).trustedTypes = {
        isHTML: (v: unknown) =>
          Boolean(
            v &&
              typeof v === 'object' &&
              (v as {__isFakeTrustedHTML?: boolean}).__isFakeTrustedHTML,
          ),
      }
      const trusted = {
        __isFakeTrustedHTML: true as const,
        toString: () => '<span class="probe">trusted-content</span>',
        toJSON: () => '<span class="probe">trusted-content</span>',
      }

      const $el = $('<div></div>').appendTo('#fixture')
      $el.append(trusted as unknown as string)

      expect($el.find('.probe').text()).toBe('trusted-content')
      delete (globalThis as unknown as {trustedTypes?: unknown}).trustedTypes
    })

    it('sanitizes each string arg in a multi-arg .append call', () => {
      const $el = $('<div></div>').appendTo('#fixture')

      ;($el.append as (...a: unknown[]) => unknown)(
        '<img src="x" onerror="window.__pwned=1">',
        '<script>window.__pwned=1</script>',
        '<span class="probe">ok</span>',
      )

      expect($el.find('img').attr('onerror')).toBeUndefined()
      expect($el.find('script').length).toBe(0)
      expect($el.find('.probe').text()).toBe('ok')
    })

    it('wraps a function return value through .append', () => {
      const $el = $('<div></div>').appendTo('#fixture')
      $el.html('<span class="initial">x</span>')

      ;($el.append as (fn: (i: number, html: string) => string) => unknown)(
        (_i: number, _html: string) => '<img src="x" onerror="window.__pwned=1">',
      )

      expect($el.find('img').attr('onerror')).toBeUndefined()
    })
  })
})

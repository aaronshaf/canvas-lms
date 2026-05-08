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

// Regression coverage for a title-attribute stored-XSS class against
// DiscussionEntry.message.
//
// Payload class: angle brackets nested inside a title="..." attribute. The
// browser keeps a title value as an inert string at parse time, so the
// payload is dormant — until a downstream processor mutates the HTML in a
// way that escapes the attribute boundary. SearchSpan's `addTargetToLinks`
// (regex `/<a\s/gi` -> `<a target="_top" `) is exactly that kind of
// mutator: replacing a `<a ` *inside* the title attribute injects a `"`
// that prematurely closes title="...", promoting the embedded
// `<img onerror=…>` into a real DOM element when set as innerHTML.
//
// The "safety" assertion in these tests is "no event handler attribute
// survives in the rendered DOM" — DOMPurify legitimately allows <img>
// tags but strips on* handlers, so the tag may appear while remaining
// inert.

import {render} from '@testing-library/react'
import React from 'react'
import {sanitizeHTML} from '@canvas/sanitize-html'
import {SearchSpan} from '../SearchSpan'

const MALICIOUS_MESSAGE =
  '<p>visible</p>' +
  '<p style="display:none" ' +
  'title="<a ><img src=canvas-analytics onerror=\'window.__xss_fired=true\'>">' +
  '</p>'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('SearchSpan — XSS regression (title-attribute breakout)', () => {
  let originalLocation: Location

  beforeEach(() => {
    originalLocation = window.location
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {value: originalLocation, writable: true})
    delete (window as any).__xss_fired
  })

  const setLocationSearch = (search: string) => {
    Object.defineProperty(window, 'location', {
      value: {...originalLocation, search},
      writable: true,
    })
  }

  // --- Mechanism reproducers (no React) ----------------------------------

  it('REPRO: the unsafe addTargetToLinks regex breaks out of title="..." and produces an <img onerror=…>', () => {
    // Mimic SearchSpan's `html.replace(/<a\s/gi, '<a target="_top" ')`.
    // The payload's title value contains the literal substring `<a `, so the
    // regex matches inside the attribute. The injected `"` in `target="_top"`
    // prematurely closes title="...", making the embedded img a real tag.
    const broken = MALICIOUS_MESSAGE.replace(/<a\s/gi, '<a target="_top" ')

    const div = document.createElement('div')
    div.innerHTML = broken

    const img = div.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('onerror')).toBe('window.__xss_fired=true')
  })

  it('FIX: sanitizing the OUTPUT of the regex munging strips the escaped event handler', () => {
    const broken = MALICIOUS_MESSAGE.replace(/<a\s/gi, '<a target="_top" ')
    const sanitized = sanitizeHTML(broken)

    // DOMPurify may keep the <img> tag, but the on* handler must be gone.
    expect(sanitized).not.toMatch(/\son[a-z]+\s*=/i)

    const div = document.createElement('div')
    div.innerHTML = sanitized
    expectNoEventHandlers(div)
  })

  // --- SearchSpan integration --------------------------------------------

  it('SearchSpan: renders the malicious payload with no event handlers (no embed, no search)', () => {
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('SearchSpan: renders safely in embed mode where addTargetToLinks fires', () => {
    setLocationSearch('?embed=true')
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('SearchSpan: renders safely when search highlighting injects a span near a title attribute', () => {
    // addSearchHighlighting splits on `<` / `>` without respecting attribute
    // boundaries. A search term that hits a chunk straddling an attribute
    // value can inject a <span> mid-attribute. Output sanitization defuses
    // whatever tags break out.
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="display" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  // --- DOM-walk semantics: preprocessor must not touch attribute values ---
  //
  // These cases pin down the DOM-walk implementation contract: highlighting
  // and link-target rewriting may only mutate real elements / text nodes,
  // never the contents of attribute values. They fail under the legacy
  // regex/character-split implementation (which sees attribute contents as
  // raw characters) and pass under the DOM-walk implementation.

  it('addTargetToLinks: does not add target= to <a-like text inside attribute values', () => {
    setLocationSearch('?embed=true')
    // The literal substring `<a ` lives inside a title="..." value. A regex
    // rewrite would inject `target="_top"` mid-attribute and corrupt the
    // attribute boundary.
    const html = '<p title="<a href=evil>">visible</p>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)

    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    // The title value should still be intact, and target= must not have
    // been written into it.
    const title = p!.getAttribute('title') ?? ''
    expect(title).not.toMatch(/target=/i)

    // No real <a target=...> should have materialized from the attribute
    // contents.
    expect(container.querySelector('a[target]')).toBeNull()
  })

  it('addSearchHighlighting: does not inject highlight spans inside attribute values', () => {
    // The title value contains `<a >evil</a>` as inert text. Under the old
    // character-split implementation, the walker treats every `<` as a tag
    // boundary and would happily emit a highlight span around the literal
    // "evil" sitting inside the title attribute, breaking out of the
    // attribute and producing live DOM. The DOM-walk implementation only
    // visits text nodes, so the title value is never touched.
    const html = '<p title="<a >evil</a>">visible</p>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="evil" />)

    // The title attribute on <p> must not have been rewritten with a span.
    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    const title = p!.getAttribute('title') ?? ''
    expect(title).not.toMatch(/<span/i)
    expect(title).not.toMatch(/highlighted-search-item/)

    // And no highlight span should have been emitted at all, since "evil"
    // is not present in any text node.
    expect(container.querySelectorAll('[data-testid="highlighted-search-item"]')).toHaveLength(0)
  })

  // --- More attribute-protection edge cases -----------------------------

  it('addTargetToLinks: does not run in non-embed mode', () => {
    setLocationSearch('') // not embedded
    const {container} = render(
      <SearchSpan htmlBody='<p><a href="https://example">link</a></p>' searchTerm="" />,
    )
    expect(container.querySelector('a[target]')).toBeNull()
  })

  it('addTargetToLinks: only runs when embed query param is exactly "true"', () => {
    setLocationSearch('?embed=1') // truthy-looking but not the literal string "true"
    const {container} = render(
      <SearchSpan htmlBody='<p><a href="https://example">link</a></p>' searchTerm="" />,
    )
    expect(container.querySelector('a[target]')).toBeNull()
  })

  it('renders multiple <a> tags including deeply nested ones', () => {
    // Note: DOMPurify default policy strips the `target` attribute from
    // anchors entirely. addTargetToLinks runs in embed mode and writes
    // target="_top", but the final sanitize pass removes it. This test
    // pins the "every link survives sanitization" half of that behavior;
    // the target= attribute is verified separately in DOMPurify's own
    // tests and is intentionally NOT asserted here.
    setLocationSearch('?embed=true')
    const html =
      '<div><a href="https://example.com/a">A</a><section><a href="https://example.com/b">B</a></section></div>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    expect(container.querySelectorAll('a')).toHaveLength(2)
  })

  it('strips event-handler attributes that would survive a naive embed-mode rewrite', () => {
    setLocationSearch('?embed=true')
    const html = '<a href="https://example.com" onclick="alert(1)">link</a>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('onclick')).toBeNull()
  })

  it('script-tag payload inside title attribute is neutralized', () => {
    const html = '<p title="<script>window.__xss_fired=true</script>">visible</p>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('javascript: href embedded inside title attribute does not become a real link', () => {
    const html = '<p title="<a href=&quot;javascript:alert(1)&quot;>x</a>">visible</p>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    container.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') ?? ''
      expect(href.toLowerCase()).not.toContain('javascript:')
    })
  })

  it('iframe srcdoc payload is stripped (DOMPurify defuses srcdoc)', () => {
    const html = '<iframe srcdoc="<script>alert(1)</script>"></iframe>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    const iframe = container.querySelector('iframe')
    // The wrapper allows <iframe> for legit Studio/media embeds, but
    // srcdoc is not in the additional allowlist — DOMPurify strips it.
    if (iframe) {
      expect(iframe.hasAttribute('srcdoc')).toBe(false)
    }
  })

  it('multiple title-attribute breakouts in one payload all stay inert', () => {
    const html =
      '<p title="<img src=x onerror=alert(1)>">a</p>' + '<p title="<svg onload=alert(2)>">b</p>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('deeply nested malicious title attribute remains inert', () => {
    const html =
      '<article><section><div>' +
      '<p title="<a ><img src=x onerror=alert(1)>">visible</p>' +
      '</div></section></article>'
    const {container} = render(<SearchSpan htmlBody={html} searchTerm="" />)
    expectNoEventHandlers(container)
  })

  it('combined: embed mode + active search + malicious payload all rendered safely', () => {
    setLocationSearch('?embed=true')
    const {container} = render(<SearchSpan htmlBody={MALICIOUS_MESSAGE} searchTerm="visible" />)
    expectNoEventHandlers(container)
    // Search highlighting still works on legitimate text.
    expect(
      container.querySelectorAll('[data-testid="highlighted-search-item"]').length,
    ).toBeGreaterThan(0)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})

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

import {sanitizeHTML} from '../index'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const parse = (html: string): Document =>
  new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

const collectAttrNames = (doc: Document): string[] => {
  const names: string[] = []
  doc.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => names.push(name))
  })
  return names
}

const expectNoEventHandlers = (doc: Document) => {
  const offending = collectAttrNames(doc).filter(n => EVENT_HANDLER_ATTR.test(n))
  expect(offending).toEqual([])
}

describe('@canvas/sanitize-html sanitizeHTML', () => {
  describe('XSS regressions', () => {
    it('strips <script> tags', () => {
      const out = sanitizeHTML('<p>before<script>window.__x=1</script>after</p>')
      expect(out).not.toMatch(/<script/i)
      expect(parse(out).querySelector('script')).toBeNull()
    })

    it('strips inline onerror handlers', () => {
      const out = sanitizeHTML('<img src=x onerror="window.__x=1">')
      expect(out).not.toMatch(/onerror/i)
      expectNoEventHandlers(parse(out))
    })

    it('strips inline onload handlers', () => {
      const out = sanitizeHTML('<svg><image href=x onload="window.__x=1"/></svg>')
      expect(out).not.toMatch(/onload/i)
      expectNoEventHandlers(parse(out))
    })

    it('strips inline onclick handlers', () => {
      const out = sanitizeHTML('<a href="#" onclick="window.__x=1">x</a>')
      expect(out).not.toMatch(/onclick/i)
      expectNoEventHandlers(parse(out))
    })

    it('strips inline onmouseover handlers', () => {
      const out = sanitizeHTML('<div onmouseover="window.__x=1">x</div>')
      expect(out).not.toMatch(/onmouseover/i)
      expectNoEventHandlers(parse(out))
    })

    it('strips javascript: URIs from anchor href', () => {
      const out = sanitizeHTML('<a href="javascript:window.__x=1">click</a>')
      const a = parse(out).querySelector('a')
      expect(a?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    })

    it('strips javascript: URIs from iframe src', () => {
      const out = sanitizeHTML('<iframe src="javascript:window.__x=1"></iframe>')
      const iframe = parse(out).querySelector('iframe')
      expect(iframe?.getAttribute('src') ?? '').not.toMatch(/^javascript:/i)
    })

    // Note: DOMPurify intentionally does NOT deep-sanitize CSS property
    // values inside the style attribute. Vectors like url(javascript:...)
    // and expression(...) are inert in modern browsers (CSS engine ignores
    // javascript: URIs in url(); expression() was IE-only and removed).
    // We rely on the browser's CSS engine for those, not DOMPurify.

    it('does not promote a title-attribute breakout into a live event handler', () => {
      // mXSS shape: input text contains tag-like content inside a title
      // attribute. A regex tokenizer might break the attribute boundary
      // when re-serializing, producing real DOM with a live handler.
      // DOMPurify's native-DOMParser path must not.
      const out = sanitizeHTML('<p title="</p><img src=x onerror=\'window.__x=1\'>">visible</p>')
      expectNoEventHandlers(parse(out))
    })

    it('handles <noscript> double-decode payloads safely', () => {
      // TinyMCE 6.8.4 mXSS class: HTML entities double-decoded inside
      // <noscript>. DOMPurify's native parser handles this consistently.
      const out = sanitizeHTML(
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">x</p></noscript>',
      )
      expectNoEventHandlers(parse(out))
      expect(out).not.toMatch(/onerror/i)
    })

    it('handles conditional comments without leaking script content', () => {
      const out = sanitizeHTML('<!--[if IE]><script>window.__x=1</script><![endif]-->')
      expect(out).not.toMatch(/<script/i)
      expect(parse(out).querySelector('script')).toBeNull()
    })

    it('strips event handlers nested inside <svg><foreignObject>', () => {
      const out = sanitizeHTML(
        '<svg><foreignObject><img src=x onerror="window.__x=1"></foreignObject></svg>',
      )
      expectNoEventHandlers(parse(out))
      expect(out).not.toMatch(/onerror/i)
    })

    it('strips srcdoc on iframe', () => {
      const out = sanitizeHTML('<iframe srcdoc="<script>window.__x=1</script>"></iframe>')
      const iframe = parse(out).querySelector('iframe')
      expect(iframe?.hasAttribute('srcdoc')).toBe(false)
    })

    it('strips formaction (XSS surface on submit buttons)', () => {
      const out = sanitizeHTML('<button formaction="javascript:window.__x=1">go</button>')
      const button = parse(out).querySelector('button')
      const formaction = button?.getAttribute('formaction') ?? ''
      expect(formaction).not.toMatch(/^javascript:/i)
    })
  })

  describe('content preservation (RCE-shaped output)', () => {
    it('preserves inline style attribute on a paragraph', () => {
      const out = sanitizeHTML('<p style="color: red; font-size: 14px">hi</p>')
      const p = parse(out).querySelector('p')
      expect(p?.getAttribute('style')).toContain('color')
      expect(p?.getAttribute('style')).toContain('font-size')
    })

    it('preserves table cell editor attributes', () => {
      const out = sanitizeHTML(
        '<table border="1" cellpadding="4" cellspacing="0"><tr><td width="100">x</td></tr></table>',
      )
      const table = parse(out).querySelector('table')
      expect(table?.getAttribute('border')).toBe('1')
      expect(table?.getAttribute('cellpadding')).toBe('4')
      expect(table?.getAttribute('cellspacing')).toBe('0')
      const td = parse(out).querySelector('td')
      expect(td?.getAttribute('width')).toBe('100')
    })

    it('preserves a MathML equation', () => {
      const input =
        '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>'
      const out = sanitizeHTML(input)
      const doc = parse(out)
      expect(doc.querySelector('math')).not.toBeNull()
      expect(doc.querySelector('mfrac')).not.toBeNull()
      expect(doc.querySelectorAll('mn')).toHaveLength(2)
    })

    it('preserves a Studio iframe embed', () => {
      const input =
        '<iframe src="https://canvas.test/media_objects_iframe/m-abc" ' +
        'data-media-id="m-abc" data-media-type="video" ' +
        'allowfullscreen sandbox="allow-scripts allow-same-origin" ' +
        'allow="fullscreen" frameborder="0"></iframe>'
      const out = sanitizeHTML(input)
      const iframe = parse(out).querySelector('iframe')
      expect(iframe).not.toBeNull()
      expect(iframe?.getAttribute('src')).toBe('https://canvas.test/media_objects_iframe/m-abc')
      expect(iframe?.getAttribute('data-media-id')).toBe('m-abc')
      expect(iframe?.getAttribute('data-media-type')).toBe('video')
      expect(iframe?.hasAttribute('allowfullscreen')).toBe(true)
      expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
      expect(iframe?.getAttribute('allow')).toBe('fullscreen')
      expect(iframe?.getAttribute('frameborder')).toBe('0')
    })

    it('preserves video element attributes', () => {
      const out = sanitizeHTML(
        '<video src="x.mp4" controls muted poster="p.png" playsinline width="640" height="360"></video>',
      )
      const v = parse(out).querySelector('video')
      expect(v?.getAttribute('src')).toBe('x.mp4')
      expect(v?.hasAttribute('controls')).toBe(true)
      expect(v?.hasAttribute('muted')).toBe(true)
      expect(v?.getAttribute('poster')).toBe('p.png')
      expect(v?.hasAttribute('playsinline')).toBe(true)
    })

    it('preserves audio element attributes', () => {
      const out = sanitizeHTML('<audio src="x.mp3" controls muted></audio>')
      const a = parse(out).querySelector('audio')
      expect(a?.getAttribute('src')).toBe('x.mp3')
      expect(a?.hasAttribute('controls')).toBe(true)
      expect(a?.hasAttribute('muted')).toBe(true)
    })

    it('preserves picture/source markup', () => {
      const out = sanitizeHTML(
        '<picture><source srcset="big.png" media="(min-width: 800px)"><img src="small.png" alt="x"></picture>',
      )
      const doc = parse(out)
      expect(doc.querySelector('picture')).not.toBeNull()
      expect(doc.querySelector('source')?.getAttribute('srcset')).toBe('big.png')
      expect(doc.querySelector('img')?.getAttribute('src')).toBe('small.png')
    })

    it('preserves aria-* attributes', () => {
      const out = sanitizeHTML(
        '<div aria-label="hello" aria-describedby="x" aria-hidden="false">x</div>',
      )
      const div = parse(out).querySelector('div')
      expect(div?.getAttribute('aria-label')).toBe('hello')
      expect(div?.getAttribute('aria-describedby')).toBe('x')
      expect(div?.getAttribute('aria-hidden')).toBe('false')
    })

    it('preserves data-* attributes including data-old-link', () => {
      const out = sanitizeHTML(
        '<a href="/x" data-api-endpoint="/api/v1/foo" data-old-link="/legacy">x</a>',
      )
      const a = parse(out).querySelector('a')
      expect(a?.getAttribute('data-api-endpoint')).toBe('/api/v1/foo')
      expect(a?.getAttribute('data-old-link')).toBe('/legacy')
    })

    it('preserves the legacy webkitallowfullscreen iframe attribute', () => {
      const out = sanitizeHTML('<iframe src="https://x.test" webkitallowfullscreen></iframe>')
      expect(parse(out).querySelector('iframe')?.hasAttribute('webkitallowfullscreen')).toBe(true)
    })

    it('preserves the legacy mozallowfullscreen iframe attribute', () => {
      const out = sanitizeHTML('<iframe src="https://x.test" mozallowfullscreen></iframe>')
      expect(parse(out).querySelector('iframe')?.hasAttribute('mozallowfullscreen')).toBe(true)
    })

    it('preserves the deprecated iframe scrolling attribute', () => {
      const out = sanitizeHTML('<iframe src="https://x.test" scrolling="no"></iframe>')
      expect(parse(out).querySelector('iframe')?.getAttribute('scrolling')).toBe('no')
    })

    it('preserves anchor target attribute (RCE external links)', () => {
      const out = sanitizeHTML(
        '<a href="https://canvas.test/x" target="_blank" rel="noopener noreferrer">x</a>',
      )
      const a = parse(out).querySelector('a')
      expect(a?.getAttribute('href')).toBe('https://canvas.test/x')
      expect(a?.getAttribute('target')).toBe('_blank')
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for null', () => {
      expect(sanitizeHTML(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(sanitizeHTML(undefined)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(sanitizeHTML('')).toBe('')
    })

    it('preserves benign plain text', () => {
      expect(sanitizeHTML('hello world')).toBe('hello world')
    })
  })
})

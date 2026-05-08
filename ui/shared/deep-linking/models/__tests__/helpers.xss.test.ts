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

// Regression coverage for stored XSS via the deep-linking anchor sink.
// LTI deep-linking responses can carry arbitrary `innerHTML` strings that
// are written directly into an anchor element built by `anchorTag` in
// helpers.ts. CFA-869 wraps that sink with the shared DOMPurify wrapper
// as defense-in-depth: a malicious or compromised LTI tool must not be
// able to inject <script>, event handlers, or javascript: URIs into the
// live DOM via deep linking.
//
// `anchorTag` returns a serialized outerHTML string. We parse it back
// into a DOM fragment via DOMParser so we can inspect the resulting
// tree without giving the test browser a chance to execute the payload.

import {anchorTag, iframeTag, imageTag} from '../helpers'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const parseAnchor = (html: string): HTMLAnchorElement => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const anchor = doc.querySelector('a')
  if (!anchor) throw new Error(`anchorTag did not return an <a>: ${html}`)
  return anchor as HTMLAnchorElement
}

const expectNoEventHandlers = (root: Element) => {
  const visit = (el: Element) => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
    el.querySelectorAll('*').forEach(visit)
  }
  visit(root)
}

describe('deep-linking helpers anchorTag — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from <img> in innerHTML', () => {
    const payload = '<img src=x onerror="window.__xss_fired = true">'
    const anchor = parseAnchor(anchorTag({url: 'https://example.com/lti', title: 'tool'}, payload))

    expectNoEventHandlers(anchor)
    expect(anchor.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from innerHTML', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const anchor = parseAnchor(anchorTag({url: 'https://example.com/lti', title: 'tool'}, payload))

    expect(anchor.querySelector('script')).toBeNull()
    expect(anchor.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('neutralizes javascript: hrefs nested inside innerHTML', () => {
    const payload = '<a href="javascript:window.__xss_fired = true">click</a>'
    const anchor = parseAnchor(anchorTag({url: 'https://example.com/lti', title: 'tool'}, payload))

    const inner = anchor.querySelector('a')
    // Either the nested anchor was stripped entirely, or its href no
    // longer carries a javascript: URI. Both are acceptable outcomes.
    if (inner) {
      expect(inner.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i)
    }
    expectNoEventHandlers(anchor)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves legitimate text and benign formatting in innerHTML', () => {
    const payload = '<strong>bold</strong> and <em>italic</em>'
    const anchor = parseAnchor(anchorTag({url: 'https://example.com/lti', title: 'tool'}, payload))

    expect(anchor.querySelector('strong')?.textContent).toBe('bold')
    expect(anchor.querySelector('em')?.textContent).toBe('italic')
    expectNoEventHandlers(anchor)
  })
})

describe('deep-linking helpers imageTag — URL sanitization', () => {
  const parseImg = (html: string): HTMLImageElement => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const img = doc.querySelector('img')
    if (!img) throw new Error(`imageTag did not return an <img>: ${html}`)
    return img as HTMLImageElement
  }

  it('replaces a javascript: src with about:blank', () => {
    const img = parseImg(imageTag('javascript:alert(1)'))
    expect(img.getAttribute('src')).toBe('about:blank')
  })

  it('passes through legitimate https: src unchanged', () => {
    const img = parseImg(imageTag('https://example.com/thumb.png'))
    expect(img.getAttribute('src')).toBe('https://example.com/thumb.png')
  })
})

describe('deep-linking helpers iframeTag — URL sanitization', () => {
  const parseIframe = (html: string): HTMLIFrameElement => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const frame = doc.querySelector('iframe')
    if (!frame) throw new Error(`iframeTag did not return an <iframe>: ${html}`)
    return frame as HTMLIFrameElement
  }

  it('replaces a javascript: iframe.src with about:blank', () => {
    const frame = parseIframe(iframeTag({iframe: {src: 'javascript:alert(1)'}}))
    expect(frame.getAttribute('src')).toBe('about:blank')
  })

  it('passes through legitimate https: iframe.src unchanged', () => {
    const frame = parseIframe(iframeTag({iframe: {src: 'https://tool.example.com/launch'}}))
    expect(frame.getAttribute('src')).toBe('https://tool.example.com/launch')
  })
})

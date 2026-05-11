/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import sanitizeData from '../sanitizeData'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const parseField = html => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')

const expectNoEventHandlersInField = html => {
  const doc = parseField(html)
  const offending = []
  doc.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      if (EVENT_HANDLER_ATTR.test(name)) offending.push(name)
    })
  })
  expect(offending).toEqual([])
}

describe('sanitizeData()', () => {
  describe('return type — plain string (Trusted Types safety)', () => {
    it('returns a plain string, not a TrustedHTML object', () => {
      const out = sanitizeData({message: '<p>hello</p>'})
      expect(typeof out.message).toBe('string')
    })

    it('survives JSON.stringify round-trip without data loss', () => {
      const out = sanitizeData({message: '<b>hi</b>'})
      const json = JSON.parse(JSON.stringify(out))
      expect(typeof json.message).toBe('string')
      expect(json.message).toContain('hi')
    })

    it('JSON.stringify produces a string-valued message field, not {}', () => {
      const out = sanitizeData({message: '<p>content</p>'})
      const json = JSON.parse(JSON.stringify(out))
      expect(json.message).not.toEqual({})
      expect(json.message.length).toBeGreaterThan(0)
    })
  })

  describe('default field selection', () => {
    it('sanitizes the message field by default', () => {
      const out = sanitizeData({message: '<script>window.__x=1</script>'})
      expect(out.message).not.toMatch(/<script/i)
    })

    it('does not modify a field outside dataItems', () => {
      const out = sanitizeData({message: '<p>x</p>', notes: '<script>x</script>'})
      expect(out.notes).toBe('<script>x</script>')
    })

    it('leaves the data shape intact when message is absent', () => {
      const out = sanitizeData({foo: 'bar'})
      expect(out).toEqual({foo: 'bar'})
    })

    it('does not throw when the data object is empty', () => {
      expect(() => sanitizeData({})).not.toThrow()
      expect(sanitizeData({})).toEqual({})
    })

    it('does not mutate the original data object', () => {
      const data = {message: '<script>bad</script><p>good</p>'}
      const before = data.message
      sanitizeData(data)
      expect(data.message).toBe(before)
    })
  })

  describe('custom field selection', () => {
    it('sanitizes a custom single field', () => {
      const out = sanitizeData({text: '<script>x</script>'}, ['text'])
      expect(out.text).not.toMatch(/<script/i)
    })

    it('sanitizes multiple specified fields', () => {
      const out = sanitizeData({message: '<script>m</script>', body: '<script>b</script>'}, [
        'message',
        'body',
      ])
      expect(out.message).not.toMatch(/<script/i)
      expect(out.body).not.toMatch(/<script/i)
    })

    it('skips a field listed in dataItems but not present in data', () => {
      const out = sanitizeData({foo: 'bar'}, ['message'])
      expect(out).toEqual({foo: 'bar'})
    })

    it('skips a blank/empty field in dataItems', () => {
      const out = sanitizeData({message: ''}, ['message'])
      expect(out.message).toBe('')
    })
  })

  describe('XSS regressions', () => {
    it('strips <script> tags', () => {
      const out = sanitizeData({message: '<p>before<script>window.__x=1</script>after</p>'})
      expect(out.message).not.toMatch(/<script/i)
    })

    it('strips inline onerror handlers from img', () => {
      const out = sanitizeData({message: '<img src=x onerror="window.__x=1">'})
      expect(out.message).not.toMatch(/onerror/i)
      expectNoEventHandlersInField(out.message)
    })

    it('strips inline onload handlers from svg image', () => {
      const out = sanitizeData({
        message: '<svg><image href=x onload="window.__x=1"/></svg>',
      })
      expect(out.message).not.toMatch(/onload/i)
      expectNoEventHandlersInField(out.message)
    })

    it('strips inline onclick from anchor', () => {
      const out = sanitizeData({message: '<a href="#" onclick="window.__x=1">x</a>'})
      expect(out.message).not.toMatch(/onclick/i)
      expectNoEventHandlersInField(out.message)
    })

    it('strips inline onmouseover handlers', () => {
      const out = sanitizeData({message: '<div onmouseover="window.__x=1">x</div>'})
      expect(out.message).not.toMatch(/onmouseover/i)
      expectNoEventHandlersInField(out.message)
    })

    it('strips javascript: URIs from anchor href', () => {
      const out = sanitizeData({message: '<a href="javascript:window.__x=1">click</a>'})
      const a = parseField(out.message).querySelector('a')
      expect(a?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    })

    it('strips javascript: URIs from iframe src', () => {
      const out = sanitizeData({message: '<iframe src="javascript:window.__x=1"></iframe>'})
      const iframe = parseField(out.message).querySelector('iframe')
      expect(iframe?.getAttribute('src') ?? '').not.toMatch(/^javascript:/i)
    })

    it('does not promote a title-attribute breakout into a live event handler', () => {
      // mXSS class: a regex tokenizer can break the attribute boundary
      // when re-serializing, producing real DOM with a live handler.
      // DOMPurify's native-DOMParser path must not.
      const out = sanitizeData({
        message: '<p title="</p><img src=x onerror=\'window.__x=1\'>">visible</p>',
      })
      expectNoEventHandlersInField(out.message)
    })

    it('handles <noscript> double-decode payloads safely', () => {
      // TinyMCE 6.8.4 mXSS class: HTML entities double-decoded inside
      // <noscript>. DOMPurify's native parser handles this consistently.
      const out = sanitizeData({
        message: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">x</p></noscript>',
      })
      expectNoEventHandlersInField(out.message)
      expect(out.message).not.toMatch(/onerror/i)
    })

    it('handles conditional comments without leaking script content', () => {
      const out = sanitizeData({
        message: '<!--[if IE]><script>window.__x=1</script><![endif]-->',
      })
      expect(out.message).not.toMatch(/<script/i)
    })

    it('strips event handlers nested inside <svg><foreignObject>', () => {
      const out = sanitizeData({
        message: '<svg><foreignObject><img src=x onerror="window.__x=1"></foreignObject></svg>',
      })
      expectNoEventHandlersInField(out.message)
      expect(out.message).not.toMatch(/onerror/i)
    })

    it('strips srcdoc on iframe', () => {
      const out = sanitizeData({
        message: '<iframe srcdoc="<script>window.__x=1</script>"></iframe>',
      })
      const iframe = parseField(out.message).querySelector('iframe')
      expect(iframe?.hasAttribute('srcdoc')).toBe(false)
    })

    it('strips formaction javascript: URIs', () => {
      const out = sanitizeData({
        message: '<button formaction="javascript:window.__x=1">go</button>',
      })
      const button = parseField(out.message).querySelector('button')
      const formaction = button?.getAttribute('formaction') ?? ''
      expect(formaction).not.toMatch(/^javascript:/i)
    })
  })

  describe('content preservation (RCE-shaped output)', () => {
    it('preserves benign HTML', () => {
      const out = sanitizeData({message: '<h2>hi!</h2>'})
      expect(out.message).toBe('<h2>hi!</h2>')
    })

    it('preserves inline style attributes', () => {
      const out = sanitizeData({message: '<p style="color: red; font-size: 14px">hi</p>'})
      const p = parseField(out.message).querySelector('p')
      expect(p?.getAttribute('style')).toContain('color')
      expect(p?.getAttribute('style')).toContain('font-size')
    })

    it('preserves table structure with editor attributes', () => {
      const out = sanitizeData({
        message:
          '<table border="1" cellpadding="4" cellspacing="0"><tr><td width="100">x</td></tr></table>',
      })
      const table = parseField(out.message).querySelector('table')
      expect(table?.getAttribute('border')).toBe('1')
      expect(table?.getAttribute('cellpadding')).toBe('4')
      expect(table?.getAttribute('cellspacing')).toBe('0')
    })

    it('preserves a MathML equation', () => {
      const out = sanitizeData({
        message:
          '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>',
      })
      const doc = parseField(out.message)
      expect(doc.querySelector('math')).not.toBeNull()
      expect(doc.querySelector('mfrac')).not.toBeNull()
      expect(doc.querySelectorAll('mn')).toHaveLength(2)
    })

    it('preserves a Studio iframe embed', () => {
      const out = sanitizeData({
        message:
          '<iframe src="https://canvas.test/media_objects_iframe/m-abc" data-media-id="m-abc" data-media-type="video" allowfullscreen sandbox="allow-scripts allow-same-origin" allow="fullscreen" frameborder="0"></iframe>',
      })
      const iframe = parseField(out.message).querySelector('iframe')
      expect(iframe).not.toBeNull()
      expect(iframe?.getAttribute('data-media-id')).toBe('m-abc')
      expect(iframe?.getAttribute('data-media-type')).toBe('video')
      expect(iframe?.hasAttribute('allowfullscreen')).toBe(true)
      expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
      expect(iframe?.getAttribute('allow')).toBe('fullscreen')
      expect(iframe?.getAttribute('frameborder')).toBe('0')
    })

    it('preserves video element attributes', () => {
      const out = sanitizeData({
        message:
          '<video src="x.mp4" controls muted poster="p.png" playsinline width="640" height="360"></video>',
      })
      const v = parseField(out.message).querySelector('video')
      expect(v?.getAttribute('src')).toBe('x.mp4')
      expect(v?.hasAttribute('controls')).toBe(true)
      expect(v?.hasAttribute('muted')).toBe(true)
      expect(v?.getAttribute('poster')).toBe('p.png')
    })

    it('preserves audio element attributes', () => {
      const out = sanitizeData({message: '<audio src="x.mp3" controls muted></audio>'})
      const a = parseField(out.message).querySelector('audio')
      expect(a?.getAttribute('src')).toBe('x.mp3')
      expect(a?.hasAttribute('controls')).toBe(true)
      expect(a?.hasAttribute('muted')).toBe(true)
    })

    it('preserves aria-* attributes', () => {
      const out = sanitizeData({
        message: '<div aria-label="hello" aria-describedby="x">x</div>',
      })
      const div = parseField(out.message).querySelector('div')
      expect(div?.getAttribute('aria-label')).toBe('hello')
      expect(div?.getAttribute('aria-describedby')).toBe('x')
    })

    it('preserves data-* attributes', () => {
      const out = sanitizeData({
        message: '<a href="/x" data-api-endpoint="/api/v1/foo">x</a>',
      })
      const a = parseField(out.message).querySelector('a')
      expect(a?.getAttribute('data-api-endpoint')).toBe('/api/v1/foo')
    })

    it('removes only the unsafe portion of mixed content', () => {
      const out = sanitizeData({
        message: "<div>Don't remove me <script>console.log('remove me')</script></div>",
      })
      expect(out.message).toContain("Don't remove me")
      expect(out.message).not.toMatch(/<script/i)
    })
  })

  describe('edge cases', () => {
    it('returns empty string for an empty message field', () => {
      const out = sanitizeData({message: ''})
      expect(out.message).toBe('')
    })

    it('does not modify a falsy field', () => {
      const out = sanitizeData({message: null})
      expect(out.message).toBeNull()
    })
  })
})

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

// Regression coverage for stored XSS via the K5 course overview HTML
// rendering sink. The home page body is server-supplied HTML that lands
// in a `dangerouslySetInnerHTML` after going through
// `apiUserContent.convert`. CFA-864 wraps that sink with the shared
// DOMPurify wrapper as defense-in-depth: backend allowlisting treats
// attribute values as inert text, but downstream parse->serialize round
// trips can promote attribute payloads into real DOM and trigger XSS —
// DOMPurify at the sink defuses that.
//
// Strategy: we mock `apiUserContent.convert` to a passthrough so the
// hostile payload reaches the `dangerouslySetInnerHTML` unchanged. With
// the wrapper in place the rendered DOM has no event handlers, no
// <script>, and no `javascript:` href; without the wrapper the payload
// is live HTML.

import {render} from '@testing-library/react'
import React from 'react'

vi.mock('@canvas/util/jquery/apiUserContent', () => ({
  // pass through unchanged so the test exercises the sink wrapper
  default: {convert: (html: string) => html},
}))

vi.mock('@canvas/immersive-reader/ImmersiveReader', () => ({
  ImmersiveReaderButton: () => null,
}))

import OverviewPage from '../OverviewPage'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildProps = (content: string) => ({
  content,
  url: '/courses/12/pages/home/edit',
  canEdit: false,
  showImmersiveReader: false,
})

describe('OverviewPage — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from rendered overview HTML', () => {
    const payload = '<p>hello <img src=x onerror="window.__xss_fired = true"> world</p>'
    const {container} = render(<OverviewPage {...buildProps(payload)} />)

    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from rendered overview HTML', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const {container} = render(<OverviewPage {...buildProps(payload)} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from rendered overview HTML', () => {
    const payload = '<p><a href="javascript:window.__xss_fired = true">click</a></p>'
    const {container} = render(<OverviewPage {...buildProps(payload)} />)

    const anchors = Array.from(container.querySelectorAll('a'))
    anchors.forEach(a => {
      expect((a.getAttribute('href') ?? '').toLowerCase()).not.toMatch(/^javascript:/)
    })
    expect(container.innerHTML.toLowerCase()).not.toContain('javascript:')
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves benign formatting and safe links', () => {
    const payload = '<p><strong>bold</strong> and <a href="https://example.com">link</a></p>'
    const {container} = render(<OverviewPage {...buildProps(payload)} />)

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('https://example.com')
    expectNoEventHandlers(container)
  })
})

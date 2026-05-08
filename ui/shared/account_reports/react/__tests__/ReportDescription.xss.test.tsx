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

// Regression coverage for stored XSS via the ReportDescription
// `descHTML` sink. Account-report descriptions arrive as server-rendered
// HTML strings and land in a `dangerouslySetInnerHTML`. CFA-865 wraps
// that sink with the shared DOMPurify wrapper as defense-in-depth:
// backend allowlisting treats attribute values as inert text, but
// downstream React render of that string can revive event handlers and
// scripts — DOMPurify at the sink defuses that.

import {render} from '@testing-library/react'
import ReportDescription from '../ReportDescription'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const baseProps = {
  title: 'Report Title',
  closeModal: vi.fn(),
}

describe('ReportDescription — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from rendered description HTML', () => {
    const payload = '<p>hello <img src=x onerror="window.__xss_fired = true"> world</p>'
    const {baseElement} = render(<ReportDescription {...baseProps} descHTML={payload} />)

    expectNoEventHandlers(baseElement)
    expect(baseElement.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from rendered description HTML', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const {baseElement} = render(<ReportDescription {...baseProps} descHTML={payload} />)

    expect(baseElement.querySelector('script')).toBeNull()
    expect(baseElement.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: URIs from rendered description HTML', () => {
    const payload = '<p><a href="javascript:window.__xss_fired = true">click</a></p>'
    const {baseElement} = render(<ReportDescription {...baseProps} descHTML={payload} />)

    const link = baseElement.querySelector('a')
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting tags and safe links unchanged', () => {
    const payload = '<p><strong>bold</strong> and <a href="https://example.com">a link</a></p>'
    const {baseElement} = render(<ReportDescription {...baseProps} descHTML={payload} />)

    expect(baseElement.querySelector('strong')?.textContent).toBe('bold')
    expect(baseElement.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expectNoEventHandlers(baseElement)
  })
})

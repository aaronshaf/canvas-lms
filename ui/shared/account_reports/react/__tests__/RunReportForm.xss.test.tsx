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

// Regression coverage for stored XSS via the RunReportForm `formHTML`
// sink. Account-report parameter forms arrive as server-rendered HTML
// strings and land in a `dangerouslySetInnerHTML`. CFA-865 wraps that
// sink with the shared DOMPurify wrapper as defense-in-depth: backend
// allowlisting treats attribute values as inert text, but downstream
// React render of that string can revive event handlers and scripts —
// DOMPurify at the sink defuses that.

import {render} from '@testing-library/react'
import RunReportForm from '../RunReportForm'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const baseProps = {
  path: '/api/fake_post',
  reportName: 'test_report_csv',
  closeModal: vi.fn(),
  onSuccess: vi.fn(),
}

describe('RunReportForm — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from rendered form HTML', () => {
    const payload =
      '<form><img src=x onerror="window.__xss_fired = true"><input type="text" name="x" /></form>'
    const {baseElement: container} = render(<RunReportForm {...baseProps} formHTML={payload} />)

    expectNoEventHandlers(container)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from rendered form HTML', () => {
    const payload =
      '<form><script>window.__xss_fired = true</script><input type="text" name="x" /></form>'
    const {baseElement: container} = render(<RunReportForm {...baseProps} formHTML={payload} />)

    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: URIs from rendered form HTML', () => {
    const payload =
      '<form><a href="javascript:window.__xss_fired = true" data-testid="bad-link">click</a></form>'
    const {baseElement: container} = render(<RunReportForm {...baseProps} formHTML={payload} />)

    const link = container.querySelector('a')
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting tags and safe links unchanged', () => {
    const payload =
      '<form><strong>bold</strong> <a href="https://example.com">link</a><input type="text" name="x" /></form>'
    const {baseElement: container} = render(<RunReportForm {...baseProps} formHTML={payload} />)

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(container.querySelector('input[name="x"]')).not.toBeNull()
    expectNoEventHandlers(container)
  })
})

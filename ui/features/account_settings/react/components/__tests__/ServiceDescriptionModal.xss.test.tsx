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

// Regression coverage for the ServiceDescriptionModal innerHTML sink.
// `props.descHTML` is admin-supplied (account-level service description)
// and lands directly in a `dangerouslySetInnerHTML`. A tricked admin or
// stored content carrying an old payload could deliver hostile HTML.
// CFA-872 wraps that sink with the shared DOMPurify wrapper so event
// handlers, <script>, and javascript: URIs are stripped at the sink.

import {render} from '@testing-library/react'
import React from 'react'
import ServiceDescriptionModal from '../ServiceDescriptionModal'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderModal = (descHTML: string) =>
  render(
    <ServiceDescriptionModal
      descHTML={descHTML}
      serviceTitle="Google Docs"
      closeModal={() => {}}
    />,
  )

describe('ServiceDescriptionModal — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from descHTML', () => {
    const payload = '<p>hello <img src=x onerror="window.__xss_fired = true"> world</p>'
    const {baseElement} = renderModal(payload)

    expectNoEventHandlers(baseElement as HTMLElement)
    expect(baseElement.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from descHTML', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const {baseElement} = renderModal(payload)

    expect(baseElement.querySelector('script')).toBeNull()
    expect(baseElement.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from descHTML', () => {
    const payload = '<p><a href="javascript:window.__xss_fired = true">click me</a></p>'
    const {baseElement} = renderModal(payload)

    baseElement.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') ?? ''
      expect(href.toLowerCase()).not.toMatch(/^\s*javascript:/)
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting and anchors unchanged', () => {
    const payload = '<p><strong>bold</strong> see <a href="https://example.com">docs</a></p>'
    const {baseElement} = renderModal(payload)

    expect(baseElement.querySelector('strong')?.textContent).toBe('bold')
    const safeAnchor = Array.from(baseElement.querySelectorAll('a')).find(
      a => a.getAttribute('href') === 'https://example.com',
    )
    expect(safeAnchor?.textContent).toBe('docs')
    expectNoEventHandlers(baseElement as HTMLElement)
  })
})

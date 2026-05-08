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

// Regression coverage for stored mXSS via the delivered-messages tab
// renderer. Message reads innerHTML from a server-rendered ERB element
// and re-emits it through dangerouslySetInnerHTML — the same
// innerHTML round-trip pattern that fired the May 2026 discussion
// incident. CFA-893 wraps the sink with @canvas/sanitize-html as
// defense-in-depth.

import React from 'react'
import {render, cleanup} from '@testing-library/react'
import Message from '../Message'

vi.mock('@canvas/do-fetch-api-effect', () => ({
  default: vi.fn(),
}))
vi.mock('@instructure/platform-alerts', () => ({
  showFlashError: () => () => {},
  showFlashSuccess: () => () => {},
}))

const buildElement = ({
  metadata = '<div>from</div>',
  plain = 'plain text',
  html = '<p>hello</p>',
}: {
  metadata?: string
  plain?: string
  html?: string
} = {}) => {
  const el = document.createElement('div')
  el.innerHTML = `
    <div class="message-meta-data">${metadata}</div>
    <div class="message-plain">${plain}</div>
    <div class="message-html">${html}</div>
  `
  return el
}

const baseProps = (element: HTMLElement) => ({
  element,
  messageId: '1',
  secureId: 's',
  workflowState: 'sent',
  subject: 'Subject',
  userId: '42',
})

describe('Message — XSS regression', () => {
  afterEach(() => {
    cleanup()
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from the HTML tab body', () => {
    const element = buildElement({
      html: '<p>before <img src=x onerror="window.__xss_fired = true"> after</p>',
    })
    const {container} = render(<Message {...baseProps(element)} />)
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the HTML tab body', () => {
    const element = buildElement({
      html: '<p>before</p><script>window.__xss_fired = true</script><p>after</p>',
    })
    const {container} = render(<Message {...baseProps(element)} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from the HTML tab body', () => {
    const element = buildElement({
      html: '<p><a href="javascript:window.__xss_fired = true">click</a></p>',
    })
    const {container} = render(<Message {...baseProps(element)} />)
    const anchors = container.querySelectorAll('a')
    anchors.forEach(a => {
      expect(a.getAttribute('href') || '').not.toMatch(/^javascript:/i)
    })
    expect(container.innerHTML).not.toMatch(/javascript:/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })
})

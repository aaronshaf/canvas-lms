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

// Regression coverage for the SimilarityPledge dangerouslySetInnerHTML sink
// at the `comments` prop. `comments` flows from server-side similarity-
// detection LTI tool config (`pledgeSettings.COMMENTS`) and is consumed
// across the full assignment-submission surface. Defense-in-depth requires
// that no script tag, event handler, or javascript: href survives in the
// rendered DOM. The shared @canvas/sanitize-html (DOMPurify) helper is the
// final pass at the sink.

import React from 'react'
import {render} from '@testing-library/react'
import SimilarityPledge from '../SimilarityPledge'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithComments = (comments: string) =>
  render(
    <SimilarityPledge
      pledgeText="I pledge"
      setShouldShowPledgeError={() => ({})}
      comments={comments}
    />,
  )

describe('SimilarityPledge — XSS regression at comments sink', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from malicious comments HTML', () => {
    const malicious = '<p>hi <img src=x onerror="window.__xss_fired = true"></p>'
    const {getByTestId} = renderWithComments(malicious)
    const sink = getByTestId('similarity-pledge-comments')
    expectNoEventHandlers(sink)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from malicious comments HTML', () => {
    const malicious = '<p>before<script>window.__xss_fired = true</script>after</p>'
    const {getByTestId} = renderWithComments(malicious)
    const sink = getByTestId('similarity-pledge-comments')
    expect(sink.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from malicious comments HTML', () => {
    const malicious = '<p><a href="javascript:window.__xss_fired=true">click</a></p>'
    const {getByTestId} = renderWithComments(malicious)
    const sink = getByTestId('similarity-pledge-comments')
    sink.querySelectorAll('a').forEach(anchor => {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves benign formatting in comments HTML', () => {
    const benign = '<p>Please review the <strong>tool terms</strong> before submitting.</p>'
    const {getByTestId} = renderWithComments(benign)
    const sink = getByTestId('similarity-pledge-comments')
    expect(sink.querySelector('strong')?.textContent).toBe('tool terms')
    expect(sink.textContent).toContain('Please review the')
  })
})

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

// Regression coverage for an XSS class against
// IntegrationDetailModal's `props.content` sink.
//
// `content` is a tool-provider-supplied integration-resource body that
// renders via `dangerouslySetInnerHTML`. Without sanitization, a hostile
// provider could place event-handler attributes, <script> tags, or
// `javascript:` URIs in their content and have them activate when an
// admin opens the implementation detail modal.

import React from 'react'
import {render} from '@testing-library/react'
import IntegrationDetailModal from '../IntegrationDetailModal'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement | Document) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const MALICIOUS_CONTENT =
  '<img src=x onerror="window.__xss_fired=true">' +
  '<script>window.__xss_fired=true</script>' +
  '<a href="javascript:window.__xss_fired=true">click</a>'

describe('IntegrationDetailModal — XSS regression (content)', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips event-handler attributes from content', () => {
    render(
      <IntegrationDetailModal
        title="Integration"
        content={MALICIOUS_CONTENT}
        isModalOpen={true}
        setModalOpen={() => {}}
      />,
    )
    // Modal renders to a portal — assert against the entire document.
    expectNoEventHandlers(document.body)
  })

  it('does not render <script> children from content', () => {
    render(
      <IntegrationDetailModal
        title="Integration"
        content={MALICIOUS_CONTENT}
        isModalOpen={true}
        setModalOpen={() => {}}
      />,
    )
    expect(document.body.querySelector('script')).toBeNull()
  })

  it('does not let javascript: URIs survive', () => {
    render(
      <IntegrationDetailModal
        title="Integration"
        content={MALICIOUS_CONTENT}
        isModalOpen={true}
        setModalOpen={() => {}}
      />,
    )
    document.body.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || ''
      expect(href.toLowerCase()).not.toMatch(/^\s*javascript:/)
    })
  })

  it('does not fire window.__xss_fired when rendering the malicious payload', () => {
    render(
      <IntegrationDetailModal
        title="Integration"
        content={MALICIOUS_CONTENT}
        isModalOpen={true}
        setModalOpen={() => {}}
      />,
    )
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves legitimate markup like <strong> and safe <a href> (control)', () => {
    const benign = 'hello <strong>bold</strong> <a href="https://example.com">link</a>'
    render(
      <IntegrationDetailModal
        title="Integration"
        content={benign}
        isModalOpen={true}
        setModalOpen={() => {}}
      />,
    )
    const strong = document.body.querySelector('strong')
    expect(strong?.textContent).toBe('bold')
    // Find an anchor whose href is the example.com URL (the modal also
    // renders other anchors for chrome).
    const exampleLink = Array.from(document.body.querySelectorAll('a')).find(
      a => a.getAttribute('href') === 'https://example.com',
    )
    expect(exampleLink).toBeDefined()
  })
})

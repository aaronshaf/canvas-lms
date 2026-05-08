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
// LtiConfigurationDetail's `props.integrationData.description` sink.
//
// The Lti integration `description` field renders into the page via
// `dangerouslySetInnerHTML`. A tool provider's description is attacker-
// influenced text, and there is no inherent guarantee that backend
// allowlisting (or absence thereof) keeps event handlers / scripts /
// javascript: URIs out of the rendered DOM. The "safety" assertion here
// is "no event handler attribute survives, no <script> child renders,
// window.__xss_fired stays undefined" — DOMPurify legitimately permits
// some tags (e.g. <img>) but strips on* handlers, so a tag may appear
// while remaining inert.

import React from 'react'
import {render} from '@testing-library/react'
import LtiConfigurationDetail from '../LtiConfigurationDetail'
import type {Lti} from '../../../models/Product'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const MALICIOUS_DESCRIPTION =
  '<img src=x onerror="window.__xss_fired=true">' +
  '<script>window.__xss_fired=true</script>' +
  '<a href="javascript:window.__xss_fired=true">click</a>'

const buildIntegrationData = (description: string): Lti => ({
  id: 12,
  integration_type: 'lti_13_dynamic_registration',
  description,
  lti_placements: ['placement-1'],
  lti_services: ['service-1'],
  url: 'https://example.com',
  unified_tool_id: 'uti-1',
})

describe('LtiConfigurationDetail — XSS regression (integrationData.description)', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips event-handler attributes from the description', () => {
    const {container} = render(
      <LtiConfigurationDetail
        integrationData={buildIntegrationData(MALICIOUS_DESCRIPTION)}
        badges={[]}
      />,
    )
    expectNoEventHandlers(container)
  })

  it('does not render <script> children from the description', () => {
    const {container} = render(
      <LtiConfigurationDetail
        integrationData={buildIntegrationData(MALICIOUS_DESCRIPTION)}
        badges={[]}
      />,
    )
    expect(container.querySelector('script')).toBeNull()
  })

  it('does not let javascript: URIs survive', () => {
    const {container} = render(
      <LtiConfigurationDetail
        integrationData={buildIntegrationData(MALICIOUS_DESCRIPTION)}
        badges={[]}
      />,
    )
    container.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || ''
      expect(href.toLowerCase()).not.toMatch(/^\s*javascript:/)
    })
  })

  it('does not fire window.__xss_fired when rendering the malicious payload', () => {
    render(
      <LtiConfigurationDetail
        integrationData={buildIntegrationData(MALICIOUS_DESCRIPTION)}
        badges={[]}
      />,
    )
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves legitimate markup like <strong> and safe <a href> (control)', () => {
    const benign = 'hello <strong>bold</strong> <a href="https://example.com">link</a>'
    const {container} = render(
      <LtiConfigurationDetail integrationData={buildIntegrationData(benign)} badges={[]} />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('https://example.com')
  })
})

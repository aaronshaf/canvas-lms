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

// Regression coverage for an XSS class against the
// `integration_resources.comments` sink in ProductDetail.
//
// Tool providers may supply implementation-resource comments that render
// through `dangerouslySetInnerHTML`. Without sanitization a hostile or
// careless provider could place event-handler attributes, <script>
// children, or `javascript:` URIs in their comments. The "safety"
// assertion is "no event handler attribute survives, no <script> child
// renders, window.__xss_fired stays undefined" — DOMPurify legitimately
// permits some tags (e.g. <img>) but strips on* handlers, so a tag may
// appear while remaining inert.

import React from 'react'
import {render} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import type {Product} from '../../../models/Product'

const buildProduct = (commentsHtml: string): Product => ({
  id: '1',
  global_product_id: '1',
  name: 'Test Product',
  company: {id: 1, name: 'Acme', company_url: 'https://acme.example'},
  logo_url: 'https://example.com/logo.png',
  tagline: 'Tagline',
  description: 'Description',
  updated_at: '2026-01-01',
  canvas_lti_configurations: [],
  tool_integration_configurations: {lti_11: [], lti_13: []},
  privacy_and_security_badges: [],
  accessibility_badges: [],
  integration_badges: [],
  screenshots: [],
  terms_of_service_url: 'https://tos.example',
  privacy_policy_url: 'https://privacy.example',
  accessibility_url: 'https://accessibility.example',
  support_url: 'https://support.example',
  tags: [],
  integration_resources: {
    comments: commentsHtml,
    resources: [{name: 'Resource', description: 'desc', content: 'content'}],
  },
})

vi.mock('../../../queries/useProduct', () => ({
  default: vi.fn(),
}))
vi.mock('../../../queries/useSimilarProducts', () => ({
  default: vi.fn(() => ({otherProductsByCompany: {tools: []}})),
}))
vi.mock('../../../queries/useInstallStatus', () => ({
  default: vi.fn(() => ({data: null, isLoading: false})),
}))
vi.mock('../../../../../breadcrumbs/useAppendBreadcrumb', () => ({
  useAppendBreadcrumb: vi.fn(),
}))

import useProduct from '../../../queries/useProduct'
import ProductDetail from '../ProductDetail'

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

const expectNoEventHandlers = (root: HTMLElement | Document) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const MALICIOUS_COMMENTS =
  '<img src=x onerror="window.__xss_fired=true">' +
  '<script>window.__xss_fired=true</script>' +
  '<a href="javascript:window.__xss_fired=true">click</a>'

const renderWithComments = (commentsHtml: string) => {
  ;(useProduct as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    product: buildProduct(commentsHtml),
    isLoading: false,
    isError: false,
  })
  return render(
    <MemoryRouter initialEntries={['/product_detail/1']}>
      <ProductDetail />
    </MemoryRouter>,
  )
}

describe('ProductDetail — XSS regression (integration_resources.comments)', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
    vi.clearAllMocks()
  })

  it('strips event-handler attributes from comments', () => {
    const {container} = renderWithComments(MALICIOUS_COMMENTS)
    expectNoEventHandlers(container)
  })

  it('does not render <script> children from comments', () => {
    const {container} = renderWithComments(MALICIOUS_COMMENTS)
    expect(container.querySelector('script')).toBeNull()
  })

  it('does not let javascript: URIs survive in comments', () => {
    const {container} = renderWithComments(MALICIOUS_COMMENTS)
    container.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || ''
      expect(href.toLowerCase()).not.toMatch(/^\s*javascript:/)
    })
  })

  it('does not fire window.__xss_fired when rendering malicious comments', () => {
    renderWithComments(MALICIOUS_COMMENTS)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves legitimate markup like <strong> and safe <a href> (control)', () => {
    const benign = 'hi <strong>bold</strong> <a href="https://example.com">link</a>'
    const {container} = renderWithComments(benign)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    const exampleLink = Array.from(container.querySelectorAll('a')).find(
      a => a.getAttribute('href') === 'https://example.com',
    )
    expect(exampleLink).toBeDefined()
  })
})

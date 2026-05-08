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

// Regression coverage for XSS via the AUP (Acceptable Use Policy) HTML body.
// The /api/v1/acceptable_use_policy endpoint can return admin-authored HTML
// that gets injected via dangerouslySetInnerHTML. DOMPurify at the sink must
// strip <script> tags and inline event handlers even when the upstream content
// contains them.
//
// Safety assertion: no on*= attribute survives in the rendered DOM, and no
// <script> tag is rendered as a real DOM element.

import React from 'react'
import $ from 'jquery'
import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import TermsOfServiceModal from '../TermsOfServiceModal'
import fakeENV from '@canvas/test-utils/fakeENV'

vi.mock('@canvas/util/globalUtils', async () => {
  const actual = await vi.importActual('@canvas/util/globalUtils')
  return {...actual, openWindow: vi.fn()}
})

const server = setupServer()

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('TermsOfServiceModal — XSS regression', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    vi.clearAllMocks()
    fakeENV.setup({
      TERMS_OF_SERVICE_CUSTOM_CONTENT: 'Hello World',
    })
    $('#fixtures').html('<div id="main">')
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    server.resetHandlers()
    cleanup()
    $('#fixtures').empty()
    fakeENV.teardown()
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from AUP content', async () => {
    server.use(
      http.get('/api/v1/acceptable_use_policy', () =>
        HttpResponse.json({
          content: '<p>visible</p>' + '<img src=x onerror="window.__xss_fired = true">',
        }),
      ),
    )

    render(<TermsOfServiceModal />)
    screen.getByTestId('tos-link').click()
    const modal = await screen.findByTestId('tos-modal')

    // benign content still renders
    expect(screen.getByText('visible')).toBeInTheDocument()

    // no event handlers survived sanitization in the modal subtree
    expectNoEventHandlers(modal)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from AUP content', async () => {
    const scriptSpy = vi.fn()
    ;(window as any).__xss_script_fired = scriptSpy

    server.use(
      http.get('/api/v1/acceptable_use_policy', () =>
        HttpResponse.json({
          content:
            '<p>policy text</p>' +
            '<script>window.__xss_script_fired && window.__xss_script_fired()</script>',
        }),
      ),
    )

    render(<TermsOfServiceModal />)
    screen.getByTestId('tos-link').click()
    const modal = await screen.findByTestId('tos-modal')

    expect(screen.getByText('policy text')).toBeInTheDocument()
    // no <script> element was injected into the modal subtree
    expect(modal.querySelector('script')).toBeNull()
    expect(scriptSpy).not.toHaveBeenCalled()

    delete (window as any).__xss_script_fired
  })

  it('renders benign formatting safely', async () => {
    server.use(
      http.get('/api/v1/acceptable_use_policy', () =>
        HttpResponse.json({
          content: '<p><strong>Important</strong> policy text with <em>emphasis</em>.</p>',
        }),
      ),
    )

    render(<TermsOfServiceModal />)
    screen.getByTestId('tos-link').click()
    const modal = await screen.findByTestId('tos-modal')

    // formatting tags survive sanitization
    expect(modal.querySelector('strong')).not.toBeNull()
    expect(modal.querySelector('em')).not.toBeNull()
    expectNoEventHandlers(modal)
  })
})

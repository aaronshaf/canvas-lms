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

// Regression coverage for stored XSS via the AcceptableUsePolicy
// dangerouslySetInnerHTML sink. The AUP content arrives from the AUP
// API; CFA-870 wraps it with the shared @canvas/sanitize-html DOMPurify
// wrapper as defense-in-depth. Hostile HTML reaching the sink must lose
// script tags, inline event handlers, and javascript: URIs before
// landing in the DOM.

import React from 'react'
import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import AcceptableUsePolicy from '../AcceptableUsePolicy'
import {useLocation, useNavigate, useNavigationType} from 'react-router-dom'

vi.mock('@instructure/platform-alerts')

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: vi.fn(),
  useNavigationType: vi.fn(),
  useLocation: vi.fn(),
}))

vi.mock('@canvas/util/globalUtils', () => ({
  assignLocation: vi.fn(),
}))

const server = setupServer()

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const expectNoJavascriptHrefs = (root: HTMLElement) => {
  root.querySelectorAll('[href]').forEach(el => {
    const href = el.getAttribute('href') ?? ''
    expect(href.toLowerCase().replace(/\s+/g, '')).not.toMatch(/^javascript:/)
  })
}

describe('AcceptableUsePolicy — XSS regression', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useNavigate as any).mockReturnValue(vi.fn())
    ;(useNavigationType as any).mockReturnValue('PUSH')
    ;(useLocation as any).mockReturnValue({key: 'default'})
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    server.resetHandlers()
    cleanup()
    delete (window as any).__xss_fired
  })

  it('strips <script>, event handlers, and javascript: hrefs from API content', async () => {
    const payload =
      '<p>before</p>' +
      '<img src=x onerror="window.__xss_fired = true">' +
      '<script>window.__xss_fired = true</script>' +
      '<a href="javascript:window.__xss_fired = true">click</a>' +
      '<p>after</p>'
    server.use(
      http.get('/api/v1/acceptable_use_policy', () => HttpResponse.json({content: payload})),
    )
    render(<AcceptableUsePolicy />)
    const aup = await waitFor(() => screen.getByTestId('aup-content'))

    expect(aup.querySelector('script')).toBeNull()
    expect(aup.innerHTML).not.toMatch(/<script/i)
    expectNoEventHandlers(aup)
    expectNoJavascriptHrefs(aup)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting tags unchanged', async () => {
    server.use(
      http.get('/api/v1/acceptable_use_policy', () =>
        HttpResponse.json({
          content: '<p><strong>bold</strong> and <em>italic</em></p>',
        }),
      ),
    )
    render(<AcceptableUsePolicy />)
    const aup = await waitFor(() => screen.getByTestId('aup-content'))

    expect(aup.querySelector('strong')?.textContent).toBe('bold')
    expect(aup.querySelector('em')?.textContent).toBe('italic')
    expectNoEventHandlers(aup)
  })
})

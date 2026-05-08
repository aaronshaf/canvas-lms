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

// Regression coverage for stored XSS via the SyllabusRevisionsTray
// `innerHTML` sinks. When previewing or restoring a revision the tray
// writes `version.syllabus_body` (and the cached current body) directly
// into `#course_syllabus.innerHTML`. CFA-858 wraps both sinks with the
// shared `@canvas/sanitize-html` DOMPurify wrapper as defense-in-depth
// on top of backend `CanvasSanitize` — a stored payload that survives
// the backend (or arrives via a future API regression) must still be
// defanged at the sink.

import React from 'react'
import {render, fireEvent, waitFor, cleanup} from '@testing-library/react'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import {vi} from 'vitest'
import SyllabusRevisionsTray from '../SyllabusRevisionsTray'

const server = setupServer()

vi.mock('@instructure/platform-alerts', () => ({
  showFlashAlert: vi.fn(),
  showFlashError: vi.fn(() => vi.fn()),
}))
vi.mock('@canvas/rce/RichContentEditor', () => ({
  default: {
    callOnRCE: vi.fn(),
  },
}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildVersions = (payload: string) => [
  {
    version: 2,
    created_at: '2025-01-02T00:00:00Z',
    syllabus_body: '<p>Current</p>',
    edited_by: {id: 1, name: 'Latest'},
  },
  {
    version: 1,
    created_at: '2025-01-01T00:00:00Z',
    syllabus_body: payload,
    edited_by: {id: 2, name: 'Attacker'},
  },
]

describe('SyllabusRevisionsTray — XSS regression', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    cleanup()
    document.body.innerHTML = ''
    delete (window as any).__xss_fired
  })
  afterAll(() => server.close())

  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers when previewing a revision', async () => {
    document.body.innerHTML = '<div id="course_syllabus"><p>Current</p></div>'
    const payload = '<p>v1 <img src=x onerror="window.__xss_fired = true"></p>'
    server.use(
      http.get('/api/v1/courses/123', () =>
        HttpResponse.json({syllabus_versions: buildVersions(payload)}),
      ),
    )

    render(<SyllabusRevisionsTray courseId="123" open={true} onDismiss={vi.fn()} />)

    await waitFor(() => {
      expect(document.querySelector('[data-testid="version-1"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-testid="version-1"]') as Element)

    const syllabus = document.getElementById('course_syllabus') as HTMLElement
    expectNoEventHandlers(syllabus)
    expect(syllabus.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags when previewing a revision', async () => {
    document.body.innerHTML = '<div id="course_syllabus"><p>Current</p></div>'
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    server.use(
      http.get('/api/v1/courses/123', () =>
        HttpResponse.json({syllabus_versions: buildVersions(payload)}),
      ),
    )

    render(<SyllabusRevisionsTray courseId="123" open={true} onDismiss={vi.fn()} />)

    await waitFor(() => {
      expect(document.querySelector('[data-testid="version-1"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-testid="version-1"]') as Element)

    const syllabus = document.getElementById('course_syllabus') as HTMLElement
    expect(syllabus.querySelector('script')).toBeNull()
    expect(syllabus.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs when previewing a revision', async () => {
    document.body.innerHTML = '<div id="course_syllabus"><p>Current</p></div>'
    const payload = '<p><a href="javascript:window.__xss_fired = true">click</a></p>'
    server.use(
      http.get('/api/v1/courses/123', () =>
        HttpResponse.json({syllabus_versions: buildVersions(payload)}),
      ),
    )

    render(<SyllabusRevisionsTray courseId="123" open={true} onDismiss={vi.fn()} />)

    await waitFor(() => {
      expect(document.querySelector('[data-testid="version-1"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-testid="version-1"]') as Element)

    const syllabus = document.getElementById('course_syllabus') as HTMLElement
    const anchor = syllabus.querySelector('a')
    if (anchor) {
      expect(anchor.getAttribute('href') || '').not.toMatch(/^javascript:/i)
    }
    expect(syllabus.innerHTML).not.toMatch(/javascript:/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting tags unchanged', async () => {
    document.body.innerHTML = '<div id="course_syllabus"><p>Current</p></div>'
    const payload = '<p><strong>bold</strong> and <em>italic</em></p>'
    server.use(
      http.get('/api/v1/courses/123', () =>
        HttpResponse.json({syllabus_versions: buildVersions(payload)}),
      ),
    )

    render(<SyllabusRevisionsTray courseId="123" open={true} onDismiss={vi.fn()} />)

    await waitFor(() => {
      expect(document.querySelector('[data-testid="version-1"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-testid="version-1"]') as Element)

    const syllabus = document.getElementById('course_syllabus') as HTMLElement
    expect(syllabus.querySelector('strong')?.textContent).toBe('bold')
    expect(syllabus.querySelector('em')?.textContent).toBe('italic')
    expectNoEventHandlers(syllabus)
  })
})

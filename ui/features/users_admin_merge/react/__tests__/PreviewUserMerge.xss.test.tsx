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

// Regression coverage for the PreviewUserMerge dangerouslySetInnerHTML sink.
// The sink renders an I18n-templated description string (currently a static
// translation, but localized strings can drift / get corrupted, and the sink
// is also a likely target for future template additions that interpolate
// user-controlled data). The new @canvas/sanitize-html wrapper is the
// last-line defense.
//
// To isolate that wrapper's signal, this test mocks @canvas/i18n to return a
// malicious raw HTML string for the template — simulating the case where
// upstream escaping is bypassed.

import {render, screen} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'

const malicious =
  '<img src=x onerror="window.__xss_fired = true"><script>window.__xss_fired = true</script><b>bold</b>'

vi.mock('@canvas/i18n', () => {
  const interpolate = (str: string, opts: Record<string, string> = {}) =>
    str.replace(/%\{(\w+)\}/g, (_, key) => (opts[key] != null ? String(opts[key]) : ''))
  const scope = {
    t: (key: string, opts?: Record<string, string>) => {
      // The PreviewUserMerge sink template starts with this distinctive prefix.
      if (typeof key === 'string' && key.startsWith('This process will consolidate')) {
        return malicious
      }
      return interpolate(key, opts ?? {})
    },
  }
  return {
    useScope: () => scope,
  }
})

import PreviewUserMerge, {type PreviewMergeProps} from '../PreviewUserMerge'
import {sourceUser, destinationUser} from './test-data'

const server = setupServer()

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('PreviewUserMerge — XSS regression (description template)', () => {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })

  const renderComponent = () => {
    const props: PreviewMergeProps = {
      currentUserId: '1',
      sourceUserId: sourceUser.id,
      destinationUserId: destinationUser.id,
      onSwap: vi.fn(),
      onStartOver: vi.fn(),
    }
    return render(
      <QueryClientProvider client={queryClient}>
        <PreviewUserMerge {...props} />
      </QueryClientProvider>,
    )
  }

  beforeAll(() => {
    server.listen()
    if (!Array.prototype.toSorted) {
      // toSorted polyfill for Node < 20.11
      // eslint-disable-next-line no-extend-native
      Array.prototype.toSorted = function () {
        return this.sort((a, b) => String(a).localeCompare(String(b)))
      }
    }
    queryClient.setQueryData(['users', sourceUser.id], sourceUser)
    queryClient.setQueryData(['users', destinationUser.id], destinationUser)
  })
  afterEach(() => {
    server.resetHandlers()
    delete (window as any).__xss_fired
  })
  afterAll(() => {
    server.close()
    queryClient.clear()
  })

  beforeEach(() => {
    server.use(
      http.get(`/users/${sourceUser.id}/user_for_merge`, () => HttpResponse.json(sourceUser)),
      http.get(`/users/${destinationUser.id}/user_for_merge`, () =>
        HttpResponse.json(destinationUser),
      ),
    )
  })

  it('strips inline event handlers and <script> tags from the description', async () => {
    const {container} = renderComponent()
    // wait for the component to actually render past its loading guard
    await screen.findAllByText(/Source account/i)
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves benign formatting (bold tags survive sanitization)', async () => {
    const {container} = renderComponent()
    await screen.findAllByText(/Source account/i)
    expect(container.querySelector('b')).not.toBeNull()
  })
})

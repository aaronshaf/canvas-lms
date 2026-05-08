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

// Regression coverage for the FindUserToMerge dangerouslySetInnerHTML sink
// that interpolates the source user's name into a templated message.
//
// In production, `I18n.t` html-escapes interpolations whenever `wrappers`
// is used — so a `sourceUser.name = '<script>'` payload would be
// neutralized upstream and the test could not distinguish a missing
// sanitizer from the working one. To isolate the @canvas/sanitize-html
// wrapper at the sink, this test mocks @canvas/i18n with a scope whose
// `t()` applies wrappers but performs naive interpolation without
// escaping — simulating a future regression where the i18n layer's
// escaping is bypassed (e.g. raw()/SafeString interpolation, or a
// translation table containing a wrapper that breaks attribute
// boundaries). DOMPurify is then the only line of defense.

import {render, screen} from '@testing-library/react'
import {QueryClient} from '@tanstack/react-query'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'

vi.mock('@canvas/i18n', () => {
  const t = (template: string, opts: Record<string, any> = {}) => {
    const {wrappers, ...vars} = opts
    let str = template
    if (Array.isArray(wrappers) && typeof wrappers[0] === 'string') {
      const wrapper = wrappers[0]
      str = str.replace(/\*(.+?)\*/g, (_, inner) => wrapper.replace('$1', inner))
    }
    return str.replace(/%\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''))
  }
  return {
    useScope: () => ({t}),
  }
})

import FindUserToMerge, {type FindUserToMergeProps} from '../FindUserToMerge'
import {MockedQueryClientProvider} from '@canvas/test-utils/query'

const server = setupServer()

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('FindUserToMerge — XSS regression (source user name interpolation)', () => {
  const accountSelectOptions = [{id: '1', name: 'Account 1'}]
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })

  const renderWithName = (name: string, email = 'user@example.com') => {
    const sourceUserId = '99'
    server.use(
      http.get(`/users/${sourceUserId}/user_for_merge`, () =>
        HttpResponse.json({
          id: sourceUserId,
          name,
          email,
          short_name: name,
          integration_id: null,
          sis_user_id: null,
          login_id: null,
          communication_channels: [],
          pseudonyms: [],
          enrollments: [],
        }),
      ),
    )
    const props: FindUserToMergeProps = {
      sourceUserId,
      accountSelectOptions,
      onFind: vi.fn(),
    }
    return render(
      <MockedQueryClientProvider client={queryClient}>
        <FindUserToMerge {...props} />
      </MockedQueryClientProvider>,
    )
  }

  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    queryClient.clear()
    delete (window as any).__xss_fired
  })
  afterAll(() => server.close())

  it('strips inline event handlers from interpolated user name', async () => {
    const {container} = renderWithName('<img src=x onerror="window.__xss_fired = true">')
    // wait for query to resolve and the interpolated text to render
    await screen.findByText(/into the selected user/i)
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from interpolated user name', async () => {
    const {container} = renderWithName('<script>window.__xss_fired = true</script>')
    await screen.findByText(/into the selected user/i)
    expect(container.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders benign formatting from the i18n template', async () => {
    const {container} = renderWithName('Plain Name')
    await screen.findByText(/into the selected user/i)
    // the <b> tag in the template should still render
    expect(container.querySelector('b')).not.toBeNull()
    expectNoEventHandlers(container)
  })
})

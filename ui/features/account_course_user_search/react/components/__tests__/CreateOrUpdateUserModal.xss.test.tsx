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

// Regression coverage for stored-XSS into the success-toast HTML interpolation
// in CreateOrUpdateUserModal. The component renders the I18n-formatted success
// message via dangerouslySetInnerHTML (so the bold + link wrapper survive),
// which means a server-controlled user.name pulled into that template can
// inject <script>/event-handler payloads if not sanitized.
//
// We mock showFlashAlert to capture the React node it receives, then mount
// that node into a container so the actual DOM produced by the
// dangerouslySetInnerHTML sink is observable.

import React from 'react'
import {cleanup, fireEvent, render, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'

const flashAlertMock = vi.fn()

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashAlert: (...args: unknown[]) => flashAlertMock(...args),
    showFlashSuccess: vi.fn().mockReturnValue(vi.fn()),
    showFlashError: vi.fn().mockReturnValue(vi.fn()),
  }
})

// Bypass i18n's html-escape on interpolated values so the malicious
// `userName` reaches the dangerouslySetInnerHTML sink as live HTML —
// isolating the new sanitizeHTML wrapper at that sink as the only defense.
vi.mock('@canvas/i18n', () => {
  const interpolate = (str: string, opts: Record<string, string> = {}) => {
    let result = str
    // collapse the `*foo*` link-wrapper notation used by these templates,
    // mirroring i18nliner's wrappers feature without escaping interpolations
    if (opts.wrapper) {
      result = result.replace(/\*([^*]+)\*/g, (_match, inner) => opts.wrapper.replace('$1', inner))
    }
    return result.replace(/%\{(\w+)\}/g, (_, key) => (opts[key] != null ? String(opts[key]) : ''))
  }
  const scope = {
    t: (template: string, opts?: Record<string, string>) => interpolate(template, opts ?? {}),
  }
  return {
    useScope: () => scope,
  }
})

import CreateOrUpdateUserModal from '../CreateOrUpdateUserModal'

const server = setupServer()

const CREATE_URL = '/accounts/2/users'
const UPDATE_URL = '/accounts/2/users/12345'

const XSS_NAME =
  '<img src=x onerror="window.__xss_fired = true"><script>window.__xss_fired = true</script>'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderFlashMessage = (message: React.ReactNode): HTMLElement => {
  const {container} = render(<>{message}</>)
  return container
}

describe('CreateOrUpdateUserModal — XSS regression (success toast HTML)', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    cleanup()
    flashAlertMock.mockReset()
    delete (window as any).__xss_fired
  })
  afterAll(() => server.close())

  it('strips script tags and event handlers from interpolated user name on create', async () => {
    server.use(
      http.post(CREATE_URL, () =>
        HttpResponse.json({
          user: {user: {id: '12345', name: XSS_NAME}},
          message_sent: false,
          pseudonym: {},
          course: null,
        }),
      ),
    )
    const user = userEvent.setup()
    const {getByTestId} = render(
      <CreateOrUpdateUserModal
        createOrUpdate="create"
        url={CREATE_URL}
        afterSave={vi.fn()}
        onClose={vi.fn()}
        open={true}
      />,
    )

    fireEvent.change(getByTestId('full-name'), {target: {value: 'Whatever'}})
    fireEvent.change(getByTestId('unique-id'), {target: {value: 'whatever@example.com'}})
    await user.click(getByTestId('submit-button'))

    await waitFor(() => expect(flashAlertMock).toHaveBeenCalled())

    const messageNode = (flashAlertMock.mock.calls[0][0] as {message: React.ReactNode}).message
    const container = renderFlashMessage(messageNode)

    expect(container.querySelector('script')).toBeNull()
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips script tags and event handlers from interpolated user name on update', async () => {
    server.use(http.put(UPDATE_URL, () => HttpResponse.json({id: '12345', name: XSS_NAME})))
    const user = userEvent.setup()
    const {getByTestId} = render(
      <CreateOrUpdateUserModal
        createOrUpdate="update"
        url={UPDATE_URL}
        user={{name: 'Jane Doe'}}
        afterSave={vi.fn()}
        onClose={vi.fn()}
        open={true}
      />,
    )

    await user.click(getByTestId('submit-button'))

    await waitFor(() => expect(flashAlertMock).toHaveBeenCalled())

    const messageNode = (flashAlertMock.mock.calls[0][0] as {message: React.ReactNode}).message
    const container = renderFlashMessage(messageNode)

    expect(container.querySelector('script')).toBeNull()
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves benign formatting (the bold username and the user-link wrapper)', async () => {
    server.use(http.put(UPDATE_URL, () => HttpResponse.json({id: '12345', name: 'Jane Doe'})))
    const user = userEvent.setup()
    const {getByTestId} = render(
      <CreateOrUpdateUserModal
        createOrUpdate="update"
        url={UPDATE_URL}
        user={{name: 'Jane Doe'}}
        afterSave={vi.fn()}
        onClose={vi.fn()}
        open={true}
      />,
    )

    await user.click(getByTestId('submit-button'))

    await waitFor(() => expect(flashAlertMock).toHaveBeenCalled())

    const messageNode = (flashAlertMock.mock.calls[0][0] as {message: React.ReactNode}).message
    const container = renderFlashMessage(messageNode)

    // benign formatting from the I18n template should still render
    expect(container.querySelector('a')).not.toBeNull()
    expect(container.textContent).toMatch(/Jane Doe/)
    expectNoEventHandlers(container)
  })
})

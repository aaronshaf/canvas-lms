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

// XSS / open-redirect regression tests for returnToReferrer() in AdminSplit.
// document.referrer is attacker-controlled (the referring page chooses it).
// We must validate it is same-origin before assigning to window.location.href.

import React from 'react'
import {render, fireEvent} from '@testing-library/react'
import AdminSplit from '../index'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function setReferrer(url: string) {
  Object.defineProperty(document, 'referrer', {value: url, configurable: true})
}

function renderSplitComplete(
  splitUsers = [{id: '2', display_name: 'split1', html_url: '/users/2'}],
) {
  // Render with a server that immediately returns a completed split
  server.use(
    http.post('http://localhost/api/v1/users/1/split', () =>
      HttpResponse.json([
        {id: '2', display_name: 'split1', short_name: 'split1', html_url: '/users/2'},
      ]),
    ),
  )
  const utils = render(
    <AdminSplit
      user={{id: '1', display_name: 'test user', html_url: '/users/1'}}
      splitUrl="http://localhost/api/v1/users/1/split"
      splitUsers={splitUsers}
    />,
  )
  fireEvent.click(utils.getByText('Split'))
  return utils
}

describe('AdminSplit returnToReferrer security', () => {
  let originalHref: string
  let hrefAssigned: string | undefined

  beforeEach(() => {
    originalHref = window.location.href
    hrefAssigned = undefined
    // jsdom does not allow navigation; capture the assignment instead
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() {
          return originalHref
        },
        set href(url: string) {
          hrefAssigned = url
        },
        get origin() {
          return new URL(originalHref).origin
        },
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(document, 'referrer', {value: '', configurable: true})
    vi.restoreAllMocks()
  })

  it('navigates to a same-origin referrer when OK is clicked', async () => {
    setReferrer('http://localhost/courses/1')
    const {findByText} = renderSplitComplete()
    const okButton = await findByText('OK')
    fireEvent.click(okButton)
    expect(hrefAssigned).toBe('http://localhost/courses/1')
  })

  it('blocks an off-domain referrer and does not navigate', async () => {
    setReferrer('https://evil.example.com/steal')
    const {findByText} = renderSplitComplete()
    const okButton = await findByText('OK')
    fireEvent.click(okButton)
    expect(hrefAssigned).toBeUndefined()
  })

  it('blocks a javascript: referrer and does not navigate', async () => {
    setReferrer('javascript:alert(1)')
    const {findByText} = renderSplitComplete()
    const okButton = await findByText('OK')
    fireEvent.click(okButton)
    expect(hrefAssigned).toBeUndefined()
  })
})

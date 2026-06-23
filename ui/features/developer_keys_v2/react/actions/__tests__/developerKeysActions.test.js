/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import actions from '../developerKeysActions'
import storeCreator from '../../store/store'

const server = setupServer()
const store = storeCreator()

const ok = x => expect(x).toBeTruthy()
const equal = (x, y) => expect(x).toEqual(y)

beforeAll(() => server.listen({onUnhandledRequest: 'bypass'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Developer key actions', () => {
  test('listInheritedDeveloperKeysStart returns proper action', () => {
    const retVal = actions.listInheritedDeveloperKeysStart()
    equal(retVal.type, 'LIST_INHERITED_DEVELOPER_KEYS_START')
  })

  test('listInheritedDeveloperKeysStart returns a payload', () => {
    const payload = {test: 'test'}
    const retVal = actions.listInheritedDeveloperKeysStart(payload)
    equal(retVal.payload, payload)
  })

  test('listInheritedDeveloperKeysSuccessful returns proper action', () => {
    const retVal = actions.listInheritedDeveloperKeysSuccessful()
    equal(retVal.type, 'LIST_INHERITED_DEVELOPER_KEYS_SUCCESSFUL')
  })

  test('listInheritedDeveloperKeysSuccessful returns a payload', () => {
    const payload = {test: 'test'}
    const retVal = actions.listInheritedDeveloperKeysSuccessful(payload)
    equal(retVal.payload, payload)
  })

  test('listInheritedDeveloperKeysFailed returns proper action', () => {
    const retVal = actions.listInheritedDeveloperKeysFailed()
    equal(retVal.type, 'LIST_INHERITED_DEVELOPER_KEYS_FAILED')
  })

  test('listInheritedDeveloperKeysFailed returns a error', () => {
    const error = {test: 'test'}
    const retVal = actions.listInheritedDeveloperKeysFailed(error)
    equal(retVal.payload, error)
  })

  test('getDeveloperKeys retrieves account key data', async () => {
    const requestedUrls = []
    server.use(
      http.get('*', ({request}) => {
        requestedUrls.push(request.url)
        return HttpResponse.json([])
      }),
    )

    actions.getDeveloperKeys('http://www.test.com', {})(
      () => {},
      () => {},
    )

    await new Promise(r => setTimeout(r, 50))
    expect(
      requestedUrls.some(
        url => url.startsWith('http://www.test.com') && !url.includes('inherited'),
      ),
    ).toBe(true)
  })

  test('getDeveloperKeys retrieves inherited account key data', async () => {
    const requestedUrls = []
    server.use(
      http.get('*', ({request}) => {
        requestedUrls.push(request.url)
        return HttpResponse.json([])
      }),
    )

    actions.getDeveloperKeys('http://www.test.com', {})(
      () => {},
      () => {},
    )

    await new Promise(r => setTimeout(r, 50))
    expect(requestedUrls.some(url => url.includes('inherited=true'))).toBe(true)
  })

  test('getRemainingDeveloperKeys requests keys from the specified URL', async () => {
    const requestedUrls = []
    server.use(
      http.get('*', ({request}) => {
        requestedUrls.push(request.url)
        return HttpResponse.json([])
      }),
    )

    actions.getRemainingDeveloperKeys('http://www.test.com', [])(
      () => {},
      () => {},
    )

    await new Promise(r => setTimeout(r, 50))
    expect(requestedUrls.some(url => url.startsWith('http://www.test.com'))).toBe(true)
  })

  test('getRemainingInheritedDeveloperKeys requests keys from the specified URL with inherited param', async () => {
    const requestedUrls = []
    server.use(
      http.get('*', ({request}) => {
        requestedUrls.push(request.url)
        return HttpResponse.json([])
      }),
    )

    actions.getRemainingInheritedDeveloperKeys('http://www.test.com', [])(
      () => {},
      () => {},
    )

    await new Promise(r => setTimeout(r, 50))
    expect(requestedUrls.some(url => url.includes('inherited=true'))).toBe(true)
  })

  test('listDeveloperKeyScopes makes a request to the scopes endpoint', async () => {
    let requestedUrl = null
    server.use(
      http.get('*/api/v1/accounts/1/scopes', ({request}) => {
        requestedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    actions.listDeveloperKeyScopes(1)(store.dispatch)

    await new Promise(r => setTimeout(r, 50))
    expect(requestedUrl).not.toBeNull()
    expect(new URL(requestedUrl).searchParams.get('group_by')).toBe('resource_name')
  })
})

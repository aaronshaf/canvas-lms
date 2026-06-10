/*
 * Copyright (C) 2019 - present Instructure, Inc.
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
import install13Tool from '../install13Tool'

const clientId = 10000000009
const createUrl = 'https://www.test.com/accounts/1/tool_configuration'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('install13Tool', () => {
  it('posts the client id to the create url', async () => {
    let capturedBody
    server.use(
      http.post(createUrl, async ({request}) => {
        capturedBody = await request.json()
        return HttpResponse.json({})
      }),
    )
    await install13Tool(clientId, createUrl)
    expect(capturedBody).toEqual({client_id: clientId})
  })

  it('posts the client id and verify_uniqueness if true to the create url', async () => {
    let capturedBody
    server.use(
      http.post(createUrl, async ({request}) => {
        capturedBody = await request.json()
        return HttpResponse.json({})
      }),
    )
    await install13Tool(clientId, createUrl, true)
    expect(capturedBody).toEqual({
      client_id: clientId,
      external_tool: {verify_uniqueness: true},
    })
  })

  it('returns the json from the response', async () => {
    server.use(http.post(createUrl, () => HttpResponse.json({id: 42, name: 'My Tool'})))
    const result = await install13Tool(clientId, createUrl)
    expect(result).toEqual({id: 42, name: 'My Tool'})
  })

  it('throws when the server responds with an error', async () => {
    server.use(http.post(createUrl, () => new HttpResponse(null, {status: 422})))
    await expect(install13Tool(clientId, createUrl)).rejects.toThrow()
  })
})

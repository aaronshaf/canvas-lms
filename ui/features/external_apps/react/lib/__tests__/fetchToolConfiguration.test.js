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
import fetchToolConfiguration from '../fetchToolConfiguration'

const errorHandler = vi.fn()
const clientId = 10000000009
const showUrl = 'https://www.test.com/:developer_key_id/tool_configuration'
const resolvedUrl = 'https://www.test.com/10000000009/tool_configuration'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => {
  server.resetHandlers()
  errorHandler.mockReset()
})
afterAll(() => server.close())

describe('fetchToolConfiguration', () => {
  describe('when the request is a success', () => {
    it('returns the tool_configuration from the response', async () => {
      server.use(
        http.get(resolvedUrl, () => HttpResponse.json({tool_configuration: {settings: {}}})),
      )
      const result = await fetchToolConfiguration(clientId, showUrl, errorHandler)
      expect(result).toEqual({settings: {}})
    })

    it('does not call the error handler', async () => {
      server.use(http.get(resolvedUrl, () => HttpResponse.json({tool_configuration: {}})))
      await fetchToolConfiguration(clientId, showUrl, errorHandler)
      expect(errorHandler).not.toHaveBeenCalled()
    })
  })

  describe('when the request is not a success', () => {
    it('calls the error handler', async () => {
      server.use(http.get(resolvedUrl, () => new HttpResponse(null, {status: 500})))
      await fetchToolConfiguration(clientId, showUrl, errorHandler)
      expect(errorHandler).toHaveBeenCalled()
    })
  })
})

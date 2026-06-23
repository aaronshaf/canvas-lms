/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import ApiClient from '../api-client'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('ApiClient', () => {
  describe('selectOption', () => {
    const ids = {courseId: '1', moduleId: '2', itemId: '3'}
    const path =
      '/api/v1/courses/1/modules/2/items/3/select_mastery_path'

    it('POSTs assignment_set_id to the mastery path endpoint', async () => {
      let capturedBody
      server.use(
        http.post(path, async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({})
        }),
      )
      await ApiClient.selectOption(ids, 42)
      expect(capturedBody).toEqual({assignment_set_id: 42})
    })

    it('rejects on non-2xx response', async () => {
      server.use(
        http.post(path, () => new HttpResponse(null, {status: 422})),
      )
      await expect(ApiClient.selectOption(ids, 42)).rejects.toThrow()
    })
  })
})

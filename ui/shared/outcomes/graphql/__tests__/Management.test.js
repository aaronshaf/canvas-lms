/*
 * Copyright (C) 2021 - present Instructure, Inc.
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
import {removeOutcomeGroup} from '../Management'
import {saveProficiency} from '../MasteryScale'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('api', () => {
  let capturedUrl

  beforeEach(() => {
    capturedUrl = undefined
    server.resetHandlers()
    server.use(
      http.delete('/api/v1/*', ({request}) => {
        capturedUrl = request.url
        return new HttpResponse(null, {status: 204})
      }),
    )
  })

  describe('removeOutcomeGroup', () => {
    it('provides correct arguments to API request to delete group within account context', async () => {
      await removeOutcomeGroup('Account', '1', '2')
      expect(new URL(capturedUrl).pathname).toBe('/api/v1/accounts/1/outcome_groups/2')
    })

    it('provides correct arguments to API request to delete group within course context', async () => {
      await removeOutcomeGroup('Course', '1', '2')
      expect(new URL(capturedUrl).pathname).toBe('/api/v1/courses/1/outcome_groups/2')
    })
  })

  describe('saveProficiency', () => {
    beforeEach(() => {
      server.use(
        http.post('/api/v1/*', ({request}) => {
          capturedUrl = request.url
          return new HttpResponse(null, {status: 200})
        }),
      )
    })

    it('calls the correct route for account context', async () => {
      await saveProficiency('Account', '1', {})
      expect(new URL(capturedUrl).pathname).toBe('/api/v1/accounts/1/outcome_proficiency')
    })

    it('calls the correct route for course context', async () => {
      await saveProficiency('Course', '1', {})
      expect(new URL(capturedUrl).pathname).toBe('/api/v1/courses/1/outcome_proficiency')
    })
  })
})

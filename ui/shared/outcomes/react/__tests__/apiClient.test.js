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

import * as apiClient from '../apiClient'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'

const server = setupServer()

describe('apiClient', () => {
  beforeAll(() => {
    server.listen()
  })

  beforeEach(() => {
    server.resetHandlers()
  })

  afterAll(() => {
    server.close()
  })

  describe('outcome_imports', () => {
    const contextRoot = '/accounts/1'
    const outcomeImportId = 1
    const learningOutcomeGroupId = 1
    const apiRouteRoot = `/api/v1${contextRoot}/outcome_imports`

    it('calls the correct route for createImport without specifying a group', async () => {
      let capturedUrl
      server.use(
        http.post(`${apiRouteRoot}/`, ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json({id: 1}, {status: 200})
        }),
      )
      await apiClient.createImport(contextRoot, new File([''], 'test.csv'))
      const url = new URL(capturedUrl)
      expect(url.pathname).toBe(`${apiRouteRoot}/`)
      expect(url.searchParams.get('import_type')).toBe('instructure_csv')
    })

    it('calls the correct route for createImport within a group', async () => {
      let capturedUrl
      server.use(
        http.post(`${apiRouteRoot}/group/${learningOutcomeGroupId}`, ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json({id: 1}, {status: 200})
        }),
      )
      await apiClient.createImport(contextRoot, new File([''], 'test.csv'), learningOutcomeGroupId)
      const url = new URL(capturedUrl)
      expect(url.pathname).toBe(`${apiRouteRoot}/group/${learningOutcomeGroupId}`)
      expect(url.searchParams.get('import_type')).toBe('instructure_csv')
    })

    it('calls the correct route for queryImportStatus', async () => {
      let capturedUrl
      server.use(
        http.get(`${apiRouteRoot}/${outcomeImportId}`, ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json({workflow_state: 'succeeded'})
        }),
      )
      await apiClient.queryImportStatus(contextRoot, outcomeImportId)
      expect(new URL(capturedUrl).pathname).toBe(`${apiRouteRoot}/${outcomeImportId}`)
    })

    it('calls the correct route for queryImportCreatedGroupIds', async () => {
      let capturedUrl
      server.use(
        http.get(`${apiRouteRoot}/${outcomeImportId}/created_group_ids`, ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        }),
      )
      await apiClient.queryImportCreatedGroupIds(contextRoot, outcomeImportId)
      expect(new URL(capturedUrl).pathname).toBe(
        `${apiRouteRoot}/${outcomeImportId}/created_group_ids`,
      )
    })
  })

  describe('loadRollups', () => {
    const emptyResponse = {rollups: [], linked: {users: [], outcomes: []}}

    it('calls the correct route', async () => {
      let capturedUrl
      server.use(
        http.get('/api/v1/courses/42/outcome_rollups', ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('42', [], false, 1, 10, 'asc', 'student')
      expect(new URL(capturedUrl).pathname).toBe('/api/v1/courses/42/outcome_rollups')
    })

    it('accepts numeric courseId', async () => {
      let capturedUrl
      server.use(
        http.get('/api/v1/courses/42/outcome_rollups', ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups(42, [], false, 1, 10, 'asc', 'student')
      expect(new URL(capturedUrl).pathname).toBe('/api/v1/courses/42/outcome_rollups')
    })

    it('calls the correct endpoint with default parameters', async () => {
      let capturedRequest
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('1', [], false, 1, 20, 'asc', 'student')
      const searchParams = new URL(capturedRequest.url).searchParams
      expect(searchParams.get('per_page')).toBe('20')
      expect(searchParams.get('sort_by')).toBe('student')
      expect(searchParams.get('sort_order')).toBe('asc')
      expect(searchParams.get('page')).toBe('1')
      expect(searchParams.getAll('include[]')).toEqual(['outcomes', 'users'])
    })

    it('calls the correct endpoint with custom parameters', async () => {
      let capturedRequest
      server.use(
        http.get('/api/v1/courses/5/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('5', [], true, 2, 30, 'desc', 'outcome')
      const searchParams = new URL(capturedRequest.url).searchParams
      expect(searchParams.get('per_page')).toBe('30')
      expect(searchParams.get('sort_by')).toBe('outcome')
      expect(searchParams.get('sort_order')).toBe('desc')
      expect(searchParams.get('page')).toBe('2')
      expect(searchParams.get('add_defaults')).toBe('true')
    })

    it('does not include add_defaults when needDefaults is false', async () => {
      let capturedRequest
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('1', [], false, 1, 20, 'asc', 'student')
      const searchParams = new URL(capturedRequest.url).searchParams
      expect(searchParams.has('add_defaults')).toBe(false)
    })

    it('includes user_ids when selectedUserIds is provided', async () => {
      let capturedRequest
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('1', [], false, 1, 20, 'asc', 'student', undefined, [97, 42])
      const searchParams = new URL(capturedRequest.url).searchParams
      expect(searchParams.getAll('user_ids[]')).toEqual(['97', '42'])
    })

    it('does not include user_ids when selectedUserIds is empty array', async () => {
      let capturedRequest
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('1', [], false, 1, 20, 'asc', 'student', undefined, [])
      const searchParams = new URL(capturedRequest.url).searchParams
      expect(searchParams.has('user_ids[]')).toBe(false)
    })

    it('does not include user_ids when selectedUserIds is undefined', async () => {
      let capturedRequest
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(emptyResponse)
        }),
      )
      await apiClient.loadRollups('1', [], false, 1, 20, 'asc', 'student', undefined, undefined)
      const searchParams = new URL(capturedRequest.url).searchParams
      expect(searchParams.has('user_ids[]')).toBe(false)
    })
  })
})

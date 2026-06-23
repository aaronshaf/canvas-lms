/*
 * Copyright (C) 2017 - present Instructure, Inc.
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
import AssignmentApi from '../AssignmentApi'

const server = setupServer()

describe('AssignmentApi', () => {
  const courseId = 23
  let requestedUrls = []
  let requestedParams = []

  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    requestedUrls = []
    requestedParams = []
  })
  afterAll(() => server.close())

  beforeEach(() => {
    server.use(
      http.get('*', ({request}) => {
        const url = new URL(request.url)
        requestedUrls.push(url.pathname)
        const params = {}
        url.searchParams.forEach((value, key) => {
          params[key] = value
        })
        requestedParams.push(params)
        return HttpResponse.json([])
      }),
    )
  })

  test('getAssignmentsByName makes a request with a search term', async () => {
    const searchTerm = "Gary's late assignment"
    await AssignmentApi.getAssignmentsByName(courseId, searchTerm)
    expect(requestedUrls).toHaveLength(1)
    expect(requestedUrls[0]).toBe(`/api/v1/courses/${courseId}/assignments`)
    expect(requestedParams[0]).toMatchObject({
      search_term: searchTerm,
      per_page: '10',
    })
  })

  test('getAssignmentsByName makes a request with a single-character search term', async () => {
    await AssignmentApi.getAssignmentsByName(courseId, 'A')
    expect(requestedUrls).toHaveLength(1)
  })

  test('getAssignmentsByName returns empty results for an empty search term', async () => {
    const result = await AssignmentApi.getAssignmentsByName(courseId, '')
    expect(result).toEqual({response: {data: []}})
    expect(requestedUrls).toHaveLength(0)
  })

  test('getAssignmentsNextPage makes a request with given url', async () => {
    const url = 'https://example.com/assignments?page=2'
    await AssignmentApi.getAssignmentsNextPage(url)
    expect(requestedUrls).toHaveLength(1)
    expect(requestedUrls[0]).toBe('/assignments')
  })
})

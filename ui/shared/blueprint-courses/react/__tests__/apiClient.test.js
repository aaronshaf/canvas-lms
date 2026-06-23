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
import apiClient, {
  DEFAULT_PER_PAGE_PARAM,
  DEFAULT_BLUEPRINT_PARAM,
  DEFAULT_BLUEPRINT_ASSOCIATED_PARAM,
  DEFAULT_TERM_INCLUDE_PARAM,
  DEFAULT_TEACHERS_INCLUDE_PARAM,
  DEFAULT_CONCLUDED_INCLUDE_PARAM,
  DEFAULT_TEACHERS_LIMIT_PARAM,
} from '../apiClient'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const accountParams = {accountId: 1}
const getCourseParams = {
  search: 'foo',
  term: 'bar',
}

describe('Blueprint Course apiClient', () => {
  test('getCourse generated uri', async () => {
    window.ENV = {FEATURES: {ux_list_concluded_courses_in_bp: true}}

    let capturedUrl = null
    server.use(
      http.get('/api/v1/accounts/1/courses', ({request}) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    await apiClient.getCourses(accountParams, getCourseParams)

    const url = new URL(capturedUrl)
    expect(url.pathname).toBe(`/api/v1/accounts/${accountParams.accountId}/courses`)
    expect(url.searchParams.get('per_page')).toBe(DEFAULT_PER_PAGE_PARAM)
    expect(url.searchParams.get('blueprint')).toBe(DEFAULT_BLUEPRINT_PARAM)
    expect(url.searchParams.get('blueprint_associated')).toBe(DEFAULT_BLUEPRINT_ASSOCIATED_PARAM)
    expect(url.searchParams.getAll('include[]')[0]).toBe(DEFAULT_TERM_INCLUDE_PARAM)
    expect(url.searchParams.getAll('include[]')[1]).toBe(DEFAULT_TEACHERS_INCLUDE_PARAM)
    expect(url.searchParams.getAll('include[]')[2]).toBe(DEFAULT_CONCLUDED_INCLUDE_PARAM)
    expect(url.searchParams.get('teacher_limit')).toBe(DEFAULT_TEACHERS_LIMIT_PARAM)
    expect(url.searchParams.get('search_term')).toBe(getCourseParams.search)
    expect(url.searchParams.get('enrollment_term_id')).toBe(getCourseParams.term)
  })

  test('getCourse generated uri on subAccount given', async () => {
    const expectedSubAccount = 'sub'

    let capturedUrl = null
    server.use(
      http.get('/api/v1/accounts/sub/courses', ({request}) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    await apiClient.getCourses(accountParams, {...getCourseParams, subAccount: expectedSubAccount})

    const url = new URL(capturedUrl)
    expect(url.pathname).toBe(`/api/v1/accounts/${expectedSubAccount}/courses`)
  })

  test('getCourse generated uri on search contains URI reserved character', async () => {
    const expectedSearch = 'search#reserved'

    let capturedUrl = null
    server.use(
      http.get('/api/v1/accounts/1/courses', ({request}) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    await apiClient.getCourses(accountParams, {...getCourseParams, search: expectedSearch})

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('search_term')).toBe(expectedSearch)
  })

  test('getCourse generated uri on search starts with URI reserved character', async () => {
    const expectedSearch = '#searchstring'

    let capturedUrl = null
    server.use(
      http.get('/api/v1/accounts/1/courses', ({request}) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    await apiClient.getCourses(accountParams, {...getCourseParams, search: expectedSearch})

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('search_term')).toBe(expectedSearch)
  })

  test('toggleLocked sends PUT with correct body and returns json', async () => {
    let captured = null
    server.use(
      http.put('/api/v1/courses/1/blueprint_templates/default/restrict_item', async ({request}) => {
        captured = await request.json()
        return HttpResponse.json({success: true})
      }),
    )

    const result = await apiClient.toggleLocked({
      courseId: '1',
      itemType: 'assignment',
      itemId: '42',
      isLocked: true,
    })

    expect(captured).toEqual({content_type: 'assignment', content_id: '42', restricted: true})
    expect(result.json).toEqual({success: true})
  })
})

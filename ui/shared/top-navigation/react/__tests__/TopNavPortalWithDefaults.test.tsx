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

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {handleStudentViewClick} from '../studentViewUtils'
import * as globalUtils from '@canvas/util/globalUtils'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('handleStudentViewClick', () => {
  let reloadSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    reloadSpy = vi.spyOn(globalUtils, 'reloadWindow').mockImplementation(() => {})
    server.resetHandlers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to the student view URL and calls reloadWindow on success', async () => {
    let capturedRequest: Request | undefined
    server.use(
      http.post('/courses/:courseId/student_view', ({request}) => {
        capturedRequest = request
        return new HttpResponse(null, {status: 200})
      }),
    )

    handleStudentViewClick('/courses/42/student_view?redirect_to_referer=1')

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalled())
    expect(new URL(capturedRequest!.url).pathname).toBe('/courses/42/student_view')
  })

  it('does not call reloadWindow on network error', async () => {
    server.use(http.post('/courses/:courseId/student_view', () => HttpResponse.error()))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    handleStudentViewClick('/courses/42/student_view?redirect_to_referer=1')

    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled())
    expect(reloadSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('does not call reloadWindow on a 4xx server error', async () => {
    server.use(
      http.post('/courses/:courseId/student_view', () => new HttpResponse(null, {status: 403})),
    )

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    handleStudentViewClick('/courses/42/student_view?redirect_to_referer=1')

    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled())
    expect(reloadSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

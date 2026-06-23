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

import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import HistoryApi from '../HistoryApi'

const server = setupServer()
let capturedUrl = null

describe('HistoryApi', () => {
  let courseId

  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    capturedUrl = null
  })
  afterAll(() => server.close())

  beforeEach(() => {
    courseId = 123
    server.use(
      http.get('*', ({request}) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )
  })

  it('getGradebookHistory sends a request to the grade change audit url', async () => {
    await HistoryApi.getGradebookHistory(courseId, {})
    expect(new URL(capturedUrl).pathname).toBe(`/api/v1/audit/grade_change/courses/${courseId}`)
  })

  it('getGradebookHistory requests with course and assignment', async () => {
    const assignment = '21'
    await HistoryApi.getGradebookHistory(courseId, {assignment})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/assignments/${assignment}`,
    )
  })

  it('getGradebookHistory requests with course and grader', async () => {
    const grader = '22'
    await HistoryApi.getGradebookHistory(courseId, {grader})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/graders/${grader}`,
    )
  })

  it('getGradebookHistory requests with course and student', async () => {
    const student = '23'
    await HistoryApi.getGradebookHistory(courseId, {student})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/students/${student}`,
    )
  })

  it('getGradebookHistory requests with course, assignment, and grader', async () => {
    const grader = '22'
    const assignment = '210'
    await HistoryApi.getGradebookHistory(courseId, {assignment, grader})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/assignments/${assignment}/graders/${grader}`,
    )
  })

  it('getGradebookHistory requests with course, assignment, and student', async () => {
    const student = '23'
    const assignment = '210'
    await HistoryApi.getGradebookHistory(courseId, {assignment, student})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/assignments/${assignment}/students/${student}`,
    )
  })

  it('getGradebookHistory requests with course, grader, and student', async () => {
    const grader = '23'
    const student = '230'
    await HistoryApi.getGradebookHistory(courseId, {grader, student})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/graders/${grader}/students/${student}`,
    )
  })

  it('getGradebookHistory requests with course, assignment, grader, and student', async () => {
    const grader = '22'
    const assignment = '220'
    const student = '2200'
    await HistoryApi.getGradebookHistory(courseId, {assignment, grader, student})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/assignments/${assignment}/graders/${grader}/students/${student}`,
    )
  })

  it('getGradebookHistory requests with course and override grades', async () => {
    await HistoryApi.getGradebookHistory(courseId, {showFinalGradeOverridesOnly: true})
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/assignments/override`,
    )
  })

  it('getGradebookHistory filters by override grades combined with other parameters', async () => {
    const grader = '22'
    const student = '2200'
    await HistoryApi.getGradebookHistory(courseId, {
      grader,
      showFinalGradeOverridesOnly: true,
      student,
    })
    expect(new URL(capturedUrl).pathname).toBe(
      `/api/v1/audit/grade_change/courses/${courseId}/assignments/override/graders/${grader}/students/${student}`,
    )
  })

  it('getNextPage makes a request with the given url', async () => {
    const url = encodeURI(
      'http://example.com/grades?include[]=current_grade&page=42&per_page=100000000',
    )
    await HistoryApi.getNextPage(url)
    expect(new URL(capturedUrl).pathname).toBe('/grades')
  })
})

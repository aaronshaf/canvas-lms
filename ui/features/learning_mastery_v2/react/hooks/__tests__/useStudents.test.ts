/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import {renderHook, waitFor} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {useStudents} from '../useStudents'
import {Student} from '@canvas/outcomes/react/types/rollup'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('useStudents', () => {
  const courseId = '123'

  const mockStudents: Student[] = [
    {
      id: '1',
      name: 'Alice Student',
      display_name: 'Alice',
      sortable_name: 'Student, Alice',
    },
    {
      id: '2',
      name: 'Bob Student',
      display_name: 'Bob',
      sortable_name: 'Student, Bob',
    },
    {
      id: '3',
      name: 'Charlie Student',
      display_name: 'Charlie',
      sortable_name: 'Student, Charlie',
    },
  ]

  beforeEach(() => {
    server.resetHandlers()
    server.use(
      http.get('/api/v1/courses/:courseId/users', () => {
        return HttpResponse.json(mockStudents)
      }),
    )
  })

  it('returns initial loading state with empty students', () => {
    const {result} = renderHook(() => useStudents(courseId))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.students).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('loads students successfully', async () => {
    const {result} = renderHook(() => useStudents(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.students).toEqual(mockStudents)
    expect(result.current.error).toBeNull()
  })

  it('calls the correct endpoint with courseId', async () => {
    let capturedCourseId: string | undefined
    server.use(
      http.get('/api/v1/courses/:courseId/users', ({params}) => {
        capturedCourseId = params.courseId as string
        return HttpResponse.json(mockStudents)
      }),
    )

    const {result} = renderHook(() => useStudents(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(capturedCourseId).toBe('123')
  })

  it('sets error state on failed request', async () => {
    server.use(http.get('/api/v1/courses/:courseId/users', () => HttpResponse.error()))

    const {result} = renderHook(() => useStudents(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.students).toEqual([])
    expect(result.current.error).toBe('Failed to load students')
  })

  it('clears students array on error', async () => {
    server.use(
      http.get('/api/v1/courses/:courseId/users', () => {
        return new HttpResponse(null, {status: 500})
      }),
    )

    const {result} = renderHook(() => useStudents(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.students).toEqual([])
    expect(result.current.error).toBeTruthy()
  })

  it('handles empty students array response', async () => {
    server.use(http.get('/api/v1/courses/:courseId/users', () => HttpResponse.json([])))

    const {result} = renderHook(() => useStudents(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.students).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('refetches students when courseId changes', async () => {
    const capturedCourseIds: string[] = []
    server.use(
      http.get('/api/v1/courses/:courseId/users', ({params}) => {
        capturedCourseIds.push(params.courseId as string)
        return HttpResponse.json(mockStudents)
      }),
    )

    const {result, rerender} = renderHook(({id}) => useStudents(id), {
      initialProps: {id: '123'},
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(capturedCourseIds).toContain('123')

    rerender({id: '456'})
    await waitFor(() => expect(capturedCourseIds).toContain('456'))
  })

  it('sets loading to true when refetching after courseId change', async () => {
    const {result, rerender} = renderHook(({id}) => useStudents(id), {
      initialProps: {id: '123'},
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    rerender({id: '456'})
    expect(result.current.isLoading).toBe(true)
  })

  it('clears previous error on new request', async () => {
    let callCount = 0
    server.use(
      http.get('/api/v1/courses/:courseId/users', () => {
        callCount++
        if (callCount === 1) return new HttpResponse(null, {status: 500})
        return HttpResponse.json(mockStudents)
      }),
    )

    const {result, rerender} = renderHook(({id}) => useStudents(id), {
      initialProps: {id: '123'},
    })
    await waitFor(() => expect(result.current.error).toBe('Failed to load students'))

    rerender({id: '456'})
    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.students).toEqual(mockStudents)
    })
  })

  it('preserves student data structure from API response', async () => {
    const studentsWithAllFields: Student[] = [
      {
        id: '1',
        name: 'Alice Student',
        display_name: 'Alice',
        sortable_name: 'Student, Alice',
        sis_id: 'SIS123',
        integration_id: 'INT456',
        login_id: 'alice@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        status: 'active',
      },
    ]

    server.use(
      http.get('/api/v1/courses/:courseId/users', () => HttpResponse.json(studentsWithAllFields)),
    )

    const {result} = renderHook(() => useStudents(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.students).toEqual(studentsWithAllFields)
    expect(result.current.students[0].sis_id).toBe('SIS123')
    expect(result.current.students[0].integration_id).toBe('INT456')
    expect(result.current.students[0].login_id).toBe('alice@example.com')
  })
})

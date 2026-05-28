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

import {renderHook, waitFor} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import useRollups from '@canvas/outcomes/react/hooks/useRollups'
import {DEFAULT_STUDENTS_PER_PAGE} from '@canvas/outcomes/react/utils/constants'
import {SortOrder} from '@instructure/outcomes-ui/lib/util/gradebook/constants'
import {Outcome, Rating, Student} from '@canvas/outcomes/react/types/rollup'
import {MOCK_OUTCOMES, MOCK_RATINGS, MOCK_STUDENTS} from '../../__fixtures__/rollups'

const server = setupServer()

describe('useRollups', () => {
  const mockedStudents: Student[] = MOCK_STUDENTS
  const mockedRatings: Rating[] = MOCK_RATINGS
  const mockedOutcomes: Outcome[] = MOCK_OUTCOMES

  const mockedRollups = [
    {
      links: {
        user: '1',
        status: 'active',
      },
      scores: [
        {
          score: 4,
          links: {
            outcome: '1',
          },
        },
      ],
    },
    {
      links: {
        user: '2',
        status: 'inactive',
      },
      scores: [
        {
          score: 4,
          links: {
            outcome: '1',
          },
        },
      ],
    },
    {
      links: {
        user: '3',
        status: 'completed',
      },
      scores: [
        {
          score: 0,
          links: {
            outcome: '1',
          },
        },
      ],
    },
  ]

  const successResponse = {
    linked: {
      users: mockedStudents,
      outcomes: mockedOutcomes,
    },
    rollups: mockedRollups,
    meta: {
      pagination: {
        page: 1,
        per_page: 20,
        page_count: 1,
      },
    },
  }

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    server.use(
      http.get('/api/v1/courses/1/outcome_rollups', () => HttpResponse.json(successResponse)),
    )
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('useRollups hook with selectedUserIds', () => {
    const emptyUserIds: number[] = []
    const singleUserId: number[] = [97]
    const multipleUserIds: number[] = [97, 42, 101]

    it('passes selectedUserIds to the API call when provided', async () => {
      let capturedRequest: Request | null = null
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(successResponse)
        }),
      )
      renderHook(() =>
        useRollups({
          courseId: '1',
          accountMasteryScalesEnabled: false,
          selectedUserIds: multipleUserIds,
        }),
      )
      await waitFor(() => expect(capturedRequest).not.toBeNull())
      const searchParams = new URL(capturedRequest!.url).searchParams
      expect(searchParams.getAll('user_ids[]')).toEqual(['97', '42', '101'])
    })

    it('does not include user_ids in API call when selectedUserIds is empty array', async () => {
      let capturedRequest: Request | null = null
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(successResponse)
        }),
      )
      renderHook(() =>
        useRollups({
          courseId: '1',
          accountMasteryScalesEnabled: false,
          selectedUserIds: emptyUserIds,
        }),
      )
      await waitFor(() => expect(capturedRequest).not.toBeNull())
      const searchParams = new URL(capturedRequest!.url).searchParams
      expect(searchParams.has('user_ids[]')).toBe(false)
    })

    it('does not include user_ids in API call when selectedUserIds is undefined', async () => {
      let capturedRequest: Request | null = null
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(successResponse)
        }),
      )
      renderHook(() =>
        useRollups({
          courseId: '1',
          accountMasteryScalesEnabled: false,
        }),
      )
      await waitFor(() => expect(capturedRequest).not.toBeNull())
      const searchParams = new URL(capturedRequest!.url).searchParams
      expect(searchParams.has('user_ids[]')).toBe(false)
    })

    it('passes user_ids in params for single selectedUserId', async () => {
      let capturedRequest: Request | null = null
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(successResponse)
        }),
      )
      renderHook(() =>
        useRollups({
          courseId: '1',
          accountMasteryScalesEnabled: false,
          selectedUserIds: singleUserId,
        }),
      )
      await waitFor(() => expect(capturedRequest).not.toBeNull())
      const searchParams = new URL(capturedRequest!.url).searchParams
      expect(searchParams.getAll('user_ids[]')).toEqual(['97'])
    })

    it('passes user_ids in params for multiple selectedUserIds', async () => {
      let capturedRequest: Request | null = null
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(successResponse)
        }),
      )
      renderHook(() =>
        useRollups({
          courseId: '1',
          accountMasteryScalesEnabled: false,
          selectedUserIds: multipleUserIds,
        }),
      )
      await waitFor(() => expect(capturedRequest).not.toBeNull())
      const searchParams = new URL(capturedRequest!.url).searchParams
      expect(searchParams.getAll('user_ids[]')).toEqual(['97', '42', '101'])
    })
  })

  describe('useRollups hook', () => {
    it('returns defaults until the request finishes loading', async () => {
      const {result} = renderHook(() =>
        useRollups({courseId: '1', accountMasteryScalesEnabled: false}),
      )
      const {isLoading, students, outcomes, rollups} = result.current
      expect(isLoading).toEqual(true)
      expect(students).toEqual([])
      expect(outcomes).toEqual([])
      expect(rollups).toEqual([])
      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('returns the response after the request finishes', async () => {
      const {result} = renderHook(() =>
        useRollups({courseId: '1', accountMasteryScalesEnabled: false}),
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      const {isLoading, error, students, outcomes, rollups} = result.current
      expect(isLoading).toEqual(false)
      expect(error).toEqual(null)
      expect(students).toEqual(mockedStudents)
      expect(outcomes).toEqual(mockedOutcomes)

      const expectedRollups = [
        {
          studentId: '1',
          outcomeRollups: [
            {
              outcomeId: '1',
              score: 4,
              count: undefined,
              rating: {...mockedRatings[0], color: `#${mockedRatings[0].color}`},
            },
          ],
        },
        {
          studentId: '2',
          outcomeRollups: [
            {
              outcomeId: '1',
              score: 4,
              count: undefined,
              rating: {...mockedRatings[0], color: `#${mockedRatings[0].color}`},
            },
          ],
        },
        {
          studentId: '3',
          outcomeRollups: [
            {
              outcomeId: '1',
              score: 0,
              count: undefined,
              rating: {...mockedRatings[2], color: `#${mockedRatings[2].color}`},
            },
          ],
        },
      ]
      expect(rollups).toStrictEqual(expectedRollups)
    })

    it("correctly translates student status from 'completed' to 'concluded' when loading rollups", async () => {
      const {result} = renderHook(() =>
        useRollups({courseId: '1', accountMasteryScalesEnabled: false}),
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      const {students} = result.current
      expect(students[2].status).toEqual('concluded')
    })

    it('calls the /rollups URL with the right parameters', async () => {
      let capturedRequest: Request | null = null
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json(successResponse)
        }),
      )
      renderHook(() => useRollups({courseId: '1', accountMasteryScalesEnabled: false}))
      await waitFor(() => expect(capturedRequest).not.toBeNull())
      const searchParams = new URL(capturedRequest!.url).searchParams
      expect(searchParams.get('per_page')).toBe(String(DEFAULT_STUDENTS_PER_PAGE))
      expect(searchParams.getAll('include[]')).toEqual(['outcomes', 'users'])
      expect(searchParams.get('sort_by')).toBe('student')
      expect(searchParams.get('add_defaults')).toBe('true')
      expect(searchParams.get('sort_order')).toBe(SortOrder.ASC)
      expect(searchParams.get('page')).toBe('1')
    })

    it('returns error message on failed request of empty error response', async () => {
      server.use(http.get('/api/v1/courses/1/outcome_rollups', () => HttpResponse.error()))
      const {result} = renderHook(() =>
        useRollups({courseId: '1', accountMasteryScalesEnabled: false}),
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.error).toEqual('Error loading rollups')
    })

    it('returns error message on failed request of a 500 server response', async () => {
      server.use(
        http.get('/api/v1/courses/1/outcome_rollups', () => new HttpResponse(null, {status: 500})),
      )
      const {result} = renderHook(() =>
        useRollups({courseId: '1', accountMasteryScalesEnabled: false}),
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.error).toMatch(/doFetchApi received a bad response/)
    })
  })
})

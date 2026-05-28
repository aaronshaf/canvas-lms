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

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {loadRollups} from '@canvas/outcomes/react/apiClient'
import {
  exportCSV,
  saveLearningMasteryGradebookSettings,
  loadCourseUsers,
  saveOutcomeOrder,
} from '../apiClient'
import {DEFAULT_STUDENTS_PER_PAGE, SortBy} from '@canvas/outcomes/react/utils/constants'
import {
  NameDisplayFormat,
  SortOrder,
  DisplayFilter,
  SecondaryInfoDisplay,
  ScoreDisplayFormat,
  OutcomeArrangement,
} from '@instructure/outcomes-ui/lib/util/gradebook/constants'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'bypass'}))
afterAll(() => server.close())

describe('apiClient', () => {
  let capturedRequest: Request | undefined

  beforeEach(() => {
    capturedRequest = undefined
    server.resetHandlers()
  })

  describe('loadRollups', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/v1/courses/:courseId/outcome_rollups', ({request}) => {
          capturedRequest = request
          return HttpResponse.json({outcomes: [], users: [], meta: {pagination: {}}})
        }),
      )
    })

    it('calls the correct endpoint with default parameters', async () => {
      await loadRollups('123', [])

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/123/outcome_rollups')
      expect(url.searchParams.get('per_page')).toBe(String(DEFAULT_STUDENTS_PER_PAGE))
      expect(url.searchParams.getAll('include[]')).toEqual(['outcomes', 'users'])
      expect(url.searchParams.get('sort_by')).toBe(SortBy.SortableName)
      expect(url.searchParams.get('sort_order')).toBe(SortOrder.ASC)
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.has('add_defaults')).toBe(false)
    })

    it('calls the correct endpoint with custom parameters', async () => {
      await loadRollups('456', ['filter1', 'filter2'], true, 2, 50, SortOrder.DESC, 'custom_sort')

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/456/outcome_rollups')
      expect(url.searchParams.get('per_page')).toBe('50')
      expect(url.searchParams.getAll('exclude[]')).toEqual(['filter1', 'filter2'])
      expect(url.searchParams.getAll('include[]')).toEqual(['outcomes', 'users'])
      expect(url.searchParams.get('sort_by')).toBe('custom_sort')
      expect(url.searchParams.get('sort_order')).toBe(SortOrder.DESC)
      expect(url.searchParams.get('page')).toBe('2')
      expect(url.searchParams.get('add_defaults')).toBe('true')
    })

    it('does not include add_defaults when needDefaults is false', async () => {
      await loadRollups('123', [], false)

      const url = new URL(capturedRequest!.url)
      expect(url.searchParams.has('add_defaults')).toBe(false)
    })

    it('accepts numeric courseId', async () => {
      await loadRollups(789, [])

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/789/outcome_rollups')
    })

    it('includes user_ids when selectedUserIds is provided', async () => {
      await loadRollups(
        '123',
        [],
        false,
        1,
        DEFAULT_STUDENTS_PER_PAGE,
        SortOrder.ASC,
        SortBy.SortableName,
        undefined,
        [97, 42, 101],
      )

      const url = new URL(capturedRequest!.url)
      expect(url.searchParams.getAll('user_ids[]')).toEqual(['97', '42', '101'])
    })

    it('does not include user_ids when selectedUserIds is empty array', async () => {
      await loadRollups(
        '123',
        [],
        false,
        1,
        DEFAULT_STUDENTS_PER_PAGE,
        SortOrder.ASC,
        SortBy.SortableName,
        undefined,
        [],
      )

      const url = new URL(capturedRequest!.url)
      expect(url.searchParams.has('user_ids[]')).toBe(false)
    })

    it('does not include user_ids when selectedUserIds is undefined', async () => {
      await loadRollups('123', [])

      const url = new URL(capturedRequest!.url)
      expect(url.searchParams.has('user_ids[]')).toBe(false)
    })
  })

  describe('exportCSV', () => {
    it('calls the correct endpoint with parameters and returns the CSV body', async () => {
      server.use(
        http.get('/courses/:courseId/outcome_rollups.csv', ({request}) => {
          capturedRequest = request
          return HttpResponse.text('csv,data')
        }),
      )

      const result = await exportCSV('123', ['filter1'])

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/courses/123/outcome_rollups.csv')
      expect(url.searchParams.getAll('exclude[]')).toContain('filter1')
      expect(result.text).toBe('csv,data')
    })

    it('accepts numeric courseId', async () => {
      server.use(
        http.get('/courses/:courseId/outcome_rollups.csv', ({request}) => {
          capturedRequest = request
          return HttpResponse.text('csv,data')
        }),
      )

      const result = await exportCSV(456, [])

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/courses/456/outcome_rollups.csv')
      expect(result.text).toBe('csv,data')
    })
  })

  describe('saveLearningMasteryGradebookSettings', () => {
    const captureBody = async (request: Request) => {
      capturedRequest = request
      return (await request.json()) as Record<string, unknown>
    }

    it('calls the correct endpoint with proper request body', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.SIS_ID,
        displayFilters: [
          DisplayFilter.SHOW_STUDENT_AVATARS,
          DisplayFilter.SHOW_STUDENTS_WITH_NO_RESULTS,
          DisplayFilter.SHOW_OUTCOMES_WITH_NO_RESULTS,
        ],
        nameDisplayFormat: NameDisplayFormat.FIRST_LAST,
        studentsPerPage: 15,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_ONLY,
        outcomeArrangement: OutcomeArrangement.UPLOAD_ORDER,
      }

      await saveLearningMasteryGradebookSettings('123', settings)

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/123/learning_mastery_gradebook_settings')
      expect(capturedBody).toEqual({
        learning_mastery_gradebook_settings: {
          secondary_info_display: 'sis_id',
          show_student_avatars: true,
          show_students_with_no_results: true,
          show_outcomes_with_no_results: true,
          show_unpublished_assignments: false,
          name_display_format: 'first_last',
          students_per_page: 15,
          score_display_format: 'icon_only',
          outcome_arrangement: 'upload_order',
        },
      })
    })

    it('handles settings without display filters', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.NONE,
        displayFilters: [],
        nameDisplayFormat: NameDisplayFormat.FIRST_LAST,
        studentsPerPage: 30,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_AND_LABEL,
        outcomeArrangement: OutcomeArrangement.ALPHABETICAL,
      }

      await saveLearningMasteryGradebookSettings('456', settings)

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/456/learning_mastery_gradebook_settings')
      expect(capturedBody).toEqual({
        learning_mastery_gradebook_settings: {
          secondary_info_display: 'none',
          show_student_avatars: false,
          show_students_with_no_results: false,
          show_outcomes_with_no_results: false,
          show_unpublished_assignments: false,
          name_display_format: 'first_last',
          students_per_page: 30,
          score_display_format: 'icon_and_label',
          outcome_arrangement: 'alphabetical',
        },
      })
    })

    it('accepts numeric courseId', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.SIS_ID,
        displayFilters: [],
        nameDisplayFormat: NameDisplayFormat.FIRST_LAST,
        studentsPerPage: 50,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_ONLY,
        outcomeArrangement: OutcomeArrangement.CUSTOM,
      }

      await saveLearningMasteryGradebookSettings(789, settings)

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/789/learning_mastery_gradebook_settings')
      expect(capturedBody).toEqual({
        learning_mastery_gradebook_settings: {
          secondary_info_display: 'sis_id',
          show_student_avatars: false,
          show_students_with_no_results: false,
          show_outcomes_with_no_results: false,
          show_unpublished_assignments: false,
          name_display_format: 'first_last',
          students_per_page: 50,
          score_display_format: 'icon_only',
          outcome_arrangement: 'custom',
        },
      })
    })

    it('correctly maps display filters to boolean flags', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.NONE,
        displayFilters: [DisplayFilter.SHOW_STUDENT_AVATARS],
        nameDisplayFormat: NameDisplayFormat.FIRST_LAST,
        studentsPerPage: DEFAULT_STUDENTS_PER_PAGE,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_ONLY,
        outcomeArrangement: OutcomeArrangement.UPLOAD_ORDER,
      }

      await saveLearningMasteryGradebookSettings('123', settings)

      expect(capturedBody).toEqual({
        learning_mastery_gradebook_settings: {
          secondary_info_display: 'none',
          show_student_avatars: true,
          show_students_with_no_results: false,
          show_outcomes_with_no_results: false,
          show_unpublished_assignments: false,
          name_display_format: 'first_last',
          students_per_page: 15,
          score_display_format: 'icon_only',
          outcome_arrangement: 'upload_order',
        },
      })
    })

    it('includes name_display_format in the request body when set to LAST_FIRST', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.NONE,
        displayFilters: [],
        nameDisplayFormat: NameDisplayFormat.LAST_FIRST,
        studentsPerPage: DEFAULT_STUDENTS_PER_PAGE,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_ONLY,
        outcomeArrangement: OutcomeArrangement.UPLOAD_ORDER,
      }

      await saveLearningMasteryGradebookSettings('123', settings)

      expect((capturedBody as any).learning_mastery_gradebook_settings.name_display_format).toBe(
        'last_first',
      )
    })

    it('includes score_display_format in the request body', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.NONE,
        displayFilters: [],
        nameDisplayFormat: NameDisplayFormat.FIRST_LAST,
        studentsPerPage: DEFAULT_STUDENTS_PER_PAGE,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_AND_POINTS,
        outcomeArrangement: OutcomeArrangement.UPLOAD_ORDER,
      }

      await saveLearningMasteryGradebookSettings('123', settings)

      expect((capturedBody as any).learning_mastery_gradebook_settings.score_display_format).toBe(
        'icon_and_points',
      )
    })

    it('includes show_unpublished_assignments when filter is enabled', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.put(
          '/api/v1/courses/:courseId/learning_mastery_gradebook_settings',
          async ({request}) => {
            capturedBody = await captureBody(request)
            return HttpResponse.json({})
          },
        ),
      )

      const settings = {
        secondaryInfoDisplay: SecondaryInfoDisplay.NONE,
        displayFilters: [DisplayFilter.SHOW_UNPUBLISHED_ASSIGNMENTS],
        nameDisplayFormat: NameDisplayFormat.FIRST_LAST,
        studentsPerPage: DEFAULT_STUDENTS_PER_PAGE,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_ONLY,
        outcomeArrangement: OutcomeArrangement.UPLOAD_ORDER,
      }

      await saveLearningMasteryGradebookSettings('123', settings)

      expect(
        (capturedBody as any).learning_mastery_gradebook_settings.show_unpublished_assignments,
      ).toBe(true)
    })
  })

  describe('loadCourseUsers', () => {
    it('calls the correct endpoint with default parameters', async () => {
      server.use(
        http.get('/api/v1/courses/:courseId/users', ({request}) => {
          capturedRequest = request
          return HttpResponse.json([])
        }),
      )

      await loadCourseUsers('123')

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/123/users')
      expect(url.searchParams.getAll('enrollment_type[]')).toEqual(['student', 'student_view'])
      expect(url.searchParams.get('per_page')).toBe('100')
    })

    it('accepts numeric courseId', async () => {
      server.use(
        http.get('/api/v1/courses/:courseId/users', ({request}) => {
          capturedRequest = request
          return HttpResponse.json([])
        }),
      )

      await loadCourseUsers(456)

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/456/users')
    })

    it('returns the students from the server', async () => {
      const mockStudents = [
        {id: 1, name: 'Student 1', display_name: 'S1', sortable_name: 'Student, 1'},
        {id: 2, name: 'Student 2', display_name: 'S2', sortable_name: 'Student, 2'},
      ]
      server.use(http.get('/api/v1/courses/:courseId/users', () => HttpResponse.json(mockStudents)))

      const response = await loadCourseUsers('123')

      expect(response.json).toEqual(mockStudents)
    })
  })

  describe('saveOutcomeOrder', () => {
    it('calls the correct endpoint with outcome order data', async () => {
      let capturedBody: unknown
      server.use(
        http.post('/api/v1/courses/:courseId/assign_outcome_order', async ({request}) => {
          capturedRequest = request
          capturedBody = await request.json()
          return HttpResponse.json({})
        }),
      )

      const outcomes = [
        {
          id: '1',
          title: 'O1',
          calculation_method: 'highest',
          mastery_points: 3,
          points_possible: 3,
          ratings: [],
        },
        {
          id: '2',
          title: 'O2',
          calculation_method: 'highest',
          mastery_points: 3,
          points_possible: 3,
          ratings: [],
        },
        {
          id: '3',
          title: 'O3',
          calculation_method: 'highest',
          mastery_points: 3,
          points_possible: 3,
          ratings: [],
        },
      ]

      await saveOutcomeOrder('123', outcomes)

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/123/assign_outcome_order')
      expect(capturedBody).toEqual([
        {outcome_id: 1, position: 0},
        {outcome_id: 2, position: 1},
        {outcome_id: 3, position: 2},
      ])
    })

    it('accepts numeric courseId', async () => {
      let capturedBody: unknown
      server.use(
        http.post('/api/v1/courses/:courseId/assign_outcome_order', async ({request}) => {
          capturedRequest = request
          capturedBody = await request.json()
          return HttpResponse.json({})
        }),
      )

      const outcomes = [
        {
          id: 42,
          title: 'Outcome',
          calculation_method: 'highest',
          mastery_points: 3,
          points_possible: 3,
          ratings: [],
        },
      ]

      await saveOutcomeOrder(456, outcomes)

      const url = new URL(capturedRequest!.url)
      expect(url.pathname).toBe('/api/v1/courses/456/assign_outcome_order')
      expect(capturedBody).toEqual([{outcome_id: 42, position: 0}])
    })

    it('handles empty outcome array', async () => {
      let capturedBody: unknown
      server.use(
        http.post('/api/v1/courses/:courseId/assign_outcome_order', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({})
        }),
      )

      await saveOutcomeOrder('123', [])

      expect(capturedBody).toEqual([])
    })
  })
})

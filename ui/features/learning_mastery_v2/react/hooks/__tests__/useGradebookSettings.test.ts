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
import {act, renderHook, waitFor} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {useGradebookSettings} from '../useGradebookSettings'
import {DEFAULT_GRADEBOOK_SETTINGS} from '@canvas/outcomes/react/utils/constants'
import {
  DisplayFilter,
  SecondaryInfoDisplay,
  NameDisplayFormat,
  ScoreDisplayFormat,
  OutcomeArrangement,
} from '@instructure/outcomes-ui/lib/util/gradebook/constants'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('useGradebookSettings', () => {
  const courseId = '123'
  const SETTINGS_URL = '/api/v1/courses/123/learning_mastery_gradebook_settings'

  beforeEach(() => server.resetHandlers())

  it('loads settings successfully', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: true,
      show_students_with_no_results: true,
      show_outcomes_with_no_results: true,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )

    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.settings.secondaryInfoDisplay).toBe(SecondaryInfoDisplay.SIS_ID)
    expect(result.current.settings.displayFilters).toEqual([
      DisplayFilter.SHOW_STUDENT_AVATARS,
      DisplayFilter.SHOW_STUDENTS_WITH_NO_RESULTS,
      DisplayFilter.SHOW_OUTCOMES_WITH_NO_RESULTS,
    ])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets default settings on error', async () => {
    server.use(http.get(SETTINGS_URL, () => HttpResponse.error()))

    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings).toEqual(DEFAULT_GRADEBOOK_SETTINGS)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('sets default settings if response is missing settings key', async () => {
    server.use(http.get(SETTINGS_URL, () => HttpResponse.json({})))

    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings).toEqual(DEFAULT_GRADEBOOK_SETTINGS)
    expect(result.current.isLoading).toBe(false)
  })

  it('sets display filters to default if they are missing in the response', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: false,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.secondaryInfoDisplay).toBe(mockSettings.secondary_info_display)
    expect(result.current.settings.displayFilters).toEqual([
      DisplayFilter.SHOW_STUDENTS_WITH_NO_RESULTS,
      DisplayFilter.SHOW_OUTCOMES_WITH_NO_RESULTS,
    ])
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets display filters to default if both filters are missing in the response', async () => {
    const mockSettings = {secondary_info_display: SecondaryInfoDisplay.SIS_ID}
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.secondaryInfoDisplay).toBe(mockSettings.secondary_info_display)
    expect(result.current.settings.displayFilters).toEqual(
      DEFAULT_GRADEBOOK_SETTINGS.displayFilters,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets secondaryInfoDisplay to default if it is missing in the response', async () => {
    const mockSettings = {show_student_avatars: true, show_students_with_no_results: true}
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.secondaryInfoDisplay).toBe(
      DEFAULT_GRADEBOOK_SETTINGS.secondaryInfoDisplay,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets nameDisplayFormat from API response', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: true,
      show_students_with_no_results: true,
      name_display_format: NameDisplayFormat.LAST_FIRST,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.nameDisplayFormat).toBe(NameDisplayFormat.LAST_FIRST)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets nameDisplayFormat to default when missing in the response', async () => {
    const mockSettings = {show_student_avatars: true, show_students_with_no_results: true}
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.nameDisplayFormat).toBe(
      DEFAULT_GRADEBOOK_SETTINGS.nameDisplayFormat,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets scoreDisplayFormat from API response', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: true,
      show_students_with_no_results: true,
      score_display_format: ScoreDisplayFormat.ICON_AND_POINTS,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.scoreDisplayFormat).toBe(ScoreDisplayFormat.ICON_AND_POINTS)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets scoreDisplayFormat to default when missing in the response', async () => {
    const mockSettings = {show_student_avatars: true, show_students_with_no_results: true}
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.scoreDisplayFormat).toBe(
      DEFAULT_GRADEBOOK_SETTINGS.scoreDisplayFormat,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets outcomeArrangement from API response', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: true,
      show_students_with_no_results: true,
      outcome_arrangement: OutcomeArrangement.CUSTOM,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.outcomeArrangement).toBe(OutcomeArrangement.CUSTOM)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets outcomeArrangement to default when missing in the response', async () => {
    const mockSettings = {show_student_avatars: true, show_students_with_no_results: true}
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.outcomeArrangement).toBe(
      DEFAULT_GRADEBOOK_SETTINGS.outcomeArrangement,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('loads show_unpublished_assignments setting from API response', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: true,
      show_students_with_no_results: true,
      show_outcomes_with_no_results: false,
      show_unpublished_assignments: true,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.displayFilters).toContain(
      DisplayFilter.SHOW_UNPUBLISHED_ASSIGNMENTS,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('does not include show_unpublished_assignments when false in API response', async () => {
    const mockSettings = {
      secondary_info_display: SecondaryInfoDisplay.SIS_ID,
      show_student_avatars: true,
      show_students_with_no_results: true,
      show_unpublished_assignments: false,
    }
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({learning_mastery_gradebook_settings: mockSettings}),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.displayFilters).not.toContain(
      DisplayFilter.SHOW_UNPUBLISHED_ASSIGNMENTS,
    )
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('updateSettings updates settings', async () => {
    server.use(
      http.get(SETTINGS_URL, () =>
        HttpResponse.json({
          learning_mastery_gradebook_settings: {
            secondary_info_display: SecondaryInfoDisplay.SIS_ID,
            show_student_avatars: false,
            show_students_with_no_results: false,
          },
        }),
      ),
    )
    const {result} = renderHook(() => useGradebookSettings(courseId))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => {
      result.current.updateSettings({
        secondaryInfoDisplay: SecondaryInfoDisplay.INTEGRATION_ID,
        displayFilters: [DisplayFilter.SHOW_STUDENT_AVATARS],
        nameDisplayFormat: NameDisplayFormat.LAST_FIRST,
        studentsPerPage: 15,
        scoreDisplayFormat: ScoreDisplayFormat.ICON_AND_LABEL,
        outcomeArrangement: OutcomeArrangement.UPLOAD_ORDER,
      })
    })
    expect(result.current.settings.secondaryInfoDisplay).toBe(SecondaryInfoDisplay.INTEGRATION_ID)
    expect(result.current.settings.displayFilters).toEqual([DisplayFilter.SHOW_STUDENT_AVATARS])
    expect(result.current.settings.nameDisplayFormat).toBe(NameDisplayFormat.LAST_FIRST)
    expect(result.current.settings.studentsPerPage).toBe(15)
    expect(result.current.settings.scoreDisplayFormat).toBe(ScoreDisplayFormat.ICON_AND_LABEL)
    expect(result.current.settings.outcomeArrangement).toBe(OutcomeArrangement.UPLOAD_ORDER)
  })
})

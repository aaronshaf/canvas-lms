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
import doFetchApi from '@canvas/do-fetch-api-effect'
import {GradebookSettings} from '@canvas/outcomes/react/utils/constants'
import {Student, Outcome} from '@canvas/outcomes/react/types/rollup'
import {DisplayFilter} from '@instructure/outcomes-ui/lib/util/gradebook/constants'

/**
 * Export outcome rollups as CSV. The endpoint returns text/csv, so callers
 * should read the raw body via the response's `text` field, not `json`.
 */
export const exportCSV = (courseId: string | number, gradebookFilters: string[]) =>
  doFetchApi({
    path: `/courses/${courseId}/outcome_rollups.csv`,
    params: {exclude: gradebookFilters},
  })

export type LearningMasterySettingsResponse = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  learning_mastery_gradebook_settings?: Record<string, any>
}

/**
 * Load learning mastery gradebook settings
 */
export const loadLearningMasteryGradebookSettings = (courseId: string | number) =>
  doFetchApi<LearningMasterySettingsResponse>({
    path: `/api/v1/courses/${courseId}/learning_mastery_gradebook_settings`,
  })

/**
 * Save learning mastery gradebook settings
 */
export const saveLearningMasteryGradebookSettings = (
  courseId: string | number,
  settings: GradebookSettings,
) => {
  const body = {
    learning_mastery_gradebook_settings: {
      secondary_info_display: settings.secondaryInfoDisplay,
      show_student_avatars: settings.displayFilters.includes(DisplayFilter.SHOW_STUDENT_AVATARS),
      show_students_with_no_results: settings.displayFilters.includes(
        DisplayFilter.SHOW_STUDENTS_WITH_NO_RESULTS,
      ),
      show_outcomes_with_no_results: settings.displayFilters.includes(
        DisplayFilter.SHOW_OUTCOMES_WITH_NO_RESULTS,
      ),
      show_unpublished_assignments: settings.displayFilters.includes(
        DisplayFilter.SHOW_UNPUBLISHED_ASSIGNMENTS,
      ),
      name_display_format: settings.nameDisplayFormat,
      students_per_page: settings.studentsPerPage,
      score_display_format: settings.scoreDisplayFormat,
      outcome_arrangement: settings.outcomeArrangement,
    },
  }

  return doFetchApi({
    path: `/api/v1/courses/${courseId}/learning_mastery_gradebook_settings`,
    method: 'PUT',
    body,
  })
}

/**
 * Load users enrolled in a course
 */
export const loadCourseUsers = (courseId: string | number, searchTerm?: string) =>
  doFetchApi<Student[]>({
    path: `/api/v1/courses/${courseId}/users`,
    params: {
      enrollment_type: ['student', 'student_view'],
      per_page: 100,
      ...(searchTerm ? {search_term: searchTerm} : {}),
    },
  })

/**
 * Save learning mastery gradebook outcome order
 */
export const saveOutcomeOrder = (courseId: string | number, outcomes: Outcome[]) => {
  const outcomeOrder = outcomes.map((outcome, index) => ({
    outcome_id: Number(outcome.id),
    position: index,
  }))

  return doFetchApi({
    path: `/api/v1/courses/${courseId}/assign_outcome_order`,
    method: 'POST',
    body: outcomeOrder,
  })
}

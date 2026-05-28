/*
 * Copyright (C) 2018 - present Instructure, Inc.
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
import {SortOrder} from '@instructure/outcomes-ui/lib/util/gradebook/constants'
import type {QueryParameterRecord} from '@instructure/query-string-encoding/index.d'
import {MasteryDistributionResponse} from './types/mastery_distribution'
import {DEFAULT_STUDENTS_PER_PAGE, SortBy} from './utils/constants'

export function createImport(contextRoot: string, file: File, learningOutcomeGroupId?: string) {
  const data = new FormData()
  const groupParam = learningOutcomeGroupId ? `group/${learningOutcomeGroupId}` : ''
  // xsslint safeString.identifier file
  data.append('attachment', file)
  const url = `/api/v1${contextRoot}/outcome_imports/${groupParam}?import_type=instructure_csv`
  return doFetchApi({path: url, method: 'POST', body: data})
}

export function queryImportStatus(contextRoot: string, outcomeImportId: string) {
  return doFetchApi({path: `/api/v1${contextRoot}/outcome_imports/${outcomeImportId}`})
}

export function queryImportCreatedGroupIds(contextRoot: string, outcomeImportId: string) {
  return doFetchApi({
    path: `/api/v1${contextRoot}/outcome_imports/${outcomeImportId}/created_group_ids`,
  })
}

/**
 * Load outcome rollups for a course
 */
export const loadRollups = (
  courseId: string | number,
  gradebookFilters: string[],
  needDefaults: boolean = false,
  page: number = 1,
  perPage: number = DEFAULT_STUDENTS_PER_PAGE,
  sortOrder: SortOrder = SortOrder.ASC,
  sortBy: string = SortBy.SortableName,
  sortOutcomeId?: string,
  selectedUserIds?: number[],
  selectedOutcomeIds?: string[],
  sortAlignmentId?: string,
) => {
  const params: QueryParameterRecord = {
    per_page: perPage,
    exclude: gradebookFilters,
    include: ['outcomes', 'users'],
    sort_by: sortBy,
    sort_order: sortOrder,
    page,
    ...(needDefaults && {add_defaults: true}),
    ...(sortOutcomeId && {sort_outcome_id: sortOutcomeId}),
    ...(sortAlignmentId && {sort_alignment_id: sortAlignmentId}),
    ...(selectedUserIds && selectedUserIds.length > 0 && {user_ids: selectedUserIds}),
    ...(selectedOutcomeIds && selectedOutcomeIds.length > 0 && {outcome_ids: selectedOutcomeIds}),
  }

  return doFetchApi({
    path: `/api/v1/courses/${courseId}/outcome_rollups`,
    params,
  })
}

/**
 * Load mastery distribution data for a course
 */
export const loadMasteryDistribution = async (
  courseId: string,
  filters: string[] = [],
  outcomeIds?: string[],
  studentIds?: string[],
  includeAlignments: boolean = false,
  onlyAssignmentAlignments: boolean = false,
  showUnpublishedAssignments: boolean = false,
): Promise<MasteryDistributionResponse> => {
  const params: QueryParameterRecord = {
    exclude: filters,
    add_defaults: true,
  }

  if (outcomeIds && outcomeIds.length > 0) {
    params.outcome_ids = outcomeIds
  }

  if (studentIds && studentIds.length > 0) {
    params.student_ids = studentIds
  }

  const includes: string[] = []
  if (includeAlignments) {
    includes.push('alignment_distributions')
    params.only_assignment_alignments = onlyAssignmentAlignments
    params.show_unpublished_assignments = showUnpublishedAssignments
  }

  if (includes.length > 0) {
    params.include = includes
  }

  const {json} = await doFetchApi<MasteryDistributionResponse>({
    path: `/api/v1/courses/${courseId}/outcome_mastery_distribution`,
    params,
  })

  return json as MasteryDistributionResponse
}

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
import {camelizeProperties, underscoreProperties} from '@canvas/convert-case'

export function bulkSelectProvisionalGrades(courseId, assignmentId, provisionalGradeIds) {
  const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/provisional_grades/bulk_select`

  return doFetchApi({method: 'PUT', path: url, body: {provisional_grade_ids: provisionalGradeIds}})
}

export function selectProvisionalGrade(courseId, assignmentId, provisionalGradeId) {
  const url = `/api/v1/courses/${courseId}/assignments/${assignmentId}/provisional_grades/${provisionalGradeId}/select`

  return doFetchApi({method: 'PUT', path: url})
}

export function updateProvisionalGrade(courseId, submission) {
  const url = `/courses/${courseId}/gradebook/update_submission`
  const data = {
    submission: {
      ...underscoreProperties(submission),
      provisional: true,
    },
  }

  return doFetchApi({method: 'POST', path: url, body: data}).then(({json}) =>
    camelizeProperties(json[0].submission),
  )
}

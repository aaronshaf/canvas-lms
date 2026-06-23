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

import doFetchApi from '@canvas/do-fetch-api-effect'

function getGradebookHistory(courseId, input) {
  let path = `/api/v1/audit/grade_change/courses/${courseId}`

  if (input.showFinalGradeOverridesOnly) {
    path += `/assignments/override`
  } else if (input.assignment) {
    path += `/assignments/${input.assignment}`
  }

  path += input.grader ? `/graders/${input.grader}` : ''
  path += input.student ? `/students/${input.student}` : ''

  const params = {include: ['current_grade']}
  if (input.from?.value) params.start_time = input.from.value
  if (input.to?.value) params.end_time = input.to.value

  return doFetchApi({path, params}).then(({json, response: res}) => ({
    data: json,
    headers: {link: res.headers.get('link')},
  }))
}

function getNextPage(url) {
  return doFetchApi({path: url}).then(({json, response: res}) => ({
    data: json,
    headers: {link: res.headers.get('link')},
  }))
}

export default {
  getGradebookHistory,
  getNextPage,
}

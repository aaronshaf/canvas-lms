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

function getAssignmentsByName(courseId, searchTerm) {
  if (searchTerm.length < 1) {
    return Promise.resolve({response: {data: []}})
  }

  const url = `/api/v1/courses/${courseId}/assignments`

  return doFetchApi({
    path: url,
    params: {search_term: searchTerm, per_page: 10},
  }).then(({json, response}) => ({data: json, headers: {link: response.headers.get('link')}}))
}

function getAssignmentsNextPage(url) {
  return doFetchApi({path: url}).then(({json, response}) => ({
    data: json,
    headers: {link: response.headers.get('link')},
  }))
}

export default {
  getAssignmentsByName,
  getAssignmentsNextPage,
}

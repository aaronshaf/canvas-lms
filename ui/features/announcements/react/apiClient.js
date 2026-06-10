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

import axios from '@canvas/axios'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {encodeQueryString} from '@instructure/query-string-encoding'
import makePromisePool from '@canvas/make-promise-pool'

const MAX_CONCURRENT_REQS = 5

export function getAnnouncements(
  {contextType, contextId, announcements, announcementsSearch},
  {page},
) {
  const {term, filter} = announcementsSearch
  const params = [
    {only_announcements: true},
    {per_page: 40},
    {page: page || announcements.currentPage},
    {search_term: term || null},
    {filter_by: filter || null},
    {no_avatar_fallback: '1'},
  ]

  if (contextType === 'course') {
    params.push({'include[]': 'sections_user_count'})
    params.push({'include[]': 'sections'})
  }

  const queryString = encodeQueryString(params)
  return axios.get(`/api/v1/${contextType}s/${contextId}/discussion_topics?${queryString}`)
}

export function lockAnnouncements({contextType, contextId}, announcements, locked = true) {
  return makePromisePool(
    announcements,
    annId => {
      const url = `/api/v1/${contextType}s/${contextId}/discussion_topics/${annId}`
      return doFetchApi({path: url, method: 'PUT', body: {locked}})
    },
    {
      poolSize: MAX_CONCURRENT_REQS,
    },
  )
}

export function deleteAnnouncements({contextType, contextId}, announcements) {
  return makePromisePool(
    announcements,
    annId => {
      const url = `/api/v1/${contextType}s/${contextId}/discussion_topics/${annId}`
      return doFetchApi({path: url, method: 'DELETE'})
    },
    {
      poolSize: MAX_CONCURRENT_REQS,
    },
  )
}

export function markAllAnnouncementRead({contextType, contextId}) {
  const queryString = encodeQueryString({
    only_announcements: true,
  })
  return doFetchApi({
    path: `/api/v1/${contextType}s/${contextId}/discussion_topics/read_all?${queryString}`,
    method: 'PUT',
  })
}

export function getExternalFeeds({contextType, contextId}) {
  const params = encodeQueryString([{per_page: 100}])
  return doFetchApi({path: `/api/v1/${contextType}s/${contextId}/external_feeds?${params}`})
}

export function deleteExternalFeed({contextType, contextId}, feedId) {
  return doFetchApi({
    path: `/api/v1/${contextType}s/${contextId}/external_feeds/${feedId}`,
    method: 'DELETE',
  })
}

export function addExternalFeed({contextType, contextId}, {url, verbosity, header_match}) {
  return doFetchApi({
    path: `/api/v1/${contextType}s/${contextId}/external_feeds`,
    method: 'POST',
    body: {url, verbosity, header_match},
  })
}

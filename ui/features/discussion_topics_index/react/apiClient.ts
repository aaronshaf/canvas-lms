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

import axios from '@canvas/axios'
import {asAxios, getPrefetchedXHR} from '@canvas/util/xhr'

interface ContextParams {
  contextType: string
  contextId: string
}

interface CurrentUserParams {
  currentUserId: string
}

interface Discussion {
  id: string
  [key: string]: any
}

export function getDiscussions(
  {contextType: _contextType, contextId: _contextId}: ContextParams,
  {page}: {page: number},
) {
  // In the the index.html.erb view for this page, we use prefetch_xhr to fire off
  // `fetch` requests for all the discusisons we're going to render. We do this
  // so they can start loading then and not have to wait until this JS file is
  // loaded to start fetching.
  const xhr = getPrefetchedXHR(`prefetched_discussion_topic_page_${page - 1}`)
  if (!xhr) throw new Error('Prefetched XHR not found')
  return asAxios(xhr)
}

export function updateDiscussion(
  {contextType, contextId}: ContextParams,
  discussion: Discussion,
  updatedFields: Record<string, any>,
) {
  const url = `/api/v1/${contextType}s/${contextId}/discussion_topics/${discussion.id}`
  return axios.put(url, updatedFields)
}

export function deleteDiscussion(
  {contextType, contextId}: ContextParams,
  {discussion}: {discussion: Discussion},
) {
  const url = `/api/v1/${contextType}s/${contextId}/discussion_topics/${discussion.id}`
  return axios.delete(url)
}

export function subscribeToTopic({contextType, contextId}: ContextParams, {id}: {id: string}) {
  return axios.put(`/api/v1/${contextType}s/${contextId}/discussion_topics/${id}/subscribed`)
}

export function unsubscribeFromTopic({contextType, contextId}: ContextParams, {id}: {id: string}) {
  return axios.delete(`/api/v1/${contextType}s/${contextId}/discussion_topics/${id}/subscribed`)
}

export function getUserSettings({currentUserId}: CurrentUserParams) {
  return axios.get(`/api/v1/users/${currentUserId}/settings`)
}

export function getCourseSettings({contextId}: {contextId: string}) {
  return axios.get(`/api/v1/courses/${contextId}/settings`)
}

export function saveCourseSettings(
  {contextId}: {contextId: string},
  settings: Record<string, any>,
) {
  return axios.put(`/api/v1/courses/${contextId}/settings`, settings)
}

export function saveUserSettings(
  {currentUserId}: CurrentUserParams,
  settings: Record<string, any>,
) {
  return axios.put(`/api/v1/users/${currentUserId}/settings`, settings)
}

export function duplicateDiscussion({contextType, contextId}: ContextParams, discussionId: string) {
  return axios.post(
    `/api/v1/${contextType}s/${contextId}/discussion_topics/${discussionId}/duplicate`,
  )
}

export function reorderPinnedDiscussions({contextType, contextId}: ContextParams, order: string[]) {
  const postData = {order: order.join(',')}
  const url = `/api/v1/${contextType}s/${contextId}/discussion_topics/reorder`
  return axios.post(url, postData)
}

export function migrateDiscussionDisallowThreadedReplies({contextId}: {contextId: string}) {
  return axios.put(`/api/v1/courses/${contextId}/discussion_topics/migrate_disallow`)
}

export function updateDiscussionTopicTypes({
  contextId,
  threaded,
  notThreaded,
}: {
  contextId: string
  threaded: string[]
  notThreaded: string[]
}) {
  return axios.put(`/api/v1/courses/${contextId}/discussion_topics/update_discussion_types`, {
    threaded,
    not_threaded: notThreaded,
  })
}

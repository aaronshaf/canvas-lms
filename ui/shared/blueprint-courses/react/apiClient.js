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
import MigrationStates from './migrationStates'

export const DEFAULT_PER_PAGE_PARAM = '100'
export const DEFAULT_BLUEPRINT_PARAM = 'false'
export const DEFAULT_BLUEPRINT_ASSOCIATED_PARAM = 'false'
export const DEFAULT_TERM_INCLUDE_PARAM = 'term'
export const DEFAULT_TEACHERS_INCLUDE_PARAM = 'teachers'
export const DEFAULT_CONCLUDED_INCLUDE_PARAM = 'concluded'
export const DEFAULT_TEACHERS_LIMIT_PARAM = '5'

const ApiClient = {
  _depaginate(url, maxPages = Infinity, allResults = []) {
    return doFetchApi({path: url}).then(({json, link, response}) => {
      const results = allResults.concat(json)
      const remainingPages = maxPages - 1
      if (link?.next && remainingPages > 0) {
        return this._depaginate(link.next.url, remainingPages, results)
      }
      return {data: results, headers: {link: response.headers.get('link')}}
    })
  },

  _queryString(params) {
    return params
      .map(param => {
        const key = Object.keys(param)[0]
        const value = param[key]
        return value ? `${key}=${value}` : null
      })
      .filter(param => !!param)
      .join('&')
  },

  getCourses({accountId}, {search = '', term = '', subAccount = ''} = {}) {
    const paramsList = [
      {per_page: DEFAULT_PER_PAGE_PARAM},
      {blueprint: DEFAULT_BLUEPRINT_PARAM},
      {blueprint_associated: DEFAULT_BLUEPRINT_ASSOCIATED_PARAM},
      {'include[]': DEFAULT_TERM_INCLUDE_PARAM},
      {'include[]': DEFAULT_TEACHERS_INCLUDE_PARAM},
      {teacher_limit: DEFAULT_TEACHERS_LIMIT_PARAM},
      {search_term: encodeURIComponent(search)},
      {enrollment_term_id: term},
    ]

    if (window.ENV.FEATURES.ux_list_concluded_courses_in_bp) {
      paramsList.push({'include[]': DEFAULT_CONCLUDED_INCLUDE_PARAM})
    }

    const params = this._queryString(paramsList)

    return this._depaginate(`/api/v1/accounts/${subAccount || accountId}/courses?${params}`, 1)
  },

  getAssociations({masterCourse}) {
    const params = this._queryString([{per_page: '100'}, {teacher_limit: '5'}])

    return this._depaginate(
      `/api/v1/courses/${masterCourse.id}/blueprint_templates/default/associated_courses?${params}`,
    )
  },

  saveAssociations({masterCourse, addedAssociations, removedAssociations}) {
    return doFetchApi({
      path: `/api/v1/courses/${masterCourse.id}/blueprint_templates/default/update_associations`,
      method: 'PUT',
      body: {
        course_ids_to_add: addedAssociations.map(c => c.id),
        course_ids_to_remove: removedAssociations.map(c => c.id),
      },
    })
  },

  getMigrations({masterCourse}) {
    return doFetchApi({
      path: `/api/v1/courses/${masterCourse.id}/blueprint_templates/default/migrations`,
    }).then(({json}) => ({data: json}))
  },

  beginMigration({
    masterCourse,
    willSendNotification,
    willIncludeCustomNotificationMessage,
    notificationMessage,
    willIncludeCourseSettings,
    willPublishCourses,
    willSendItemNotifications,
  }) {
    const params = {
      send_notification: willSendNotification,
    }
    if (willIncludeCourseSettings) {
      params.copy_settings = true // don't send parameter if not checked
    }
    if (willIncludeCustomNotificationMessage && notificationMessage) {
      params.comment = notificationMessage
    }
    if (willPublishCourses) {
      params.publish_after_initial_sync = true
    }
    if (willSendItemNotifications) {
      params.send_item_notifications = true
    }
    return doFetchApi({
      path: `/api/v1/courses/${masterCourse.id}/blueprint_templates/default/migrations`,
      method: 'POST',
      body: params,
    }).then(({json}) => ({data: json}))
  },

  checkMigration(state) {
    return this.getMigrations(state).then(res => {
      let status = MigrationStates.void

      if (res.data[0]) {
        status = res.data[0].workflow_state
      }

      res.data = status
      return res
    })
  },

  getMigration(
    {course},
    {blueprintType = 'blueprint_templates', templateId = 'default', changeId},
  ) {
    return doFetchApi({
      path: `/api/v1/courses/${course.id}/${blueprintType}/${templateId}/migrations/${changeId}`,
    }).then(({json}) => ({data: json}))
  },

  getMigrationDetails(
    {course},
    {blueprintType = 'blueprint_templates', templateId = 'default', changeId},
  ) {
    return doFetchApi({
      path: `/api/v1/courses/${course.id}/${blueprintType}/${templateId}/migrations/${changeId}/details`,
    }).then(({json}) => ({data: json}))
  },

  getFullMigration({course}, params) {
    return this.getMigration({course}, params).then(({data}) =>
      this.getMigrationDetails({course}, params).then(res =>
        Object.assign(data, {
          changeId: params.changeId,
          changes: res.data,
        }),
      ),
    )
  },

  getSyncHistory({masterCourse}) {
    return this.getMigrations({masterCourse}).then(({data}) =>
      Promise.all(
        // limit to last 5 migrations
        data
          .slice(0, 5)
          .map(mig =>
            this.getMigrationDetails({course: masterCourse}, {changeId: mig.id}).then(res =>
              Object.assign(mig, {changes: res.data}),
            ),
          ),
      ),
    )
  },

  toggleLocked({courseId, itemType, itemId, isLocked}) {
    return doFetchApi({
      path: `/api/v1/courses/${courseId}/blueprint_templates/default/restrict_item`,
      method: 'PUT',
      body: {
        content_type: itemType,
        content_id: itemId,
        restricted: isLocked,
      },
    })
  },

  loadUnsyncedChanges({masterCourse}) {
    return doFetchApi({
      path: `/api/v1/courses/${masterCourse.id}/blueprint_templates/default/unsynced_changes`,
    }).then(({json}) => ({data: json}))
  },
}

export default ApiClient

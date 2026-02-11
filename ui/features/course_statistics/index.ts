/*
 * Copyright (C) 2011 - present Instructure, Inc.
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

// @ts-expect-error - jQuery default import
import $ from 'jquery'
import UserCollection from '@canvas/users/backbone/collections/UserCollection'
import RecentStudentCollectionView from './backbone/views/RecentStudentCollectionView'
import 'jqueryui/tabs'

interface GlobalWindow {
  ENV: {
    RECENT_STUDENTS_URL: string
    context_asset_string: string
  }
  app: {
    studentsTab: typeof RecentStudentCollectionView | Record<string, never>
  }
}

declare const ENV: GlobalWindow['ENV']
declare const window: Window & typeof globalThis & {app: GlobalWindow['app']}

$(() => {
  $('#reports-tabs').tabs().show()

  const recentStudentCollection = new UserCollection()
  recentStudentCollection.url = ENV.RECENT_STUDENTS_URL
  recentStudentCollection.course_id = ENV.context_asset_string.split('_')[1]
  recentStudentCollection.fetch()

  window.app = {studentsTab: {}}
  // @ts-expect-error - Backbone view constructor pattern
  window.app.studentsTab = new RecentStudentCollectionView({
    el: '#tab-students .item_list',
    collection: recentStudentCollection,
  })
})

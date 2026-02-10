/*
 * Copyright (C) 2013 - present Instructure, Inc.
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

import CourseRestoreModel from './backbone/models/CourseRestore'
import UserRestoreModel from './backbone/models/UserRestore'
import AdminToolsView from './backbone/views/AdminToolsView'
import RestoreContentPaneView from './backbone/views/RestoreContentPaneView'
import CourseSearchResultsView from './backbone/views/CourseSearchResultsView'
import UserSearchResultsView from './backbone/views/UserSearchResultsView'
import LoggingContentPaneView from './backbone/views/LoggingContentPaneView'
import AccountUserCollection from './backbone/collections/AccountUserCollection'
import ready from '@instructure/ready'
import {initializeTopNavPortal} from '@canvas/top-navigation/react/TopNavPortal'

declare const ENV: {
  readonly ACCOUNT_ID: string
  readonly PERMISSIONS: {
    readonly restore_course: boolean
    readonly restore_user: boolean
    readonly view_messages: boolean
    readonly logging: boolean
  }
  readonly bounced_emails_admin_tool: boolean
}

ready(() => {
  // These are Backbone classes written in JS; TS inference for them is unreliable.
  const CourseRestoreModelAny = CourseRestoreModel as unknown as new (attrs: unknown) => unknown
  const UserRestoreModelAny = UserRestoreModel as unknown as new (attrs: unknown) => unknown
  const AccountUserCollectionAny = AccountUserCollection as unknown as new (
    models: unknown,
    opts: unknown,
  ) => unknown

  const courseRestoreModel = new CourseRestoreModelAny({account_id: ENV.ACCOUNT_ID})
  const userRestoreModel = new UserRestoreModelAny({account_id: ENV.ACCOUNT_ID})

  const loggingUsers = new AccountUserCollectionAny(null, {account_id: ENV.ACCOUNT_ID})

  initializeTopNavPortal()

  // Render tabs
  const AdminToolsViewAny = AdminToolsView as unknown as new (
    opts: unknown,
  ) => {render?: () => void}
  const RestoreContentPaneViewAny = RestoreContentPaneView as unknown as new (
    opts: unknown,
  ) => unknown
  const CourseSearchResultsViewAny = CourseSearchResultsView as unknown as new (
    opts: unknown,
  ) => unknown
  const UserSearchResultsViewAny = UserSearchResultsView as unknown as new (
    opts: unknown,
  ) => unknown
  const LoggingContentPaneViewAny = LoggingContentPaneView as unknown as new (
    opts: unknown,
  ) => unknown

  const app = new AdminToolsViewAny({
    el: '#admin-tools-app',
    tabs: {
      contentRestore: ENV.PERMISSIONS.restore_course || ENV.PERMISSIONS.restore_user,
      viewMessages: ENV.PERMISSIONS.view_messages,
      logging: !!ENV.PERMISSIONS.logging,
      bouncedEmails: ENV.bounced_emails_admin_tool,
    },
    restoreContentPaneView: new RestoreContentPaneViewAny({
      permissions: ENV.PERMISSIONS,
      courseSearchResultsView: new CourseSearchResultsViewAny({model: courseRestoreModel}),
      userSearchResultsView: new UserSearchResultsViewAny({model: userRestoreModel}),
    }),
    loggingContentPaneView: new LoggingContentPaneViewAny({
      permissions: ENV.PERMISSIONS.logging,
      users: loggingUsers,
    }),
  })

  app.render?.()
})

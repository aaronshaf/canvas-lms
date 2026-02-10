/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import ready from '@instructure/ready'
import React from 'react'
import {legacyRender} from '@canvas/react'
import AdminSplit from './react/index'

interface User {
  id: string
  display_name: string
  short_name?: string
  html_url: string
}

interface AdminSplitEnv {
  ADMIN_SPLIT_USER: User
  ADMIN_SPLIT_URL: string
  ADMIN_SPLIT_USERS: User[]
}

declare global {
  interface Window {
    ENV: AdminSplitEnv
  }
}

ready(() => {
  legacyRender(
    <AdminSplit
      user={window.ENV.ADMIN_SPLIT_USER}
      splitUrl={window.ENV.ADMIN_SPLIT_URL}
      splitUsers={window.ENV.ADMIN_SPLIT_USERS}
    />,
    document.getElementById('admin_split'),
  )
})

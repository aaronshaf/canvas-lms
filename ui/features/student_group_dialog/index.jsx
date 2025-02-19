/*
 * Copyright (C) 2014 - present Instructure, Inc.
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

import React from 'react'
import {createRoot} from 'react-dom/client'
import $ from 'jquery'
import {useScope as createI18nScope} from '@canvas/i18n'
import ready from '@instructure/ready'
import GroupModal from '@canvas/group-modal'
import Group from '@canvas/groups/backbone/models/Group'
import {initializeTopNavPortal} from '@canvas/top-navigation/react/TopNavPortal'

const I18n = createI18nScope('StudentGroupDialog')

let root
const mountPoint = document.getElementById('student-group-dialog-mount-point')

function reloadStudentGroup() {
  return window.location.reload()
}

function editGroup(group, open = true) {
  if (!root) {
    root = createRoot(mountPoint)
  }

  root.render(
    <GroupModal
      group={{
        name: group.get('name'),
        id: group.get('id'),
        group_category_id: group.get('group_category_id'),
        join_level: group.get('join_level'),
        group_limit: group.get('max_membership'),
      }}
      label={I18n.t('Edit Group')}
      open={open}
      nameOnly={true}
      requestMethod="PUT"
      onSave={reloadStudentGroup}
      onDismiss={() => {
        editGroup(group, false)
        document.getElementById('edit_group').focus()
      }}
    />,
  )
}

ready(() => {
  const group = new Group(ENV.group)

  initializeTopNavPortal()

  $('#edit_group').click(event => {
    event.preventDefault()
    editGroup(group)
  })
})

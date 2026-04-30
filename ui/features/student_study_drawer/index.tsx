/*
 * Copyright (C) 2026 - present Instructure, Inc.
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
import {render} from '@canvas/react'
import ready from '@instructure/ready'
import {registerPageContentWrapper} from '@canvas/page-content-wrapper'
import StudentStudyDrawer from './react/StudentStudyDrawer'

// Register at module load so the wrapper is in place before
// ContentTypeExternalToolDrawer renders. When top_navigation_placement is
// enabled, top_nav uses this wrapper to nest our drawer inside its DrawerContent
// instead of fighting over #application.
registerPageContentWrapper(StudentStudyDrawer)

ready(() => {
  const showStudyAssist = !!window.ENV.FEATURES?.study_assist
  const showNotebook = !!window.ENV.FEATURES?.notebook

  if (!showStudyAssist && !showNotebook) return

  // Standalone path: when top_navigation_placement is off, top_nav doesn't
  // render a DrawerLayout, so our wrapper is never invoked. Mount the drawer
  // ourselves at the layout-provided slot.
  if (!window.ENV.INIT_DRAWER_LAYOUT_MUTEX) {
    const applicationEl = document.getElementById('application')
    const mount = document.getElementById('student_study_drawer_mount_point')
    if (applicationEl && mount) {
      render(
        <StudentStudyDrawer
          pageContent={applicationEl}
          showStudyAssist={showStudyAssist}
          showNotebook={showNotebook}
        />,
        mount,
      )
    }
  }
})

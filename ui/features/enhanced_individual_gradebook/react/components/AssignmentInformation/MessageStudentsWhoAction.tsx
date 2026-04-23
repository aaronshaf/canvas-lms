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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {MSWLaunchContext} from '@canvas/message-students-dialog/react/MessageStudentsWhoDialog'
import type {
  AssignmentConnection,
  GradebookOptions,
  SortableStudent,
  SubmissionConnection,
} from '../../../types'
import MessageStudentsWhoModal from './MessageStudentsWhoModal'

const I18n = createI18nScope('enhanced_individual_gradebook')

type Props = {
  assignment: AssignmentConnection
  gradebookOptions: GradebookOptions
  students: SortableStudent[]
  submissions: SubmissionConnection[]
}

export function MessageStudentsWhoAction({
  assignment,
  gradebookOptions,
  students,
  submissions,
}: Props) {
  const [showModal, setShowModal] = useState(false)

  if (gradebookOptions.customOptions.hideStudentNames || assignment.anonymizeStudents) {
    return null
  }

  return (
    <View as="div" className="pad-box no-sides">
      <Button
        color="secondary"
        onClick={() => setShowModal(true)}
        data-testid="message-students-who-button"
      >
        {I18n.t('Message students who...')}
      </Button>
      <MessageStudentsWhoModal
        assignment={assignment}
        launchContext={MSWLaunchContext.ASSIGNMENT_CONTEXT}
        gradebookOptions={gradebookOptions}
        students={students}
        submissions={submissions}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </View>
  )
}

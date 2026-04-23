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
import {useScope as createI18nScope} from '@canvas/i18n'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {isInPastGradingPeriodAndNotAdmin} from '../../../utils/gradebookUtils'
import type {
  AssignmentConnection,
  GradebookOptions,
  SubmissionConnection,
  SubmissionGradeChange,
} from '../../../types'
import {CurveGradesModal} from './CurveGradesModal'

const I18n = createI18nScope('enhanced_individual_gradebook')

type Props = {
  assignment: AssignmentConnection
  gradebookOptions: GradebookOptions
  submissions: SubmissionConnection[]
  handleSetGrades: (updatedSubmissions: SubmissionGradeChange[]) => void
}

export function CurveGradesAction({
  assignment,
  gradebookOptions,
  submissions,
  handleSetGrades,
}: Props) {
  const showCurveModal = !!assignment.pointsPossible
  const showWarning = isInPastGradingPeriodAndNotAdmin(assignment)

  if (!showCurveModal && !showWarning) {
    return null
  }

  return (
    <View as="div" className="pad-box no-sides">
      {showCurveModal && (
        <CurveGradesModal
          assignment={assignment}
          submissions={submissions}
          handleGradeChange={handleSetGrades}
          contextUrl={gradebookOptions.contextUrl}
        />
      )}
      {showWarning && (
        <View padding="0 0 0 xx-small">
          <Text data-testid="curve-grade-warning">
            {I18n.t(
              'Unable to curve grades because this assignment is due in a closed grading period for at least one student',
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

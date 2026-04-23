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

import React, {useCallback, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Button} from '@instructure/ui-buttons'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {disableGrading} from '../../../utils/gradeInputUtils'
import {isInPastGradingPeriodAndNotAdmin} from '../../../utils/gradebookUtils'
import type {
  AssignmentConnection,
  GradebookOptions,
  SubmissionConnection,
  SubmissionGradeChange,
} from '../../../types'
import DefaultGradeModal from './DefaultGradeModal'

const I18n = createI18nScope('enhanced_individual_gradebook')

type Props = {
  assignment: AssignmentConnection
  gradebookOptions: GradebookOptions
  submissions: SubmissionConnection[]
  handleSetGrades: (updatedSubmissions: SubmissionGradeChange[]) => void
}

export function DefaultGradeAction({
  assignment,
  gradebookOptions,
  submissions,
  handleSetGrades,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const buttonRef = useRef<Element | null>(null)

  const focusButton = useCallback(() => {
    requestAnimationFrame(() => {
      const el = buttonRef.current
      if (el instanceof HTMLElement) el.focus()
    })
  }, [])

  const onSetGrades = useCallback(
    (updatedSubmissions: SubmissionGradeChange[]) => {
      setShowModal(false)
      if (updatedSubmissions.length) {
        handleSetGrades(updatedSubmissions)
      }
      focusButton()
    },
    [handleSetGrades, focusButton],
  )

  const handleClose = useCallback(() => {
    setShowModal(false)
    focusButton()
  }, [focusButton])

  return (
    <View as="div" className="pad-box no-sides">
      <Button
        color="secondary"
        onClick={() => setShowModal(true)}
        data-testid="default-grade-button"
        disabled={disableGrading(assignment)}
        elementRef={el => {
          buttonRef.current = el
        }}
      >
        {I18n.t('Set default grade')}
      </Button>
      <DefaultGradeModal
        assignment={assignment}
        gradebookOptions={gradebookOptions}
        submissions={submissions}
        modalOpen={showModal}
        handleClose={handleClose}
        handleSetGrades={onSetGrades}
      />
      {isInPastGradingPeriodAndNotAdmin(assignment) && (
        <View padding="0 0 0 xx-small">
          <Text data-testid="default-grade-warning">
            {I18n.t(
              'Unable to set default grade because this assignment is due in a closed grading period for at least one student',
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

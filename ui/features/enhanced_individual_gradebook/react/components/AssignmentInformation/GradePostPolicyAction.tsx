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

import React, {useEffect, useRef, useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import AssignmentPostingPolicyTray from '@canvas/assignment-posting-policy-tray'
import type {AssignmentConnection} from '../../../types'

const I18n = createI18nScope('enhanced_individual_gradebook')

type Props = {
  assignment: AssignmentConnection
}

export function GradePostPolicyAction({assignment}: Props) {
  const [postManually, setPostManually] = useState(assignment.postManually)
  useEffect(() => {
    setPostManually(assignment.postManually)
  }, [assignment.id])
  const trayRef = useRef<AssignmentPostingPolicyTray>(null)
  const buttonRef = useRef<Element | null>(null)

  const openTray = () =>
    trayRef.current?.show({
      assignment: {
        anonymousGrading: assignment.anonymousGrading,
        gradesPublished: assignment.gradesPublished,
        id: assignment.id,
        moderatedGrading: assignment.moderatedGrading,
        name: assignment.name,
        postManually,
      },
      onAssignmentPostPolicyUpdated: ({
        postManually: updated,
      }: {
        assignmentId: string
        postManually: boolean
      }) => {
        setPostManually(updated)
      },
      onExited: () => {
        requestAnimationFrame(() => {
          const el = buttonRef.current
          if (el instanceof HTMLElement) el.focus()
        })
      },
    })

  return (
    <View as="div" className="pad-box no-sides">
      <Button
        color="secondary"
        onClick={openTray}
        elementRef={el => {
          buttonRef.current = el
        }}
        data-testid="grade-post-policy-button"
      >
        {I18n.t('Grade Post Policy')}
      </Button>
      <AssignmentPostingPolicyTray ref={trayRef} />
    </View>
  )
}

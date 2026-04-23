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

import React, {useMemo} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {computeAssignmentDetailText} from '../../../utils/gradebookUtils'
import type {AssignmentConnection} from '../../../types'

const I18n = createI18nScope('enhanced_individual_gradebook')

type Props = {
  assignment: AssignmentConnection
  scores: number[]
}

export function AssignmentScoreDetails({assignment, scores}: Props) {
  const {average, max, min} = useMemo(
    () => computeAssignmentDetailText(assignment, scores),
    [assignment, scores],
  )

  return (
    <View as="div" className="pad-box bottom-only ic-Table-responsive-x-scroll">
      <table className="ic-Table">
        <thead>
          <tr>
            <th>{I18n.t('Points possible')}</th>
            <th>{I18n.t('Average Score')}</th>
            <th>{I18n.t('High Score')}</th>
            <th>{I18n.t('Low Score')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid="assignment-points-possible">
              {assignment.pointsPossible ? assignment.pointsPossible : I18n.t('No points possible')}
            </td>
            <td data-testid="assignment-average">{average}</td>
            <td data-testid="assignment-max">{max}</td>
            <td data-testid="assignment-min">{min}</td>
          </tr>
        </tbody>
      </table>
    </View>
  )
}

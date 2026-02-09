/*
 * Copyright (C) 2016 - present Instructure, Inc.
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
import PropTypes from 'prop-types'
import {ToggleDetails} from '@instructure/ui-toggle-details'
import {View} from '@instructure/ui-view'
import {IconMiniArrowDownSolid, IconMiniArrowEndSolid} from '@instructure/ui-icons'
import classNames from 'classnames'
import {useScope as createI18nScope} from '@canvas/i18n'
import {transformScore} from '@canvas/conditional-release-score'
import {assignmentShape, studentShape} from '../shapes/index'
import StudentRange from './student-range'

const I18n = createI18nScope('cyoe_assignment_sidebar_student_ranges_view')

const {array, func, object} = PropTypes

export default class StudentRangesView extends React.Component {
  static propTypes = {
    assignment: assignmentShape.isRequired,
    ranges: array.isRequired,
    selectedPath: object.isRequired,
    student: studentShape,

    // actions
    selectStudent: func.isRequired,
  }

  // @ts-expect-error -- legacy untyped React component
  constructor(props) {
    // @ts-expect-error -- legacy untyped React component
    super()
    this.state = {selectedRange: props.selectedPath.range}
  }

  // @ts-expect-error -- legacy untyped React component
  handleToggle = i => {
    this.setState({selectedRange: i})
  }

  renderTabs() {
    // @ts-expect-error -- legacy untyped React component
    const {ranges, assignment, selectStudent} = this.props

    // @ts-expect-error -- legacy untyped React component
    return ranges.map((range, i) => {
      // @ts-expect-error -- legacy untyped React component
      const expanded = this.state.selectedRange === i
      const lower = transformScore(range.scoring_range.lower_bound, assignment, false)
      const upper = transformScore(range.scoring_range.upper_bound, assignment, true)
      const rangeTitle = `> ${lower} - ${upper}`

      const iconExpanded = IconMiniArrowDownSolid
      const icon = IconMiniArrowEndSolid

      return (
        <View key={`range-${i}`} as="div" padding="xxx-small">
          {
            // @ts-expect-error -- legacy untyped React component
            <ToggleDetails
              variant="filled"
              expanded={expanded}
              summary={rangeTitle}
              onToggle={() => this.handleToggle(i)}
              size="large"
              iconExpanded={iconExpanded}
              icon={icon}
            >
              <StudentRange range={range} onStudentSelect={selectStudent} />
            </ToggleDetails>
          }
        </View>
      )
    })
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const {student} = this.props
    const isHidden = !!student

    const classes = classNames({
      'crs-ranges-view': true,
      'crs-ranges-view__hidden': isHidden,
    })
    return (
      <div className={classes}>
        <header className="crs-ranges-view__header">
          <h4>{I18n.t('Mastery Paths Breakdown')}</h4>
        </header>
        {this.renderTabs()}
      </div>
    )
  }
}

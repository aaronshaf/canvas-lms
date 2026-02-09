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

import React from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Button} from '@instructure/ui-buttons'
import {Menu} from '@instructure/ui-menu'
import {View} from '@instructure/ui-view'
import {IconMoreLine, IconEditLine, IconUpdownLine, IconTrashLine} from '@instructure/ui-icons'
import {List, Map} from 'immutable'

import Path from '../assignment-path'
import * as actions from '../actions'
import {useScope as createI18nScope} from '@canvas/i18n'
import {transformScore} from '../score-helpers'

const I18n = createI18nScope('conditional_release')

const {object, func, bool} = PropTypes

export class AssignmentCardMenu extends React.Component {
  static get propTypes() {
    return {
      path: object.isRequired,
      ranges: object.isRequired,
      assignment: object.isRequired,
      removeAssignment: func.isRequired,
      triggerAssignment: object,
      readOnly: bool,

      // action props
      moveAssignment: func.isRequired,
      setAriaAlert: func.isRequired,
    }
  }

  // @ts-expect-error -- legacy untyped React component
  handleMoveSelect(range, i) {
    // @ts-expect-error -- legacy untyped React component
    const {moveAssignment, path, assignment, setAriaAlert, triggerAssignment} = this.props
    const movePath = new Path(i, 0)
    moveAssignment(path, movePath, assignment.get('id').toString())

    setAriaAlert(
      I18n.t('Moved assignment %{name} to scoring range %{lower} - %{upper}', {
        name: assignment.get('name'),
        lower: transformScore(range.get('lower_bound'), triggerAssignment, false),
        upper: transformScore(range.get('upper_bound'), triggerAssignment, true),
      }),
    )
  }

  // @ts-expect-error -- legacy untyped React component
  createMoveSelectCallback(range, i) {
    return this.handleMoveSelect.bind(this, range, i)
  }

  renderMoveOptions() {
    // @ts-expect-error -- legacy untyped React component
    const {ranges, triggerAssignment, path} = this.props

    // @ts-expect-error -- legacy untyped React component
    const options = ranges.map((range, i) => (
      <Menu.Item key={range.get('id') || i} onSelect={this.createMoveSelectCallback(range, i)}>
        <IconUpdownLine />
        <View margin="0 0 0 x-small">
          {I18n.t('Move to %{lower} - %{upper}', {
            lower: transformScore(range.get('lower_bound'), triggerAssignment, false),
            upper: transformScore(range.get('upper_bound'), triggerAssignment, true),
          })}
        </View>
      </Menu.Item>
    ))

    // @ts-expect-error -- legacy untyped React component
    return options.filter((_range, i) => i !== path.range)
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const {readOnly, assignment, removeAssignment} = this.props
    if (readOnly) {
      return null
    }

    const trigger = (
      // @ts-expect-error -- InstUI Button renderIcon typing
      <Button renderIcon={IconMoreLine}>
        <ScreenReaderContent>
          {I18n.t('assignment %{name} options', {name: assignment.get('name')})}
        </ScreenReaderContent>
      </Button>
    )

    return (
      <Menu trigger={trigger} placement="bottom start">
        <Menu.Item onClick={() => window.open(assignment.get('html_url') + '/edit', '_blank')}>
          <IconEditLine /> <View margin="0 0 0 x-small">{I18n.t('Edit')}</View>
        </Menu.Item>
        {this.renderMoveOptions()}
        <Menu.Item onSelect={removeAssignment}>
          <IconTrashLine /> <View margin="0 0 0 x-small">{I18n.t('Remove')}</View>
        </Menu.Item>
      </Menu>
    )
  }
}

const ConnectedAssignmentCardMenu = connect(
  state => ({
    // @ts-expect-error -- legacy immutable redux state typing
    ranges: state.getIn(['rule', 'scoring_ranges'], List()),
    // @ts-expect-error -- legacy immutable redux state typing
    triggerAssignment: state.get('trigger_assignment', Map()),
  }),
  dispatch =>
    bindActionCreators(
      {
        moveAssignment: actions.moveAssignment,
        setAriaAlert: actions.setAriaAlert,
      },
      dispatch,
    ),
)(AssignmentCardMenu)

export default ConnectedAssignmentCardMenu

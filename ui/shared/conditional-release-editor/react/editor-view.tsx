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
import Immutable, {Map, List} from 'immutable'
import {DragDropContext} from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import Path from './assignment-path'
import * as actions from './actions'
import ScoringRange from './components/scoring-range'
import AssignmentPickerModal from './components/assignment-picker-modal'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('conditional_release')

const {object, func, bool} = PropTypes

class EditorView extends React.Component {
  static get propTypes() {
    return {
      state: object.isRequired,
      setScoreAtIndex: func.isRequired,
      appElement: object,
      readOnly: bool,

      // action props
      setAssignmentPickerTarget: func.isRequired,
      openAssignmentPicker: func.isRequired,
      closeAssignmentPicker: func.isRequired,
      addAssignmentsToRangeSet: func.isRequired,
      clearGlobalWarning: func.isRequired,
    }
  }

  constructor() {
    // @ts-expect-error -- legacy untyped React component
    super()
    this.closeAssignmentPicker = this.closeAssignmentPicker.bind(this)
    this.addItemsToRange = this.addItemsToRange.bind(this)
    this.setAssignmentPickerTarget = this.setAssignmentPickerTarget.bind(this)
  }

  // @ts-expect-error -- legacy untyped React component
  setAssignmentPickerTarget(index) {
    // @ts-expect-error -- legacy untyped React component
    const targetRange = this.props.state.getIn(['rule', 'scoring_ranges', index])
    const target = Map({
      rangeIndex: index,
      setIndex: 0,
      assignment_set_associations: targetRange.getIn(
        ['assignment_sets', 0, 'assignment_set_associations'],
        List(),
      ),
      lower_bound: targetRange.get('lower_bound'),
      upper_bound: targetRange.get('upper_bound'),
    })

    // @ts-expect-error -- legacy untyped React component
    this.props.setAssignmentPickerTarget(target)
    // @ts-expect-error -- legacy untyped React component
    this.props.openAssignmentPicker()
  }

  closeAssignmentPicker() {
    // @ts-expect-error -- legacy untyped React component
    this.props.closeAssignmentPicker()
  }

  addItemsToRange() {
    // @ts-expect-error -- legacy untyped React component
    const selected = this.props.state.getIn(['assignment_picker', 'selected_assignments'])
    // @ts-expect-error -- legacy untyped React component
    const selectedAssignments = selected.map(id => Immutable.Map({assignment_id: id}))

    // @ts-expect-error -- legacy untyped React component
    const target = this.props.state.getIn(['assignment_picker', 'target'])

    // @ts-expect-error -- legacy untyped React component
    this.props.addAssignmentsToRangeSet({
      index: target.get('rangeIndex'),
      assignmentSetIndex: target.get('setIndex'),
      assignment_set_associations: selectedAssignments,
    })

    this.closeAssignmentPicker()
  }

  // @ts-expect-error -- legacy untyped React component
  createScoreChangedCallback(index) {
    // @ts-expect-error -- legacy untyped React component
    return this.props.setScoreAtIndex.bind(this, index)
  }

  renderGlobalError() {
    // @ts-expect-error -- legacy untyped React component
    const errorText = this.props.state.get('global_error')
    if (errorText) {
      return (
        <p className="cr-editor__global-error">
          <strong>Error: </strong>
          {errorText}
        </p>
      )
    } else {
      return null
    }
  }

  // @ts-expect-error -- legacy untyped React component
  renderRanges(ranges) {
    return (
      <div className="cr-editor__scoring-ranges">
        {
          // @ts-expect-error -- legacy untyped React component
          ranges.map((range, i) => {
            // @ts-expect-error -- legacy untyped React component
            const triggerAssignment = this.props.state.get('trigger_assignment')
            // @ts-expect-error -- legacy untyped React component
            const assignments = this.props.state.get('assignments', Immutable.List())
            // @ts-expect-error -- legacy untyped React component
            const readOnly = this.props.readOnly

            return (
              <ScoringRange
                key={range.get('id') || i}
                path={new Path(i)}
                range={range}
                isTop={i === 0}
                isBottom={i === ranges.size - 1}
                onScoreChanged={this.createScoreChangedCallback(i)}
                onAddItems={this.setAssignmentPickerTarget}
                triggerAssignment={triggerAssignment}
                assignments={assignments}
                readOnly={readOnly}
              />
            )
          })
        }
      </div>
    )
  }

  renderEditorContent() {
    // @ts-expect-error -- legacy untyped React component
    const ranges = this.props.state.getIn(['rule', 'scoring_ranges'])

    if (ranges.size) {
      return this.renderRanges(ranges)
    } else {
      return <p>{I18n.t('Loading..')}</p>
    }
  }

  renderAssignmentsModal() {
    // @ts-expect-error -- legacy untyped React component
    const isModalOpen = this.props.state.getIn(['assignment_picker', 'is_open'], false)
    // @ts-expect-error -- legacy untyped React component
    const target = this.props.state.getIn(['assignment_picker', 'target'])
    // @ts-expect-error -- legacy untyped React component
    const triggerAssignment = this.props.state.get('trigger_assignment')
    // @ts-expect-error -- legacy untyped React component
    const appElement = this.props.appElement

    return (
      <AssignmentPickerModal
        isOpen={isModalOpen}
        target={target}
        onRequestClose={this.closeAssignmentPicker}
        addItemsToRange={this.addItemsToRange}
        triggerAssignment={triggerAssignment}
        appElement={appElement}
      />
    )
  }

  renderAriaAlert() {
    return (
      <ScreenReaderContent>
        <p role="alert" aria-live="assertive">
          {
            // @ts-expect-error -- legacy untyped React component
            this.props.state.get('aria_alert')
          }
        </p>
      </ScreenReaderContent>
    )
  }

  renderGlobalWarning() {
    // @ts-expect-error -- legacy untyped React component
    const warning = this.props.state.get('global_warning')
    // @ts-expect-error -- legacy untyped React component
    const clearGlobalWarning = this.props.clearGlobalWarning

    if (warning) {
      return (
        <div className="ic-flash-warning cr-global-warning">
          <div className="ic-flash__icon" aria-hidden={true}>
            <i className="icon-warning" />
          </div>
          {warning}
          <button
            type="button"
            className="Button Button--icon-action close_link"
            onClick={clearGlobalWarning}
          >
            <i className="icon-x" aria-hidden={true} />
            <ScreenReaderContent>{I18n.t('Close')}</ScreenReaderContent>
          </button>
        </div>
      )
    } else {
      return null
    }
  }

  render() {
    return (
      <div className="cr-editor">
        {this.renderAssignmentsModal()}
        {this.renderAriaAlert()}
        {this.renderGlobalWarning()}
        {this.renderGlobalError()}
        {this.renderEditorContent()}
      </div>
    )
  }
}

const ConnectedEditorView = connect(
  state => ({state}), // mapStateToProps
  {...actions, ...actions.assignmentPicker}, // mapActionsToProps
)(DragDropContext(HTML5Backend)(EditorView))

export default ConnectedEditorView

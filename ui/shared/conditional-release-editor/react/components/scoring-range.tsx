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
import {List} from 'immutable'

import ScoreLabel from './score-label'
import ScoreInput from './score-input'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import AssignmentSet from './assignment-set'
import * as actions from '../actions'
import {useScope as createI18nScope} from '@canvas/i18n'
import {transformScore, getScoringRangeSplitWarning} from '../score-helpers'

const I18n = createI18nScope('conditional_release')

const {object, func, bool} = PropTypes

const MAX_SETS = 3

class ScoringRange extends React.Component {
  static get propTypes() {
    return {
      triggerAssignment: object,
      range: object.isRequired,
      path: object.isRequired,
      assignments: object.isRequired,
      isTop: bool,
      isBottom: bool,
      onScoreChanged: func,
      onAddItems: func,
      readOnly: bool,

      // action props
      removeAssignment: func.isRequired,
      mergeAssignmentSets: func.isRequired,
      splitAssignmentSet: func.isRequired,
      moveAssignment: func.isRequired,
      setAriaAlert: func.isRequired,
      setGlobalWarning: func.isRequired,
    }
  }

  constructor() {
    // @ts-expect-error -- legacy untyped React component
    super()

    // @ts-expect-error -- legacy untyped React component
    this.titleRef = React.createRef()
    this.handleAddItems = this.handleAddItems.bind(this)
    this.removeAssignment = this.removeAssignment.bind(this)
    this.toggleSetCondition = this.toggleSetCondition.bind(this)
  }

  handleAddItems() {
    // @ts-expect-error -- legacy untyped React component
    const {onAddItems, path} = this.props
    onAddItems(path.range)
  }

  // @ts-expect-error -- legacy untyped React component
  renderScoreLabel(score, label, isUpperBound) {
    // @ts-expect-error -- legacy untyped React component
    const {triggerAssignment} = this.props
    return (
      <ScoreLabel
        score={score}
        label={label}
        isUpperBound={isUpperBound}
        triggerAssignment={triggerAssignment}
      />
    )
  }

  renderUpperBound() {
    // @ts-expect-error -- legacy untyped React component
    const {isTop, range} = this.props
    if (isTop) {
      return this.renderScoreLabel(range.get('upper_bound'), I18n.t('Top Bound'), true)
    } else {
      return null
    }
  }

  renderLowerBound() {
    // @ts-expect-error -- legacy untyped React component
    const {isBottom, range, onScoreChanged, triggerAssignment, readOnly} = this.props
    if (isBottom) {
      return this.renderScoreLabel(range.get('lower_bound'), I18n.t('Lower Bound'), false)
    } else {
      return (
        <ScoreInput
          score={range.get('lower_bound')}
          label={I18n.t('Cutoff Points')}
          error={range.get('error')}
          onScoreChanged={onScoreChanged}
          triggerAssignment={triggerAssignment}
          readOnly={readOnly}
        />
      )
    }
  }

  // @ts-expect-error -- legacy untyped React component
  toggleSetCondition(path, isAnd, isDisabled) {
    // @ts-expect-error -- legacy untyped React component
    const {setGlobalWarning, splitAssignmentSet, setAriaAlert, mergeAssignmentSets} = this.props
    if (isAnd) {
      if (isDisabled) {
        // see clearing method in actors.js
        setGlobalWarning(getScoringRangeSplitWarning())
      } else {
        splitAssignmentSet({
          index: path.range,
          assignmentSetIndex: path.set,
          splitIndex: path.assignment + 1,
        })
        setAriaAlert(I18n.t('Sets are split, click to merge'))
      }
    } else {
      mergeAssignmentSets({index: path.range, leftSetIndex: path.set})
      setAriaAlert(I18n.t('Sets are merged, click to split'))
    }
  }

  // @ts-expect-error -- legacy untyped React component
  removeAssignment(path, asg) {
    // @ts-expect-error -- legacy untyped React component
    const {removeAssignment, setAriaAlert} = this.props
    // @ts-expect-error -- legacy untyped React component
    const titleRef = this.titleRef
    removeAssignment({path})
    setAriaAlert(
      I18n.t('Removed assignment %{assignment_name}', {assignment_name: asg.get('name')}),
    )
    setTimeout(() => titleRef.current.focus(), 1)
  }

  renderAssignmentSets() {
    // @ts-expect-error -- legacy untyped React component
    const {path, range, assignments, moveAssignment, setGlobalWarning, readOnly} = this.props

    const sets = range.get('assignment_sets', List())

    return (
      sets
        // @ts-expect-error -- legacy untyped React component
        .map((set, i) => (
          <AssignmentSet
            key={set.get('id') || i}
            path={path.push(i)}
            label={I18n.t('Assignment set %{set_index}', {set_index: i + 1})}
            setAssignments={set.get('assignment_set_associations', List())}
            allAssignments={assignments}
            showOrToggle={i + 1 !== sets.size}
            toggleSetCondition={this.toggleSetCondition}
            removeAssignment={this.removeAssignment}
            moveAssignment={moveAssignment}
            disableSplit={sets.size >= MAX_SETS}
            setGlobalWarning={setGlobalWarning}
            readOnly={readOnly}
          />
        ))
        .toArray()
    )
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const {range, triggerAssignment, readOnly} = this.props
    // @ts-expect-error -- legacy untyped React component
    const titleRef = this.titleRef

    const upperBound = transformScore(range.get('upper_bound'), triggerAssignment, true)
    const lowerBound = transformScore(range.get('lower_bound'), triggerAssignment, false)

    const rangeTitle = I18n.t('Scoring range %{upperBound} to %{lowerBound}', {
      upperBound,
      lowerBound,
    })

    return (
      <div className="cr-scoring-range">
        <ScreenReaderContent>
          <h2 ref={titleRef}>{rangeTitle}</h2>
        </ScreenReaderContent>
        <div className="cr-scoring-range__bounds">
          <div className="cr-scoring-range__bound cr-scoring-range__upper-bound">
            {this.renderUpperBound()}
          </div>
          <div
            className={`cr-scoring-range__center${readOnly ? ' cr-scoring-range__center--read-only' : ''}`}
          >
            {!readOnly && (
              <button
                type="button"
                className="cr-scoring-range__add-assignment-button"
                aria-label={I18n.t('Add Items to Score Range')}
                onClick={this.handleAddItems}
              >
                +
              </button>
            )}
            <div className="cr-scoring-range__assignments">{this.renderAssignmentSets()}</div>
          </div>
          <div
            className={`cr-scoring-range__bound cr-scoring-range__lower-bound${readOnly ? ' cr-scoring-range__lower-bound--read-only' : ''}`}
          >
            {this.renderLowerBound()}
          </div>
        </div>
      </div>
    )
  }
}

const ConnectedScoringRange = connect(null, actions)(ScoringRange)

export default ConnectedScoringRange

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
import {List, Map} from 'immutable'
import {debounce} from 'es-toolkit/compat'

import * as actions from '../assignment-picker-actions'

import {ALL_ID} from '../categories'
import AssignmentFilter from './assignment-filter'
import AssignmentList from './assignment-list'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('conditional_release')

const {object, string, func} = PropTypes

export class AssignmentPicker extends React.Component {
  static get propTypes() {
    return {
      assignments: object.isRequired,
      disabledAssignments: object,
      selectedAssignments: object,
      nameFilter: string,
      categoryFilter: string,
      triggerAssignmentId: string,

      // Action Props
      filterAssignmentsByName: func.isRequired,
      filterAssignmentsByCategory: func.isRequired,
      selectAssignmentInPicker: func.isRequired,
      unselectAssignmentInPicker: func.isRequired,
    }
  }

  constructor() {
    // @ts-expect-error
    super()
    this.filterByName = this.filterByName.bind(this)
    this.filterByCategory = this.filterByCategory.bind(this)
    this.updateScreenReaderResultCount = debounce(this.updateScreenReaderResultCount, 1000)
    this.state = {}
  }

  // @ts-expect-error
  filterByName(nameFilter) {
    // @ts-expect-error
    this.props.filterAssignmentsByName(nameFilter)
  }

  // @ts-expect-error
  filterByCategory(category) {
    // @ts-expect-error
    this.props.filterAssignmentsByCategory(category)
  }

  filterAssignments() {
    // @ts-expect-error
    const nameFilter = this.props.nameFilter.toLowerCase()
    // @ts-expect-error
    const categoryFilter = this.props.categoryFilter

    // @ts-expect-error
    const assignments = this.props.assignments.filter(assignment => {
      // @ts-expect-error
      const notTrigger = String(assignment.get('id')) !== String(this.props.triggerAssignmentId)
      const matchesName =
        !nameFilter || assignment.get('name').toLowerCase().indexOf(nameFilter) !== -1
      const matchesCategory =
        !categoryFilter ||
        categoryFilter === ALL_ID ||
        categoryFilter === assignment.get('category')
      return notTrigger && matchesName && matchesCategory
    })
    this.updateScreenReaderResultCount(assignments.size, this.getFilterKey())
    return assignments
  }

  getFilterKey() {
    // @ts-expect-error
    return this.props.nameFilter.toLowerCase() + ':' + this.props.categoryFilter
  }

  // Update screenreader state on debounce delay to make
  // more likely that screenreader will not preempt search feedback
  // for typing feedback
  // @ts-expect-error
  updateScreenReaderResultCount(resultCount, key) {
    // @ts-expect-error
    if (this.state.key !== key) {
      this.setState({resultCount, key})
    }
  }

  renderScreenReaderResultCount() {
    // @ts-expect-error
    const unread = this.state.key !== this.lastKey
    // @ts-expect-error
    this.lastKey = this.state.key

    const text = I18n.t(
      {
        zero: 'No items found',
        one: 'One item found',
        other: '%{count} items found',
      },
      {
        // @ts-expect-error
        count: this.state.resultCount || 0,
      },
    )

    return (
      <ScreenReaderContent>
        {unread ? (
          <div role="alert" aria-relevant="all" aria-atomic="true">
            <span>{text}</span>
          </div>
        ) : null}
      </ScreenReaderContent>
    )
  }

  render() {
    const assignments = this.filterAssignments()

    return (
      <div className="cr-assignments-picker">
        <AssignmentFilter
          onNameFilter={this.filterByName}
          onCategoryFilter={this.filterByCategory}
          defaultCategoryFilter={ALL_ID}
        />
        <AssignmentList
          assignments={assignments}
          // @ts-expect-error
          disabledAssignments={this.props.disabledAssignments}
          // @ts-expect-error
          selectedAssignments={this.props.selectedAssignments}
          // @ts-expect-error
          onSelectAssignment={this.props.selectAssignmentInPicker}
          // @ts-expect-error
          onUnselectAssignment={this.props.unselectAssignmentInPicker}
        />
        {this.renderScreenReaderResultCount()}
      </div>
    )
  }
}

const ConnectedAssignmentPicker = connect(
  state => ({
    // @ts-expect-error
    assignments: state.get('assignments', Map()).toList(),
    // @ts-expect-error
    disabledAssignments: state.getIn(['assignment_picker', 'disabled_assignments'], List()),
    // @ts-expect-error
    selectedAssignments: state.getIn(['assignment_picker', 'selected_assignments'], List()),
    // @ts-expect-error
    nameFilter: state.getIn(['assignment_picker', 'name_filter'], ''),
    // @ts-expect-error
    categoryFilter: state.getIn(['assignment_picker', 'category_filter']),
    // @ts-expect-error
    triggerAssignmentId: state.getIn(['trigger_assignment', 'id']),
  }), // mapStateToProps
  actions, // mapActionsToProps
)(AssignmentPicker)

export default ConnectedAssignmentPicker

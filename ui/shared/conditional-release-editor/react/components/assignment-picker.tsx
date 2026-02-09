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
    // @ts-expect-error -- legacy untyped React component
    super()
    this.filterByName = this.filterByName.bind(this)
    this.filterByCategory = this.filterByCategory.bind(this)
    this.updateScreenReaderResultCount = debounce(this.updateScreenReaderResultCount, 1000)
    this.state = {}
  }

  // @ts-expect-error -- legacy untyped React component
  filterByName(nameFilter) {
    // @ts-expect-error -- legacy untyped React component
    const {filterAssignmentsByName} = this.props
    filterAssignmentsByName(nameFilter)
  }

  // @ts-expect-error -- legacy untyped React component
  filterByCategory(category) {
    // @ts-expect-error -- legacy untyped React component
    const {filterAssignmentsByCategory} = this.props
    filterAssignmentsByCategory(category)
  }

  filterAssignments() {
    const {
      // @ts-expect-error -- legacy untyped React component
      nameFilter,
      // @ts-expect-error -- legacy untyped React component
      categoryFilter,
      // @ts-expect-error -- legacy untyped React component
      assignments: allAssignments,
      // @ts-expect-error -- legacy untyped React component
      triggerAssignmentId,
    } = this.props
    const nameFilterValue = nameFilter.toLowerCase()

    // @ts-expect-error -- legacy untyped React component
    const assignments = allAssignments.filter(assignment => {
      const notTrigger = String(assignment.get('id')) !== String(triggerAssignmentId)
      const matchesName =
        !nameFilterValue || assignment.get('name').toLowerCase().indexOf(nameFilterValue) !== -1
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
    // @ts-expect-error -- legacy untyped React component
    const {nameFilter, categoryFilter} = this.props
    return nameFilter.toLowerCase() + ':' + categoryFilter
  }

  // Update screenreader state on debounce delay to make
  // more likely that screenreader will not preempt search feedback
  // for typing feedback
  // @ts-expect-error -- legacy untyped React component
  updateScreenReaderResultCount(resultCount, key) {
    // @ts-expect-error -- legacy untyped React component
    if (this.state.key !== key) {
      this.setState({resultCount, key})
    }
  }

  renderScreenReaderResultCount() {
    // @ts-expect-error -- legacy untyped React component
    const unread = this.state.key !== this.lastKey
    // @ts-expect-error -- legacy untyped React component
    this.lastKey = this.state.key

    const text = I18n.t(
      {
        zero: 'No items found',
        one: 'One item found',
        other: '%{count} items found',
      },
      {
        // @ts-expect-error -- legacy untyped React component
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
    const {
      // @ts-expect-error -- legacy untyped React component
      disabledAssignments,
      // @ts-expect-error -- legacy untyped React component
      selectedAssignments,
      // @ts-expect-error -- legacy untyped React component
      selectAssignmentInPicker,
      // @ts-expect-error -- legacy untyped React component
      unselectAssignmentInPicker,
    } = this.props

    return (
      <div className="cr-assignments-picker">
        <AssignmentFilter
          onNameFilter={this.filterByName}
          onCategoryFilter={this.filterByCategory}
          defaultCategoryFilter={ALL_ID}
        />
        <AssignmentList
          assignments={assignments}
          disabledAssignments={disabledAssignments}
          selectedAssignments={selectedAssignments}
          onSelectAssignment={selectAssignmentInPicker}
          onUnselectAssignment={unselectAssignmentInPicker}
        />
        {this.renderScreenReaderResultCount()}
      </div>
    )
  }
}

const ConnectedAssignmentPicker = connect(
  state => ({
    // @ts-expect-error -- legacy immutable redux state typing
    assignments: state.get('assignments', Map()).toList(),
    // @ts-expect-error -- legacy immutable redux state typing
    disabledAssignments: state.getIn(['assignment_picker', 'disabled_assignments'], List()),
    // @ts-expect-error -- legacy immutable redux state typing
    selectedAssignments: state.getIn(['assignment_picker', 'selected_assignments'], List()),
    // @ts-expect-error -- legacy immutable redux state typing
    nameFilter: state.getIn(['assignment_picker', 'name_filter'], ''),
    // @ts-expect-error -- legacy immutable redux state typing
    categoryFilter: state.getIn(['assignment_picker', 'category_filter']),
    // @ts-expect-error -- legacy immutable redux state typing
    triggerAssignmentId: state.getIn(['trigger_assignment', 'id']),
  }), // mapStateToProps
  actions, // mapActionsToProps
)(AssignmentPicker)

export default ConnectedAssignmentPicker

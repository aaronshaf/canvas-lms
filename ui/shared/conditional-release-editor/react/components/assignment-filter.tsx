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
import {debounce} from 'es-toolkit/compat'

import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import categories from '../categories'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('conditional_release')

const {func, string} = PropTypes

class AssignmentFilter extends React.Component {
  static get propTypes() {
    return {
      onNameFilter: func.isRequired,
      onCategoryFilter: func.isRequired,
      defaultCategoryFilter: string,
    }
  }

  constructor() {
    // @ts-expect-error -- legacy untyped React component
    super()

    this.filterByName = debounce(this.filterByName.bind(this), 250)
    this.filterByCategory = this.filterByCategory.bind(this)
    // @ts-expect-error -- legacy untyped React component
    this.nameFilterRef = React.createRef()
  }

  // @ts-expect-error -- legacy untyped React component
  filterByName(_e) {
    // @ts-expect-error -- legacy untyped React component
    const {onNameFilter} = this.props
    // @ts-expect-error -- legacy untyped React component
    const nameFilterRef = this.nameFilterRef
    onNameFilter(nameFilterRef.current.value.trim())
  }

  // @ts-expect-error -- legacy untyped React component
  filterByCategory(e) {
    // @ts-expect-error -- legacy untyped React component
    const {onCategoryFilter} = this.props
    onCategoryFilter(e.target.value)
  }

  renderCategories() {
    return categories.map(cat => (
      <option key={cat.id} value={cat.id}>
        {cat.label()}
      </option>
    ))
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const nameFilterRef = this.nameFilterRef
    // @ts-expect-error -- legacy untyped React component
    const defaultCategoryFilter = this.props.defaultCategoryFilter

    return (
      <div className="cr-assignments-filter">
        <ScreenReaderContent>
          <label
            className="cr-assignments-filter__name-filter__label"
            htmlFor="cr-assignments-filter__name-filter"
          >
            {I18n.t('Search Assignments')}
          </label>
        </ScreenReaderContent>
        <input
          id="cr-assignments-filter__name-filter"
          className="cr-assignments-filter__name-filter"
          placeholder={I18n.t('Search')}
          type="text"
          ref={nameFilterRef}
          onChange={this.filterByName}
        />
        <ScreenReaderContent>
          <label
            className="cr-assignments-filter__category-filter__label"
            htmlFor="cr-assignments-filter__category-filter"
          >
            {I18n.t('Filter Assignment Category')}
          </label>
        </ScreenReaderContent>
        <select
          id="cr-assignments-filter__category-filter"
          className="cr-assignments-filter__category-filter"
          defaultValue={defaultCategoryFilter}
          onChange={this.filterByCategory}
        >
          {this.renderCategories()}
        </select>
      </div>
    )
  }
}

export default AssignmentFilter

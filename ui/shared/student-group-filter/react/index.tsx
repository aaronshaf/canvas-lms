/*
 * Copyright (C) 2019 - present Instructure, Inc.
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

import {arrayOf, func, shape, string} from 'prop-types'
import {FormField} from '@instructure/ui-form-field'
import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'

const I18n = createI18nScope('assignment')

/* @ts-expect-error -- TODO: TSify */
function renderGroup(group) {
  return (
    <option key={group.id} value={group.id}>
      {group.name}
    </option>
  )
}

/* @ts-expect-error -- TODO: TSify */
function renderCategoryAndChildren(category) {
  /* @ts-expect-error -- TODO: TSify */
  const groupOptions = category.groups.map(group => renderGroup(group))
  return (
    <optgroup label={category.name} key={`group_category_${category.id}`}>
      {groupOptions}
    </optgroup>
  )
}

/* @ts-expect-error -- TODO: TSify */
function StudentGroupFilter(props) {
  /* @ts-expect-error -- TODO: TSify */
  const categoryOptions = props.categories.map(category => renderCategoryAndChildren(category))

  const selectOneOption = (
    /* @ts-expect-error -- TODO: TSify */
    <option aria-disabled="true" disabled="disabled" key="0" value="0">
      {I18n.t('Select One')}
    </option>
  )

  return (
    <FormField id="student-group-filter" label={props.label}>
      <select
        onChange={event => {
          props.onChange(event.target.value)
        }}
        style={{
          margin: '0',
          width: '100%',
        }}
        value={props.value || '0'}
      >
        {selectOneOption}
        {categoryOptions}
      </select>
    </FormField>
  )
}

StudentGroupFilter.propTypes = {
  categories: arrayOf(
    shape({
      id: string.isRequired,
      groups: arrayOf(
        shape({
          id: string.isRequired,
          name: string.isRequired,
        }),
      ),
      name: string.isRequired,
    }),
  ),
  label: string.isRequired,
  onChange: func.isRequired,
  value: string,
}

export default StudentGroupFilter
